import {
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

export type UploadFolder = "avatars" | "education" | "reports";

@Injectable()
export class StorageService {
  private readonly s3Client?: S3Client;
  private readonly driver: "local" | "s3";

  constructor(private readonly config: ConfigService) {
    this.driver =
      this.config.get<string>("STORAGE_DRIVER", "local").toLowerCase() === "s3"
        ? "s3"
        : "local";

    if (this.driver === "s3") {
      this.s3Client = new S3Client({
        region: this.config.get<string>("STORAGE_S3_REGION", "us-east-1"),
        endpoint: this.config.get<string>("STORAGE_S3_ENDPOINT") || undefined,
        forcePathStyle:
          this.config.get<string>("STORAGE_S3_FORCE_PATH_STYLE", "false") ===
          "true",
        credentials: {
          accessKeyId: this.config.getOrThrow<string>(
            "STORAGE_S3_ACCESS_KEY_ID",
          ),
          secretAccessKey: this.config.getOrThrow<string>(
            "STORAGE_S3_SECRET_ACCESS_KEY",
          ),
        },
      });
    }
  }

  async uploadPublicFile(
    folder: UploadFolder,
    file: Express.Multer.File,
  ): Promise<string> {
    const filename = this.safeFilename(file.originalname);
    const key = `${folder}/${filename}`;

    if (this.driver === "s3") {
      return this.uploadToS3(key, file);
    }

    return this.uploadToLocal(folder, filename, file);
  }

  private async uploadToS3(
    key: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const bucket = this.config.getOrThrow<string>("STORAGE_S3_BUCKET");
    const acl = this.config.get<string>(
      "STORAGE_S3_ACL",
      "public-read",
    ) as ObjectCannedACL;

    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: "public, max-age=31536000, immutable",
        ACL: acl || undefined,
      }),
    );

    const publicBaseUrl = this.config.get<string>("STORAGE_PUBLIC_BASE_URL");
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
    }

    const endpoint = this.config.get<string>("STORAGE_S3_ENDPOINT");
    if (endpoint) {
      return `${endpoint.replace(/\/+$/, "")}/${bucket}/${key}`;
    }

    const region = this.config.get<string>("STORAGE_S3_REGION", "us-east-1");
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private async uploadToLocal(
    folder: UploadFolder,
    filename: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const directory = join(process.cwd(), "uploads", folder);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });

    await writeFile(join(directory, filename), file.buffer);
    return `/uploads/${folder}/${filename}`;
  }

  private safeFilename(originalName: string) {
    const extension = extname(originalName).toLowerCase();
    return `${Date.now()}-${randomUUID()}${extension}`;
  }
}
