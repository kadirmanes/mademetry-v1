import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

const SALT_ROUNDS = 10;

function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 7 gün
  
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
    pruneSessionInterval: 60 * 15, 
  });

  return session({
    secret: process.env.SESSION_SECRET || "default_dev_secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Apache arkasında olduğumuz için şart
    cookie: {
      httpOnly: true,
      
      // --- KRİTİK DEĞİŞİKLİK ---
      // secure: false yapıyoruz. Böylece SSL/HTTP karmaşasında
      // çerez kaybolmaz. Kesin çözüm budur.
      secure: false, 
      // -------------------------

      sameSite: "lax", // En uyumlu mod
      maxAge: sessionTtl,
    },
  });
}

// ... (Şifre fonksiyonları aynı kalacak) ...
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ... (Auth Setup aynı kalacak) ...
export async function setupLocalAuth(app: Express) {
  // Proxy'ye güven
  app.set("trust proxy", 1);

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password) {
            return done(null, false, { message: "Geçersiz e-posta veya şifre" });
          }
          const isValid = await verifyPassword(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Geçersiz e-posta veya şifre" });
          }
          const cleanUser = { ...user }; // (Burayı kısaltarak yazdım, senin kodun aynısı)
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUserById(id);
      return done(null, user || false);
    } catch (error) {
      return done(error);
    }
  });
}

// --- İŞTE O MESAJI VEREN YER ---
export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  // Giriş yapılmadıysa bu mesaj döner
  return res.status(401).json({ message: "Oturum açılmadı" });
};
