import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  WAMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { storage } from "./storage";
import fs from "fs";
import path from "path";

interface WhatsAppConnection {
  sock: WASocket | null;
  qrCode: string | null;
  status: "connecting" | "connected" | "disconnected";
  sessionId: string;
}

class WhatsAppManager {
  private connections: Map<string, WhatsAppConnection> = new Map();
  private authDir = path.join(process.cwd(), ".auth-sessions");

  constructor() {
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  async createSession(sessionId: string, userId: string): Promise<void> {
    try {
      const sessionPath = path.join(this.authDir, sessionId);
      
      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "121.0"],
      });

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        console.log("[QR] Connection update:", { connection, hasQr: !!qr });

        if (qr) {
          try {
            const qrCodeData = await QRCode.toDataURL(qr);
            console.log("[QR] Generated QR code for session:", sessionId);
            await storage.updateWhatsappSession(sessionId, {
              qrCode: qrCodeData,
              status: "connecting",
            });
            
            const conn = this.connections.get(sessionId);
            if (conn) {
              conn.qrCode = qrCodeData;
              conn.status = "connecting";
            }
          } catch (error) {
            console.error("[QR] Error generating QR code:", error);
          }
        }

        if (connection === "close") {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          if (shouldReconnect) {
            console.log("[QR] Reconnecting session:", sessionId);
            setTimeout(() => this.createSession(sessionId, userId), 3000);
          } else {
            console.log("[QR] Session logged out:", sessionId);
            await storage.updateWhatsappSession(sessionId, {
              status: "disconnected",
            });
            this.connections.delete(sessionId);
          }
        } else if (connection === "open") {
          const phoneNumber = sock.user?.id?.split(":")[0] || "unknown";
          console.log("[QR] Connected with phone:", phoneNumber);
          await storage.updateWhatsappSession(sessionId, {
            phoneNumber,
            status: "connected",
            qrCode: null,
          });

          const conn = this.connections.get(sessionId);
          if (conn) {
            conn.status = "connected";
            conn.qrCode = null;
          }
        }
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("messages.upsert", async (m) => {
        if (m.type === "notify") {
          for (const msg of m.messages) {
            await this.handleIncomingMessage(sessionId, userId, msg);
          }
        }
      });

      this.connections.set(sessionId, {
        sock,
        qrCode: null,
        status: "connecting",
        sessionId,
      });
    } catch (error) {
      console.error("Error creating WhatsApp session:", error);
    }
  }

  async handleIncomingMessage(sessionId: string, userId: string, msg: WAMessage) {
    try {
      const messageKey = msg.key;
      const messageContent = msg.message;

      console.log("[MESSAGE-DEBUG] Incoming message key:", { 
        remoteJid: messageKey.remoteJid,
        fromMe: messageKey.fromMe,
        hasContent: !!messageContent
      });

      if (!messageKey.remoteJid || !messageContent) {
        console.log("[MESSAGE-DEBUG] Skipping - no remoteJid or content");
        return;
      }

      // Skip messages sent by me
      if (messageKey.fromMe) {
        console.log("[MESSAGE-DEBUG] Skipping - message from me");
        return;
      }

      const contactNumber = messageKey.remoteJid.split("@")[0];
      const contactName = msg.pushName || contactNumber;
      
      // Extract message text from various Baileys message types
      let messageText = "";
      
      if (messageContent.conversation) {
        messageText = messageContent.conversation;
      } else if (messageContent.extendedTextMessage?.text) {
        messageText = messageContent.extendedTextMessage.text;
      } else if (messageContent.imageMessage?.caption) {
        messageText = messageContent.imageMessage.caption;
      } else if (messageContent.videoMessage?.caption) {
        messageText = messageContent.videoMessage.caption;
      } else if (messageContent.documentMessage?.caption) {
        messageText = messageContent.documentMessage.caption;
      } else if (messageContent.audioMessage) {
        messageText = "[Audio message]";
      } else if (messageContent.imageMessage) {
        messageText = "[Image]";
      } else if (messageContent.videoMessage) {
        messageText = "[Video]";
      } else if (messageContent.documentMessage) {
        messageText = `[Document: ${messageContent.documentMessage.fileName || "file"}]`;
      } else if (messageContent.stickerMessage) {
        messageText = "[Sticker]";
      } else if (messageContent.contactMessage) {
        messageText = `[Contact: ${messageContent.contactMessage.displayName}]`;
      } else {
        messageText = "[Unsupported message type]";
      }

      // Only save if we have meaningful content
      if (!messageText || messageText.trim() === "") {
        console.log("[MESSAGE-DEBUG] Skipping - empty message text");
        return;
      }

      console.log(`[MESSAGE] ✓ RECEIVED Session: ${sessionId}, Contact: ${contactNumber}, Text: ${messageText.substring(0, 100)}`);

      let conversation = (await storage.getConversationsBySessionId(sessionId)).find(
        (c) => c.contactNumber === contactNumber
      );

      if (!conversation) {
        conversation = await storage.createConversation({
          sessionId,
          contactName,
          contactNumber,
          lastMessage: messageText,
          lastMessageTime: new Date(),
          unreadCount: 1,
        });
      } else {
        await storage.updateConversation(conversation.id, {
          lastMessage: messageText,
          lastMessageTime: new Date(),
          unreadCount: (conversation.unreadCount || 0) + 1,
        });
      }

      await storage.createMessage({
        conversationId: conversation.id,
        content: messageText,
        fromMe: false,
        timestamp: new Date(),
        status: "delivered",
      });

      const chatbotRules = await storage.getChatbotRulesByUserId(userId);
      const matchedRule = chatbotRules.find(
        (rule) =>
          rule.isActive &&
          messageText.toLowerCase().includes(rule.keyword.toLowerCase())
      );

      if (matchedRule) {
        await this.sendMessage(sessionId, contactNumber, matchedRule.response);
      }
    } catch (error) {
      console.error("Error handling incoming message:", error);
    }
  }

  async sendMessage(sessionId: string, to: string, text: string): Promise<boolean> {
    try {
      const connection = this.connections.get(sessionId);
      if (!connection || !connection.sock || connection.status !== "connected") {
        console.error(`[SEND-ERROR] Session not found or not connected. Status: ${connection?.status}`);
        return false;
      }

      const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
      await connection.sock.sendMessage(jid, { text });
      console.log(`[SEND] ✓ Message sent to ${to}: ${text.substring(0, 50)}`);
      return true;
    } catch (error) {
      console.error("[SEND-ERROR]", error);
      return false;
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (connection?.sock) {
      try {
        // Logout from WhatsApp first
        console.log("[DISCONNECT] Logging out session:", sessionId);
        await connection.sock.logout();
      } catch (error) {
        console.error("[DISCONNECT] Error during logout:", error);
      }
      
      try {
        // End the socket connection completely
        console.log("[DISCONNECT] Closing socket for session:", sessionId);
        connection.sock.end(undefined);
      } catch (error) {
        console.error("[DISCONNECT] Error closing socket:", error);
      }
    }
    
    // Update database to mark as disconnected
    try {
      await storage.updateWhatsappSession(sessionId, {
        status: "disconnected",
      });
    } catch (error) {
      console.error("[DISCONNECT] Error updating session status:", error);
    }
    
    // Remove from memory
    this.connections.delete(sessionId);

    // Clean up auth files
    const sessionPath = path.join(this.authDir, sessionId);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log("[DISCONNECT] Cleaned up auth files for session:", sessionId);
      } catch (error) {
        console.error("[DISCONNECT] Error cleaning up auth files:", error);
      }
    }
  }

  getConnection(sessionId: string): WhatsAppConnection | undefined {
    return this.connections.get(sessionId);
  }
}

export const whatsappManager = new WhatsAppManager();
