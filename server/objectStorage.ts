import axios from "axios";
import { randomUUID } from "crypto";
import { Response } from "express";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

export class ObjectStorageService {
  private baseURL: string;
  private username: string;
  private password: string;
  private baseDir: string;

  constructor() {
    this.baseURL = process.env.NEXTCLOUD_URL || "";
    this.username = process.env.NEXTCLOUD_USER || "";
    this.password = process.env.NEXTCLOUD_PASS || "";
    this.baseDir = process.env.NEXTCLOUD_BASE_PATH || "uploads";

    if (!this.baseURL || !this.username || !this.password) {
      throw new Error("Nextcloud credentials missing in .env");
    }
  }

  /** Unique ID üret */
  generateId() {
    return randomUUID();
  }

  /** Upload URL oluştur */
  async getObjectEntityUploadURL() {
    const id = this.generateId();
    const remotePath = `${this.baseDir}/${id}`;

    return {
      uploadURL: `/api/objects/upload/${id}`,
      objectPath: remotePath,
    };
  }

  /** Dosyayı Nextcloud’a yükle (LOGLU VERSİYON) */
  async uploadToNextcloud(id: string, fileBuffer: Buffer) {
    const remotePath = `${this.baseDir}/${id}`;
    // Not: WebDAV URL yapısı genelde şöyledir, senin env'den gelen URL'ye göre değişebilir.
    const fullURL = `${this.baseURL}/remote.php/dav/files/${this.username}/${remotePath}`;

    // --- DETEKTİF LOGLARI BAŞLIYOR ---
    console.log("------------------------------------------------");
    console.log("🚀 YÜKLEME BAŞLATILIYOR...");
    console.log("📍 Hedef URL:", fullURL);
    
    if (!fileBuffer) {
        console.error("❌ HATA: Dosya Buffer'ı YOK (Undefined)!");
        throw new Error("File buffer is missing");
    } else {
        console.log("📦 Dosya Boyutu:", fileBuffer.length, "byte");
    }
    // ---------------------------------

    try {
      const response = await axios.put(fullURL, fileBuffer, {
        auth: { username: this.username, password: this.password },
        headers: { "Content-Type": "application/octet-stream" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      // Başarılı olursa
      console.log("✅ Nextcloud Yanıtı:", response.status, response.statusText);
      console.log("------------------------------------------------");

      return remotePath;
    } catch (error: any) {
      // Hata olursa detayları dök
      console.error("❌ YÜKLEME BAŞARISIZ:", error.message);
      if (error.response) {
        console.error("🔍 Sunucu Kodu:", error.response.status);
        console.error("📄 Sunucu Mesajı:", JSON.stringify(error.response.data));
      } else {
        console.error("🔍 Hata Detayı:", error);
      }
      console.log("------------------------------------------------");
      throw error;
    }
  }

  /** Dosyayı Nextcloud'tan indir (LOGLU VERSİYON) */
  async downloadObject(remotePath: string, res: Response) {
    const fullURL = `${this.baseURL}/remote.php/dav/files/${this.username}/${remotePath}`;

    console.log("📥 İndirme İsteği:", fullURL);

    try {
      const file = await axios.get(fullURL, {
        responseType: "arraybuffer",
        auth: { username: this.username, password: this.password },
      });

      console.log("✅ İndirme Başarılı, boyut:", file.data.length);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(file.data);
    } catch (e: any) {
      // Hatayı yutmadan önce ne olduğunu görelim
      console.error("❌ İndirme Hatası:", e.message);
      if (e.response) {
        console.error("🔍 Hata Kodu:", e.response.status);
      }
      throw new ObjectNotFoundError();
    }
  }
}
