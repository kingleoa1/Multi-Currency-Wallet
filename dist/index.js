// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users;
  wallets;
  transactions;
  userId;
  walletId;
  transactionId;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.wallets = /* @__PURE__ */ new Map();
    this.transactions = /* @__PURE__ */ new Map();
    this.userId = 1;
    this.walletId = 1;
    this.transactionId = 1;
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }
  async createUser(userData) {
    const id = this.userId++;
    const user = { ...userData, id, createdAt: /* @__PURE__ */ new Date() };
    this.users.set(id, user);
    return user;
  }
  // Wallet methods
  async getWallets(userId) {
    return Array.from(this.wallets.values()).filter((wallet) => wallet.userId === userId);
  }
  async getWallet(id) {
    return this.wallets.get(id);
  }
  async createWallet(walletData) {
    const id = this.walletId++;
    const wallet = {
      ...walletData,
      id,
      balance: walletData.balance ? walletData.balance : 0,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.wallets.set(id, wallet);
    return wallet;
  }
  async updateWalletBalance(id, balance) {
    const wallet = this.wallets.get(id);
    if (!wallet) return void 0;
    const updatedWallet = { ...wallet, balance };
    this.wallets.set(id, updatedWallet);
    return updatedWallet;
  }
  // Transaction methods
  async getTransactions(userId, limit) {
    const userTransactions = Array.from(this.transactions.values()).filter((transaction) => transaction.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }
  async getWalletTransactions(walletId, limit) {
    const walletTransactions = Array.from(this.transactions.values()).filter(
      (transaction) => transaction.fromWalletId === walletId || transaction.toWalletId === walletId
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? walletTransactions.slice(0, limit) : walletTransactions;
  }
  async createTransaction(transactionData) {
    const id = this.transactionId++;
    const transaction = {
      ...transactionData,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => users.id),
  name: text("name"),
  currency: text("currency").notNull(),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull().references(() => users.id),
  fromWalletId: serial("from_wallet_id").references(() => wallets.id),
  toWalletId: serial("to_wallet_id").references(() => wallets.id),
  type: text("type").notNull(),
  // "transfer", "conversion", "deposit", "withdrawal"
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  fromCurrency: text("from_currency"),
  toCurrency: text("to_currency"),
  rate: decimal("rate", { precision: 10, scale: 6 }),
  description: text("description"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true
});
var loginUserSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters")
});
var registerUserSchema = insertUserSchema.extend({
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});
var addWalletSchema = insertWalletSchema.pick({
  currency: true,
  name: true
});
var transferFundsSchema = z.object({
  fromWalletId: z.number(),
  toWalletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0"),
  description: z.string().optional()
});
var convertCurrencySchema = z.object({
  fromWalletId: z.number(),
  toWalletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0")
});
var addFundsSchema = z.object({
  walletId: z.number(),
  amount: z.number().positive("Amount must be greater than 0")
});

// server/routes.ts
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";
var exchangeRates = {
  USD: { EUR: 0.915, GBP: 0.79, USD: 1 },
  EUR: { USD: 1.093, GBP: 0.863, EUR: 1 },
  GBP: { USD: 1.266, EUR: 1.159, GBP: 1 }
};
var availableCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];
async function registerRoutes(app2) {
  const SessionStore = MemoryStore(session);
  app2.use(
    session({
      secret: "wiseguy-wallet-secret",
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 864e5
        // prune expired entries every 24h
      }),
      cookie: {
        maxAge: 24 * 60 * 60 * 1e3
        // 24 hours
      }
    })
  );
  app2.use(passport.initialize());
  app2.use(passport.session());
  const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  };
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
  const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Not authenticated" });
  };
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const validatedData = registerUserSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      const { email, password, name } = validatedData.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name
      });
      await storage.createWallet({
        userId: user.id,
        currency: "USD",
        name: "Primary",
        balance: 0,
        isPrimary: true
      });
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        return res.status(201).json({
          message: "Registration successful",
          user: { id: user.id, name: user.name, email: user.email }
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Server error during registration" });
    }
  });
  app2.post("/api/auth/login", (req, res, next) => {
    try {
      const validatedData = loginUserSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      passport.authenticate("local", (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: info.message || "Authentication failed" });
        }
        req.login(user, (err2) => {
          if (err2) {
            return next(err2);
          }
          return res.json({
            message: "Login successful",
            user: { id: user.id, name: user.name, email: user.email }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Server error during login" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logout successful" });
    });
  });
  app2.get("/api/auth/session", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user;
      return res.json({
        authenticated: true,
        user: { id: user.id, name: user.name, email: user.email }
      });
    }
    res.json({ authenticated: false });
  });
  app2.get("/api/wallets", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const wallets2 = await storage.getWallets(user.id);
      res.json(wallets2);
    } catch (error) {
      console.error("Get wallets error:", error);
      res.status(500).json({ message: "Failed to fetch wallets" });
    }
  });
  app2.post("/api/wallets", isAuthenticated, async (req, res) => {
    try {
      const validatedData = addWalletSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      const user = req.user;
      const { currency, name } = validatedData.data;
      if (!availableCurrencies.includes(currency)) {
        return res.status(400).json({ message: "Invalid currency" });
      }
      const userWallets = await storage.getWallets(user.id);
      const existingWallet = userWallets.find((w) => w.currency === currency);
      if (existingWallet) {
        return res.status(400).json({ message: `You already have a ${currency} wallet` });
      }
      const newWallet = {
        userId: user.id,
        currency,
        name: name || currency,
        balance: 0,
        isPrimary: userWallets.length === 0
        // Make primary if it's the first wallet
      };
      const wallet = await storage.createWallet(newWallet);
      res.status(201).json(wallet);
    } catch (error) {
      console.error("Create wallet error:", error);
      res.status(500).json({ message: "Failed to create wallet" });
    }
  });
  app2.get("/api/wallets/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const walletId = parseInt(req.params.id);
      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      if (wallet.userId !== user.id) {
        return res.status(403).json({ message: "You do not have access to this wallet" });
      }
      const transactions2 = await storage.getWalletTransactions(walletId, 10);
      res.json({ wallet, transactions: transactions2 });
    } catch (error) {
      console.error("Get wallet error:", error);
      res.status(500).json({ message: "Failed to fetch wallet details" });
    }
  });
  app2.get("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const transactions2 = await storage.getTransactions(user.id, limit);
      res.json(transactions2);
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.post("/api/transfers", isAuthenticated, async (req, res) => {
    try {
      const validatedData = transferFundsSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      const user = req.user;
      const { fromWalletId, toWalletId, amount, description } = validatedData.data;
      const fromWallet = await storage.getWallet(fromWalletId);
      const toWallet = await storage.getWallet(toWalletId);
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ message: "One or both wallets not found" });
      }
      if (fromWallet.userId !== user.id || toWallet.userId !== user.id) {
        return res.status(403).json({ message: "You do not have access to these wallets" });
      }
      if (fromWallet.currency !== toWallet.currency) {
        return res.status(400).json({
          message: "Cannot transfer between different currencies. Use conversion instead."
        });
      }
      if (Number(fromWallet.balance) < amount) {
        return res.status(400).json({ message: "Insufficient funds in source wallet" });
      }
      const fromBalance = Number(fromWallet.balance) - amount;
      const toBalance = Number(toWallet.balance) + amount;
      await storage.updateWalletBalance(fromWalletId, fromBalance);
      await storage.updateWalletBalance(toWalletId, toBalance);
      const transaction = {
        userId: user.id,
        fromWalletId,
        toWalletId,
        type: "transfer",
        amount,
        fromCurrency: fromWallet.currency,
        toCurrency: toWallet.currency,
        description: description || "Transfer between wallets",
        status: "completed"
      };
      const newTransaction = await storage.createTransaction(transaction);
      res.status(201).json({
        message: "Transfer successful",
        transaction: newTransaction,
        fromWallet: await storage.getWallet(fromWalletId),
        toWallet: await storage.getWallet(toWalletId)
      });
    } catch (error) {
      console.error("Transfer error:", error);
      res.status(500).json({ message: "Failed to complete transfer" });
    }
  });
  app2.post("/api/conversions", isAuthenticated, async (req, res) => {
    try {
      const validatedData = convertCurrencySchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      const user = req.user;
      const { fromWalletId, toWalletId, amount } = validatedData.data;
      const fromWallet = await storage.getWallet(fromWalletId);
      const toWallet = await storage.getWallet(toWalletId);
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ message: "One or both wallets not found" });
      }
      if (fromWallet.userId !== user.id || toWallet.userId !== user.id) {
        return res.status(403).json({ message: "You do not have access to these wallets" });
      }
      if (Number(fromWallet.balance) < amount) {
        return res.status(400).json({ message: "Insufficient funds in source wallet" });
      }
      const rate = exchangeRates[fromWallet.currency]?.[toWallet.currency];
      if (!rate) {
        return res.status(400).json({ message: "Exchange rate not available for this pair" });
      }
      const convertedAmount = amount * rate;
      const fromBalance = Number(fromWallet.balance) - amount;
      const toBalance = Number(toWallet.balance) + convertedAmount;
      await storage.updateWalletBalance(fromWalletId, fromBalance);
      await storage.updateWalletBalance(toWalletId, toBalance);
      const transaction = {
        userId: user.id,
        fromWalletId,
        toWalletId,
        type: "conversion",
        amount,
        fromCurrency: fromWallet.currency,
        toCurrency: toWallet.currency,
        rate,
        description: `Converted ${fromWallet.currency} to ${toWallet.currency}`,
        status: "completed"
      };
      const newTransaction = await storage.createTransaction(transaction);
      res.status(201).json({
        message: "Conversion successful",
        transaction: newTransaction,
        fromWallet: await storage.getWallet(fromWalletId),
        toWallet: await storage.getWallet(toWalletId),
        rate,
        convertedAmount
      });
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ message: "Failed to complete conversion" });
    }
  });
  app2.post("/api/deposits", isAuthenticated, async (req, res) => {
    try {
      const validatedData = addFundsSchema.safeParse(req.body);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "Validation error",
          errors: validatedData.error.errors
        });
      }
      const user = req.user;
      const { walletId, amount } = validatedData.data;
      const wallet = await storage.getWallet(walletId);
      if (!wallet) {
        return res.status(404).json({ message: "Wallet not found" });
      }
      if (wallet.userId !== user.id) {
        return res.status(403).json({ message: "You do not have access to this wallet" });
      }
      const newBalance = Number(wallet.balance) + amount;
      await storage.updateWalletBalance(walletId, newBalance);
      const transaction = {
        userId: user.id,
        toWalletId: walletId,
        type: "deposit",
        amount,
        toCurrency: wallet.currency,
        description: "Added funds to wallet",
        status: "completed"
      };
      const newTransaction = await storage.createTransaction(transaction);
      res.status(201).json({
        message: "Deposit successful",
        transaction: newTransaction,
        wallet: await storage.getWallet(walletId)
      });
    } catch (error) {
      console.error("Deposit error:", error);
      res.status(500).json({ message: "Failed to add funds" });
    }
  });
  app2.get("/api/rates", async (req, res) => {
    try {
      res.json({
        rates: exchangeRates,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (error) {
      console.error("Get rates error:", error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(__dirname2, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
