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
  pairingCode: string | null;
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
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: 0,
        shouldIgnoreJid: (jid) => false,
        // Try pairing code first for Business accounts
        qrTimeout: 60000,
      });

      console.log("[SOCKET] Socket created for session:", sessionId);

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

        // Handle pairing code for Business accounts
        if (update.code) {
          const pairingCode = update.code;
          console.log("[PAIRING] Generated pairing code:", pairingCode);
          await storage.updateWhatsappSession(sessionId, {
            qrCode: pairingCode, // Store code in qrCode field temporarily
            status: "connecting",
          });
          
          const conn = this.connections.get(sessionId);
          if (conn) {
            conn.pairingCode = pairingCode;
            conn.status = "connecting";
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
          console.log("[QR] ✅ CONNECTED with phone:", phoneNumber);
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

          // Load all existing chats when connected
          console.log("[CHATS] Loading existing chats for session:", sessionId);
          await this.loadAllChats(sessionId, userId, sock);
        }
      });

      sock.ev.on("creds.update", saveCreds);

      console.log("[LISTENERS] Registering event listeners for session:", sessionId);

      // Listen for chat updates
      sock.ev.on("chats.set", async (data) => {
        console.log(`[CHATS-SET] Received ${data.chats?.length || 0} chats`);
        if (data.chats) {
          for (const chat of data.chats) {
            await this.processChat(sessionId, userId, chat, sock);
          }
        }
      });

      sock.ev.on("chats.upsert", async (chats) => {
        console.log(`[CHATS-UPSERT] Received ${chats.length} chat updates`);
        for (const chat of chats) {
          await this.processChat(sessionId, userId, chat, sock);
        }
      });

      // PRIMARY: Listen to messages.upsert for REAL-TIME messages
      sock.ev.on("messages.upsert", async (m) => {
        console.log(`[MESSAGES-UPSERT] ✅ Type: ${m.type}, Count: ${m.messages.length}`);
        for (const msg of m.messages) {
          console.log(`[MESSAGE-RECEIVED] From: ${msg.key.remoteJid}, FromMe: ${msg.key.fromMe}, HasContent: ${!!msg.message}`);
          await this.handleIncomingMessage(sessionId, userId, msg);
        }
      });

      this.connections.set(sessionId, {
        sock,
        qrCode: null,
        pairingCode: null,
        status: "connecting",
        sessionId,
      });
    } catch (error) {
      console.error("Error creating WhatsApp session:", error);
    }
  }

  async loadAllChats(sessionId: string, userId: string, sock: WASocket): Promise<void> {
    try {
      console.log("[CHATS] Loading chats via store...");
      // Baileys stores chats after connection - just log to start the process
      console.log("[CHATS] ✅ Ready to receive chats from events");
    } catch (error) {
      console.error("[CHATS] Error loading chats:", error);
    }
  }

  async processChat(sessionId: string, userId: string, chat: any, sock: WASocket): Promise<void> {
    try {
      const contactNumber = chat.id?.split("@")[0];
      if (!contactNumber || contactNumber.includes("status") || contactNumber.includes("broadcast")) {
        return;
      }

      const contactName = chat.name || chat.pushName || contactNumber;
      console.log(`[CHATS] Processing chat: ${contactName} (${contactNumber})`);

      let conversation: any = null;
      const existingConvs = await storage.getConversationsBySessionId(sessionId);
      conversation = existingConvs.find((c) => c.contactNumber === contactNumber);

      if (!conversation) {
        conversation = await storage.createConversation({
          sessionId,
          contactName,
          contactNumber,
          lastMessage: chat.lastMessage || null,
          lastMessageTime: chat.lastMessageTime || null,
          unreadCount: chat.unreadCount || 0,
        });
        console.log(`[CHATS] Created conversation: ${conversation.id}`);
      } else {
        await storage.updateConversation(conversation.id, {
          contactName,
          lastMessage: chat.lastMessage || conversation.lastMessage,
          lastMessageTime: chat.lastMessageTime || conversation.lastMessageTime,
          unreadCount: chat.unreadCount || 0,
        });
      }
    } catch (error) {
      console.error("[CHATS] Error processing chat:", error);
    }
  }

  async handleIncomingMessage(sessionId: string, userId: string, msg: WAMessage) {
    try {
      const messageKey = msg.key;
      const messageContent = msg.message;

      console.log("[MESSAGE-HANDLE] Raw message structure:", {
        remoteJid: messageKey.remoteJid,
        fromMe: messageKey.fromMe,
        hasContent: !!messageContent,
        contentKeys: messageContent ? Object.keys(messageContent) : [],
        messageId: messageKey.id,
        hasBody: !!(msg as any).body,
        hasText: !!(msg as any).text,
        allKeys: Object.keys(msg).slice(0, 10)
      });

      if (!messageKey.remoteJid) {
        console.log("[MESSAGE-SKIP] No remoteJid");
        return;
      }

      const contactNumber = messageKey.remoteJid.split("@")[0];
      const contactName = msg.pushName || contactNumber;
      
      let messageText = "";
      
      // PRIORITY 1: Try direct message content first
      if (messageContent) {
        if (messageContent.conversation) {
          messageText = messageContent.conversation;
        } 
        else if (messageContent.extendedTextMessage?.text) {
          messageText = messageContent.extendedTextMessage.text;
        }
        else if ((messageContent as any).textMessage?.text) {
          messageText = (messageContent as any).textMessage.text;
        }
        else if (messageContent.imageMessage) {
          messageText = `[Image]${messageContent.imageMessage.caption ? ': ' + messageContent.imageMessage.caption : ''}`;
        }
        else if (messageContent.videoMessage) {
          messageText = `[Video]${messageContent.videoMessage.caption ? ': ' + messageContent.videoMessage.caption : ''}`;
        }
        else if (messageContent.audioMessage) {
          messageText = "[Audio Message]";
        }
        else if (messageContent.documentMessage) {
          messageText = `[Document: ${messageContent.documentMessage.fileName}]${messageContent.documentMessage.caption ? ' - ' + messageContent.documentMessage.caption : ''}`;
        }
        else if (messageContent.stickerMessage) {
          messageText = "[Sticker]";
        }
        else if (messageContent.contactMessage) {
          messageText = `[Contact: ${(messageContent.contactMessage as any).displayName || 'Contact'}]`;
        }
        else if (messageContent.reactionMessage) {
          const emoji = (messageContent.reactionMessage as any).text;
          messageText = `[Reaction: ${emoji}]`;
        }
        else if (messageContent.quotedMessage) {
          messageText = "[Quoted Message]";
        }
        else {
          console.log("[MESSAGE-HANDLE] ⚠️ Unknown content type:", Object.keys(messageContent));
          messageText = "";
        }
      }
      
      // PRIORITY 2: Try alternate paths
      if (!messageText) {
        const altText = (msg as any).body || (msg as any).text || (msg as any).caption || "";
        if (altText) {
          messageText = altText;
        }
      }
      
      // PRIORITY 3: Last resort
      if (!messageText) {
        messageText = messageContent ? "[Message (No Text)]" : "[Message received]";
      }

      console.log(`[MESSAGE] ✓ RECEIVED Session: ${sessionId}, Contact: ${contactNumber}, Text: ${messageText.substring(0, 100)}`);

      // Get or create conversation - with duplicate prevention
      let conversation: any = null;
      
      try {
        const existingConversations = await storage.getConversationsBySessionId(sessionId);
        conversation = existingConversations.find((c) => c.contactNumber === contactNumber);
      } catch (e) {
        console.error("[MESSAGE] Error fetching conversations:", e);
      }

      if (!conversation) {
        try {
          conversation = await storage.createConversation({
            sessionId,
            contactName,
            contactNumber,
            lastMessage: messageText,
            lastMessageTime: new Date(),
            unreadCount: 1,
          });
          console.log(`[MESSAGE] Created new conversation: ${conversation.id}`);
        } catch (e) {
          console.error("[MESSAGE] Error creating conversation:", e);
          // Try to find it again in case another request just created it
          const retryConvs = await storage.getConversationsBySessionId(sessionId);
          conversation = retryConvs.find((c) => c.contactNumber === contactNumber);
          if (!conversation) throw e;
        }
      } else {
        try {
          await storage.updateConversation(conversation.id, {
            lastMessage: messageText,
            lastMessageTime: new Date(),
            unreadCount: (conversation.unreadCount || 0) + 1,
          });
        } catch (e) {
          console.error("[MESSAGE] Error updating conversation:", e);
        }
      }

      // Always create message with content - preserve fromMe flag!
      try {
        const isFromMe = messageKey.fromMe === true;
        await storage.createMessage({
          conversationId: conversation.id,
          content: messageText,
          fromMe: isFromMe,
          timestamp: new Date(messageKey.timestamp ? messageKey.timestamp * 1000 : Date.now()),
          status: isFromMe ? "sent" : "delivered",
        });
        console.log(`[MESSAGE] Message saved (${isFromMe ? "SENT" : "RECEIVED"}): ${messageText.substring(0, 50)}`);
      } catch (e) {
        console.error("[MESSAGE] Error saving message:", e);
      }

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
