import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupLocalAuth, isAuthenticated, hashPassword } from "./localAuth";
import { ObjectStorageService } from "./objectStorage";
import { insertQuoteSchema, updateQuoteStatusSchema, updateQuotePriceSchema, insertUserSchema, loginUserSchema } from "@shared/schema";
import { z } from "zod";
import passport from "passport";
import multer from "multer";

const upload = multer();

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

  // ... (Buradaki Register, Login, Logout kodları AYNI KALSIN) ...
  // ... (Yer kaplamasın diye kısalttım, sen silme sakın!) ...
  
  // (Buraya kadar olan kodlar aynı kalsın. Değişiklik aşağıda başlıyor)

  // -------------------------
  // USER REGISTER
  // -------------------------
  app.post('/api/register', async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = await hashPassword(validatedData.password);
      const user = await storage.createUser({
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        profileImageUrl: validatedData.profileImageUrl,
      });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Registration successful but login failed" });
        const { password, ...userWithoutPassword } = user; 
        res.json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error registering user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // -------------------------
  // LOGIN
  // -------------------------
  app.post('/api/login', (req, res, next) => {
    try {
      loginUserSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
    }
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) return res.status(500).json({ message: "Authentication failed" });
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed" });
        res.json(user);
      });
    })(req, res, next);
  });

  // -------------------------
  // LOGOUT
  // -------------------------
  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out successfully" });
    });
  });

  // -------------------------
  // CURRENT USER
  // -------------------------
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // -------------------------
  // CREATE UPLOAD ID
  // -------------------------
  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    try {
      const s = new ObjectStorageService();
      const { uploadURL, objectPath } = await s.getObjectEntityUploadURL();
      res.json({ uploadURL, objectPath });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // -------------------------
  // UPLOAD FILE (Manuel Okuma - Düzeltilmiş)
  // -------------------------
  app.put("/api/objects/upload/:id", isAuthenticated, async (req: any, res) => {
    try {
      console.log("✅ UPLOAD Başladı (PUT)...");
      const chunks: any[] = [];
      req.on('data', (chunk: any) => chunks.push(chunk));
      
      req.on('end', async () => {
        const fileBuffer = Buffer.concat(chunks);
        if (fileBuffer.length === 0) return res.status(400).json({ error: "Empty file" });

        try {
            const s = new ObjectStorageService();
            const remotePath = await s.uploadToNextcloud(req.params.id, fileBuffer);
            res.json({ message: "File uploaded", remotePath });
        } catch (ncError) {
            console.error("Nextcloud Error:", ncError);
            res.status(500).json({ error: "Nextcloud upload failed" });
        }
      });
    } catch (error) {
      console.error("Upload Error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // -------------------------
  // QUOTES
  // -------------------------
  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const filesSchema = z.object({
        files: z.array(z.object({
          uploadURL: z.string(),
          name: z.string(),
          size: z.number().optional(),
        })).min(1, "At least one file is required"),
      });
      const combinedSchema = insertQuoteSchema.merge(filesSchema);
      const validatedData = combinedSchema.parse(req.body);
      const { files, ...quoteData } = validatedData;
      const quote = await storage.createQuote({ ...quoteData, userId });
      
      const fileRecords = await Promise.all(
        files.map(async (file) => {
          return await storage.createQuoteFile({
            quoteId: quote.id,
            fileName: file.name,
            filePath: file.uploadURL.replace("/api/objects/upload/", "uploads/"),
            fileType: file.name.split('.').pop() || '',
            fileSize: file.size || 0,
          });
        })
      );
      const quoteWithFiles = await storage.getQuote(quote.id);
      res.json(quoteWithFiles);
    } catch (error) {
      console.error("Error creating quote:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const quotes = await storage.getQuotesByUser(req.user.id);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) return res.status(404).json({ error: "Quote not found" });
      const user = await storage.getUser(req.user.id);
      if (quote.userId !== req.user.id && user?.isAdmin !== 1) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // -------------------------
  // ADMIN
  // -------------------------
  app.get("/api/admin/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.isAdmin !== 1) return res.status(403).json({ error: "Forbidden" });
      const quotes = await storage.getAllQuotes();
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching all quotes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/quotes/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.isAdmin !== 1) return res.status(403).json({ error: "Forbidden" });
      const validatedData = updateQuoteStatusSchema.parse(req.body);
      const quote = await storage.updateQuoteStatus(req.params.id, validatedData.status, validatedData.notes);
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/admin/quotes/:id/price", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.isAdmin !== 1) return res.status(403).json({ error: "Forbidden" });
      const validatedData = updateQuotePriceSchema.parse(req.body);
      const quote = await storage.updateQuotePrice(req.params.id, validatedData.finalPrice);
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote price:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================================
  // 🔥🔥🔥 YENİ EKLENEN KISIM: İNDİRME ROTALARI 🔥🔥🔥
  // ============================================================

  // 1. Alternatif Rota: Frontend /uploads/UUID linki ürettiği için bunu yakalıyoruz.
  app.get("/uploads/:id", isAuthenticated, async (req: any, res) => {
    try {
      const fileId = req.params.id; // UUID (Örn: 1fe6...)
      const filename = req.query.filename as string;
      
      // Nextcloud'daki gerçek yol: uploads/UUID
      const objectPath = `uploads/${fileId}`; 
      const storage = new ObjectStorageService();
      
      // İndirilen dosyaya doğru ismini verelim
      if (filename) {
        // Türkçe karakterleri encode edelim ki bozulmasın
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      }

      await storage.downloadObject(objectPath, res);
    } catch (err) {
      console.error("Download error (/uploads):", err);
      return res.status(404).send("Not Found");
    }
  });

  // 2. Orijinal Rota (Yedek olarak kalsın)
  app.get("/objects/*", isAuthenticated, async (req: any, res) => {
    try {
      const objectPath = req.params[0];
      const storage = new ObjectStorageService();
      await storage.downloadObject(objectPath, res);
    } catch (err) {
      console.error("Download error (/objects):", err);
      return res.status(404).send("Not Found");
    }
  });

  // -------------------------
  // HTTP SERVER
  // -------------------------
  const httpServer = createServer(app);
  return httpServer;
}
