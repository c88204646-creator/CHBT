import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  users,
  whatsappSessions,
  conversations,
  messages,
  chatbotRules,
  type User,
  type InsertUser,
  type WhatsappSession,
  type InsertWhatsappSession,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type ChatbotRule,
  type InsertChatbotRule,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // WhatsApp Sessions
  getWhatsappSession(id: string): Promise<WhatsappSession | undefined>;
  getWhatsappSessionsByUserId(userId: string): Promise<WhatsappSession[]>;
  createWhatsappSession(session: InsertWhatsappSession): Promise<WhatsappSession>;
  updateWhatsappSession(id: string, data: Partial<InsertWhatsappSession>): Promise<WhatsappSession | undefined>;
  deleteWhatsappSession(id: string): Promise<void>;

  // Conversations
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationsBySessionId(sessionId: string): Promise<Conversation[]>;
  getConversationsByUserId(userId: string): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<InsertConversation>): Promise<Conversation | undefined>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByConversationId(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Chatbot Rules
  getChatbotRule(id: string): Promise<ChatbotRule | undefined>;
  getChatbotRulesByUserId(userId: string): Promise<ChatbotRule[]>;
  createChatbotRule(rule: InsertChatbotRule): Promise<ChatbotRule>;
  updateChatbotRule(id: string, data: Partial<InsertChatbotRule>): Promise<ChatbotRule | undefined>;
  deleteChatbotRule(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // WhatsApp Sessions
  async getWhatsappSession(id: string): Promise<WhatsappSession | undefined> {
    const [session] = await db.select().from(whatsappSessions).where(eq(whatsappSessions.id, id));
    return session || undefined;
  }

  async getWhatsappSessionsByUserId(userId: string): Promise<WhatsappSession[]> {
    return await db.select().from(whatsappSessions).where(eq(whatsappSessions.userId, userId));
  }

  async createWhatsappSession(insertSession: InsertWhatsappSession): Promise<WhatsappSession> {
    const [session] = await db.insert(whatsappSessions).values(insertSession).returning();
    return session;
  }

  async updateWhatsappSession(id: string, data: Partial<InsertWhatsappSession>): Promise<WhatsappSession | undefined> {
    const [session] = await db
      .update(whatsappSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappSessions.id, id))
      .returning();
    return session || undefined;
  }

  async deleteWhatsappSession(id: string): Promise<void> {
    await db.delete(whatsappSessions).where(eq(whatsappSessions.id, id));
  }

  // Conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationsBySessionId(sessionId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.sessionId, sessionId))
      .orderBy(desc(conversations.lastMessageTime));
  }

  async getConversationsByUserId(userId: string): Promise<Conversation[]> {
    const userSessions = await this.getWhatsappSessionsByUserId(userId);
    const sessionIds = userSessions.map(s => s.id);
    
    if (sessionIds.length === 0) return [];
    
    const allConversations = await Promise.all(
      sessionIds.map(sessionId => this.getConversationsBySessionId(sessionId))
    );
    
    return allConversations.flat();
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db.insert(conversations).values(insertConversation).returning();
    return conversation;
  }

  async updateConversation(id: string, data: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set(data)
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  // Messages
  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async getMessagesByConversationId(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db.insert(messages).values(insertMessage).returning();
    return message;
  }

  // Chatbot Rules
  async getChatbotRule(id: string): Promise<ChatbotRule | undefined> {
    const [rule] = await db.select().from(chatbotRules).where(eq(chatbotRules.id, id));
    return rule || undefined;
  }

  async getChatbotRulesByUserId(userId: string): Promise<ChatbotRule[]> {
    return await db
      .select()
      .from(chatbotRules)
      .where(eq(chatbotRules.userId, userId))
      .orderBy(desc(chatbotRules.createdAt));
  }

  async createChatbotRule(insertRule: InsertChatbotRule): Promise<ChatbotRule> {
    const [rule] = await db.insert(chatbotRules).values(insertRule).returning();
    return rule;
  }

  async updateChatbotRule(id: string, data: Partial<InsertChatbotRule>): Promise<ChatbotRule | undefined> {
    const [rule] = await db
      .update(chatbotRules)
      .set(data)
      .where(eq(chatbotRules.id, id))
      .returning();
    return rule || undefined;
  }

  async deleteChatbotRule(id: string): Promise<void> {
    await db.delete(chatbotRules).where(eq(chatbotRules.id, id));
  }
}

export const storage = new DatabaseStorage();
