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

      if (!messageKey.remoteJid || !messageContent) return;

      const contactNumber = messageKey.remoteJid.split("@")[0];
      const contactName = msg.pushName || contactNumber;
      const messageText =
        messageContent.conversation ||
        messageContent.extendedTextMessage?.text ||
        "";

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
        return false;
      }

      const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
      await connection.sock.sendMessage(jid, { text });
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (connection?.sock) {
      await connection.sock.logout();
    }
    this.connections.delete(sessionId);

    const sessionPath = path.join(this.authDir, sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  getConnection(sessionId: string): WhatsAppConnection | undefined {
    return this.connections.get(sessionId);
  }
}

export const whatsappManager = new WhatsAppManager();
