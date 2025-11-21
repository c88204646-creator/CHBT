import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  whatsappSessions: many(whatsappSessions),
  chatbotRules: many(chatbotRules),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type LoginCredentials = z.infer<typeof loginSchema>;

// WhatsApp Sessions table
export const whatsappSessions = pgTable("whatsapp_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceName: text("device_name"),
  phoneNumber: text("phone_number"),
  status: text("status").notNull().default("disconnected"), // disconnected, connecting, connected
  qrCode: text("qr_code"),
  sessionData: text("session_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const whatsappSessionsRelations = relations(whatsappSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [whatsappSessions.userId],
    references: [users.id],
  }),
  conversations: many(conversations),
  chatbotRules: many(chatbotRules),
}));

export const insertWhatsappSessionSchema = createInsertSchema(whatsappSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWhatsappSession = z.infer<typeof insertWhatsappSessionSchema>;
export type WhatsappSession = typeof whatsappSessions.$inferSelect;

// Conversations table
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => whatsappSessions.id, { onDelete: "cascade" }),
  contactName: text("contact_name").notNull(),
  contactNumber: text("contact_number").notNull(),
  lastMessage: text("last_message"),
  lastMessageTime: timestamp("last_message_time"),
  unreadCount: integer("unread_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  session: one(whatsappSessions, {
    fields: [conversations.sessionId],
    references: [whatsappSessions.id],
  }),
  messages: many(messages),
}));

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  fromMe: boolean("from_me").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull().default("sent"), // sent, delivered, read
});

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Chatbot Rules table
export const chatbotRules = pgTable("chatbot_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionId: varchar("session_id").references(() => whatsappSessions.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  response: text("response").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatbotRulesRelations = relations(chatbotRules, ({ one }) => ({
  user: one(users, {
    fields: [chatbotRules.userId],
    references: [users.id],
  }),
  session: one(whatsappSessions, {
    fields: [chatbotRules.sessionId],
    references: [whatsappSessions.id],
  }),
}));

export const insertChatbotRuleSchema = createInsertSchema(chatbotRules).omit({
  id: true,
  createdAt: true,
});

export type InsertChatbotRule = z.infer<typeof insertChatbotRuleSchema>;
export type ChatbotRule = typeof chatbotRules.$inferSelect;
