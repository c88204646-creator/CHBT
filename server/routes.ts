import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { hashPassword, comparePasswords, generateToken, requireAuth } from "./auth";
import { whatsappManager } from "./whatsapp-manager";
import { loginSchema, insertUserSchema, insertChatbotRuleSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);

      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
      });

      const token = generateToken({
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await storage.getUserByUsername(data.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const isValid = await comparePasswords(data.password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken({
        userId: user.id,
        username: user.username,
        email: user.email,
      });

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get user" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getWhatsappSessionsByUserId(req.user!.userId);
      const connectedSessions = sessions.filter(s => s.status === "connected").length;
      const conversations = await storage.getConversationsByUserId(req.user!.userId);
      const rules = await storage.getChatbotRulesByUserId(req.user!.userId);
      const activeChatbots = rules.filter(r => r.isActive).length;

      res.json({
        totalSessions: sessions.length,
        connectedSessions,
        totalConversations: conversations.length,
        activeChatbots,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get stats" });
    }
  });

  // WhatsApp session routes
  app.get("/api/whatsapp/sessions", requireAuth, async (req, res) => {
    try {
      const sessions = await storage.getWhatsappSessionsByUserId(req.user!.userId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get sessions" });
    }
  });

  app.post("/api/whatsapp/sessions", requireAuth, async (req, res) => {
    try {
      const session = await storage.createWhatsappSession({
        userId: req.user!.userId,
        status: "connecting",
      });

      // Wait for QR code to be generated (up to 30 seconds)
      await whatsappManager.createSession(session.id, req.user!.userId);

      // Small delay to ensure DB is updated with QR code
      await new Promise(resolve => setTimeout(resolve, 500));

      const updatedSession = await storage.getWhatsappSession(session.id);
      res.json(updatedSession);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to create session" });
    }
  });

  app.delete("/api/whatsapp/sessions/:id", requireAuth, async (req, res) => {
    try {
      const session = await storage.getWhatsappSession(req.params.id);
      if (!session || session.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Session not found" });
      }

      await whatsappManager.disconnectSession(session.id);
      await storage.deleteWhatsappSession(session.id);

      res.json({ message: "Session disconnected" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to disconnect session" });
    }
  });

  // Conversation routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const conversations = await storage.getConversationsByUserId(req.user!.userId);
      res.json(conversations);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get conversations" });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const messages = await storage.getMessagesByConversationId(req.params.id);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get messages" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const session = await storage.getWhatsappSession(conversation.sessionId);
      if (!session || session.userId !== req.user!.userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const sent = await whatsappManager.sendMessage(
        session.id,
        conversation.contactNumber,
        content
      );

      if (!sent) {
        return res.status(500).json({ message: "Failed to send message" });
      }

      const message = await storage.createMessage({
        conversationId: conversation.id,
        content,
        fromMe: true,
        timestamp: new Date(),
        status: "sent",
      });

      await storage.updateConversation(conversation.id, {
        lastMessage: content,
        lastMessageTime: new Date(),
      });

      res.json(message);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to send message" });
    }
  });

  // Chatbot rules routes
  app.get("/api/chatbot/rules", requireAuth, async (req, res) => {
    try {
      const rules = await storage.getChatbotRulesByUserId(req.user!.userId);
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get rules" });
    }
  });

  app.post("/api/chatbot/rules", requireAuth, async (req, res) => {
    try {
      const data = insertChatbotRuleSchema.parse(req.body);
      const rule = await storage.createChatbotRule({
        ...data,
        userId: req.user!.userId,
      });
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create rule" });
    }
  });

  app.put("/api/chatbot/rules/:id", requireAuth, async (req, res) => {
    try {
      const existingRule = await storage.getChatbotRule(req.params.id);
      if (!existingRule || existingRule.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Rule not found" });
      }

      const data = insertChatbotRuleSchema.parse(req.body);
      const rule = await storage.updateChatbotRule(req.params.id, data);
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update rule" });
    }
  });

  app.patch("/api/chatbot/rules/:id/toggle", requireAuth, async (req, res) => {
    try {
      const existingRule = await storage.getChatbotRule(req.params.id);
      if (!existingRule || existingRule.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Rule not found" });
      }

      const { isActive } = req.body;
      const rule = await storage.updateChatbotRule(req.params.id, { isActive });
      res.json(rule);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to toggle rule" });
    }
  });

  app.delete("/api/chatbot/rules/:id", requireAuth, async (req, res) => {
    try {
      const existingRule = await storage.getChatbotRule(req.params.id);
      if (!existingRule || existingRule.userId !== req.user!.userId) {
        return res.status(404).json({ message: "Rule not found" });
      }

      await storage.deleteChatbotRule(req.params.id);
      res.json({ message: "Rule deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to delete rule" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
