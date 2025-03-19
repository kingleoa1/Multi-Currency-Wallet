import { pgTable, text, serial, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true,
  createdAt: true
});

// Wallet schema
export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => users.id),
  name: text("name"),
  currency: text("currency").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ 
  id: true, 
  createdAt: true 
});

// Transaction schema
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => users.id),
  fromWalletId: serial("from_wallet_id").references(() => wallets.id),
  toWalletId: serial("to_wallet_id").references(() => wallets.id),
  type: text("type").notNull(), // "transfer", "conversion", "deposit", "withdrawal"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fromCurrency: text("from_currency"),
  toCurrency: text("to_currency"),
  rate: decimal("rate", { precision: 10, scale: 6 }),
  description: text("description"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  createdAt: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// Extended schemas for validation
export const loginUserSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerUserSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const addWalletSchema = insertWalletSchema.pick({
  currency: true,
  name: true,
});

export const transferFundsSchema = z.object({
  fromWalletId: z.number(),
  toWalletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().optional(),
});

export const convertCurrencySchema = z.object({
  fromWalletId: z.number(),
  toWalletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0"),
});

export const addFundsSchema = z.object({
  walletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0"),
});
