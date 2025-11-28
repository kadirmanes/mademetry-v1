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

  /** Upload URL oluştur (sadece backend endpoint’i) */
  async getObjectEntityUploadURL() {
    const id = this.generateId();
    const remotePath = `${this.baseDir}/${id}`;

    return {
      uploadURL: `/api/objects/upload/${id}`,
      objectPath: remotePath,
    };
  }

  /** Dosyayı Nextcloud’a yükle */
  async uploadToNextcloud(id: string, fileBuffer: Buffer) {
    const remotePath = `${this.baseDir}/${id}`;
    const fullURL = `${this.baseURL}/remote.php/dav/files/${this.username}/${remotePath}`;

    await axios.put(fullURL, fileBuffer, {
      auth: { username: this.username, password: this.password },
      headers: { "Content-Type": "application/octet-stream" },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return remotePath;
  }

  /** Dosyayı Nextcloud'tan indir */
  async downloadObject(remotePath: string, res: Response) {
    const fullURL = `${this.baseURL}/remote.php/dav/files/${this.username}/${remotePath}`;

    try {
      const file = await axios.get(fullURL, {
        responseType: "arraybuffer",
        auth: { username: this.username, password: this.password },
      });

      res.setHeader("Content-Type", "application/octet-stream");
      res.send(file.data);
    } catch (e) {
      throw new ObjectNotFoundError();
    }
  }
}
