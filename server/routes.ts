import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginUserSchema,
  registerUserSchema,
  addWalletSchema,
  transferFundsSchema,
  convertCurrencySchema,
  addFundsSchema,
  type InsertUser,
  type InsertWallet,
  type InsertTransaction
} from "@shared/schema";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import MemoryStore from "memorystore";

// Exchange rates (simulated) - would use an external API in production
const exchangeRates = {
  USD: { EUR: 0.915, GBP: 0.79, USD: 1 },
  EUR: { USD: 1.093, GBP: 0.863, EUR: 1 },
  GBP: { USD: 1.266, EUR: 1.159, GBP: 1 },
};

const availableCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];

export async function registerRoutes(app: Express): Promise<Server> {
  const SessionStore = MemoryStore(session);

  // Session setup
  app.use(
    session({
      secret: 'wiseguy-wallet-secret',
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }
    })
  );

  // Passport initialization
  app.use(passport.initialize());
  app.use(passport.session());

  // Password hashing helper
  const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  };

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth middleware
  const isAuthenticated = (req: Request, res: Response, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'Not authenticated' });
  };

  // AUTH ROUTES
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerUserSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      const { email, password, name } = validatedData.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name
      });
      
      // Create default USD wallet
      await storage.createWallet({
        userId: user.id,
        currency: 'USD',
        name: 'Primary',
        balance: 0,
        isPrimary: true
      });
      
      // Log in the user automatically
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed after registration' });
        }
        return res.status(201).json({ 
          message: 'Registration successful',
          user: { id: user.id, name: user.name, email: user.email }
        });
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      const validatedData = loginUserSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      passport.authenticate('local', (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: info.message || 'Authentication failed' });
        }
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          return res.json({ 
            message: 'Login successful',
            user: { id: user.id, name: user.name, email: user.email }
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error during login' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.json({ message: 'Logout successful' });
    });
  });

  app.get('/api/auth/session', (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as any;
      return res.json({ 
        authenticated: true,
        user: { id: user.id, name: user.name, email: user.email }
      });
    }
    res.json({ authenticated: false });
  });

  // WALLET ROUTES
  app.get('/api/wallets', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const wallets = await storage.getWallets(user.id);
      res.json(wallets);
    } catch (error) {
      console.error('Get wallets error:', error);
      res.status(500).json({ message: 'Failed to fetch wallets' });
    }
  });

  app.post('/api/wallets', isAuthenticated, async (req, res) => {
    try {
      const validatedData = addWalletSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      const user = req.user as any;
      const { currency, name } = validatedData.data;
      
      // Check if currency is valid
      if (!availableCurrencies.includes(currency)) {
        return res.status(400).json({ message: 'Invalid currency' });
      }
      
      // Check if user already has a wallet with this currency
      const userWallets = await storage.getWallets(user.id);
      const existingWallet = userWallets.find(w => w.currency === currency);
      
      if (existingWallet) {
        return res.status(400).json({ message: `You already have a ${currency} wallet` });
      }
      
      const newWallet: InsertWallet = {
        userId: user.id,
        currency,
        name: name || currency,
        balance: 0,
        isPrimary: userWallets.length === 0 // Make primary if it's the first wallet
      };
      
      const wallet = await storage.createWallet(newWallet);
      res.status(201).json(wallet);
    } catch (error) {
      console.error('Create wallet error:', error);
      res.status(500).json({ message: 'Failed to create wallet' });
    }
  });

  app.get('/api/wallets/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const walletId = parseInt(req.params.id);
      
      const wallet = await storage.getWallet(walletId);
      
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      if (wallet.userId !== user.id) {
        return res.status(403).json({ message: 'You do not have access to this wallet' });
      }
      
      const transactions = await storage.getWalletTransactions(walletId, 10);
      res.json({ wallet, transactions });
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({ message: 'Failed to fetch wallet details' });
    }
  });

  // TRANSACTION ROUTES
  app.get('/api/transactions', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      const transactions = await storage.getTransactions(user.id, limit);
      res.json(transactions);
    } catch (error) {
      console.error('Get transactions error:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  // TRANSFER FUNDS
  app.post('/api/transfers', isAuthenticated, async (req, res) => {
    try {
      const validatedData = transferFundsSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      const user = req.user as any;
      const { fromWalletId, toWalletId, amount, description } = validatedData.data;
      
      // Check if wallets exist and belong to user
      const fromWallet = await storage.getWallet(fromWalletId);
      const toWallet = await storage.getWallet(toWalletId);
      
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ message: 'One or both wallets not found' });
      }
      
      if (fromWallet.userId !== user.id || toWallet.userId !== user.id) {
        return res.status(403).json({ message: 'You do not have access to these wallets' });
      }
      
      // Check if currencies are the same
      if (fromWallet.currency !== toWallet.currency) {
        return res.status(400).json({ 
          message: 'Cannot transfer between different currencies. Use conversion instead.' 
        });
      }
      
      // Check if source wallet has enough funds
      if (Number(fromWallet.balance) < amount) {
        return res.status(400).json({ message: 'Insufficient funds in source wallet' });
      }
      
      // Update wallet balances
      const fromBalance = Number(fromWallet.balance) - amount;
      const toBalance = Number(toWallet.balance) + amount;
      
      await storage.updateWalletBalance(fromWalletId, fromBalance);
      await storage.updateWalletBalance(toWalletId, toBalance);
      
      // Create transaction record
      const transaction: InsertTransaction = {
        userId: user.id,
        fromWalletId,
        toWalletId,
        type: 'transfer',
        amount,
        fromCurrency: fromWallet.currency,
        toCurrency: toWallet.currency,
        description: description || 'Transfer between wallets',
        status: 'completed'
      };
      
      const newTransaction = await storage.createTransaction(transaction);
      
      res.status(201).json({
        message: 'Transfer successful',
        transaction: newTransaction,
        fromWallet: await storage.getWallet(fromWalletId),
        toWallet: await storage.getWallet(toWalletId)
      });
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(500).json({ message: 'Failed to complete transfer' });
    }
  });

  // CONVERT CURRENCY
  app.post('/api/conversions', isAuthenticated, async (req, res) => {
    try {
      const validatedData = convertCurrencySchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      const user = req.user as any;
      const { fromWalletId, toWalletId, amount } = validatedData.data;
      
      // Check if wallets exist and belong to user
      const fromWallet = await storage.getWallet(fromWalletId);
      const toWallet = await storage.getWallet(toWalletId);
      
      if (!fromWallet || !toWallet) {
        return res.status(404).json({ message: 'One or both wallets not found' });
      }
      
      if (fromWallet.userId !== user.id || toWallet.userId !== user.id) {
        return res.status(403).json({ message: 'You do not have access to these wallets' });
      }
      
      // Check if source wallet has enough funds
      if (Number(fromWallet.balance) < amount) {
        return res.status(400).json({ message: 'Insufficient funds in source wallet' });
      }
      
      // Get exchange rate
      const rate = exchangeRates[fromWallet.currency]?.[toWallet.currency];
      
      if (!rate) {
        return res.status(400).json({ message: 'Exchange rate not available for this pair' });
      }
      
      // Calculate converted amount
      const convertedAmount = amount * rate;
      
      // Update wallet balances
      const fromBalance = Number(fromWallet.balance) - amount;
      const toBalance = Number(toWallet.balance) + convertedAmount;
      
      await storage.updateWalletBalance(fromWalletId, fromBalance);
      await storage.updateWalletBalance(toWalletId, toBalance);
      
      // Create transaction record
      const transaction: InsertTransaction = {
        userId: user.id,
        fromWalletId,
        toWalletId,
        type: 'conversion',
        amount,
        fromCurrency: fromWallet.currency,
        toCurrency: toWallet.currency,
        rate,
        description: `Converted ${fromWallet.currency} to ${toWallet.currency}`,
        status: 'completed'
      };
      
      const newTransaction = await storage.createTransaction(transaction);
      
      res.status(201).json({
        message: 'Conversion successful',
        transaction: newTransaction,
        fromWallet: await storage.getWallet(fromWalletId),
        toWallet: await storage.getWallet(toWalletId),
        rate,
        convertedAmount
      });
    } catch (error) {
      console.error('Conversion error:', error);
      res.status(500).json({ message: 'Failed to complete conversion' });
    }
  });

  // ADD FUNDS (deposit)
  app.post('/api/deposits', isAuthenticated, async (req, res) => {
    try {
      const validatedData = addFundsSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validatedData.error.errors 
        });
      }
      
      const user = req.user as any;
      const { walletId, amount } = validatedData.data;
      
      // Check if wallet exists and belongs to user
      const wallet = await storage.getWallet(walletId);
      
      if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
      }
      
      if (wallet.userId !== user.id) {
        return res.status(403).json({ message: 'You do not have access to this wallet' });
      }
      
      // Update wallet balance
      const newBalance = Number(wallet.balance) + amount;
      await storage.updateWalletBalance(walletId, newBalance);
      
      // Create transaction record
      const transaction: InsertTransaction = {
        userId: user.id,
        toWalletId: walletId,
        type: 'deposit',
        amount,
        toCurrency: wallet.currency,
        description: 'Added funds to wallet',
        status: 'completed'
      };
      
      const newTransaction = await storage.createTransaction(transaction);
      
      res.status(201).json({
        message: 'Deposit successful',
        transaction: newTransaction,
        wallet: await storage.getWallet(walletId)
      });
    } catch (error) {
      console.error('Deposit error:', error);
      res.status(500).json({ message: 'Failed to add funds' });
    }
  });

  // Get currency rates
  app.get('/api/rates', async (req, res) => {
    try {
      res.json({
        rates: exchangeRates,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get rates error:', error);
      res.status(500).json({ message: 'Failed to fetch exchange rates' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
