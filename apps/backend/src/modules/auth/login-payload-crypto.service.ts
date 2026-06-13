import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  constants,
} from "node:crypto";
import { LoginDto } from "./dto/login.dto";

interface DecryptedLoginPayload {
  email?: unknown;
  password?: unknown;
}

@Injectable()
export class LoginPayloadCryptoService {
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;
  private readonly keyId: string;

  constructor(config: ConfigService) {
    const configuredPrivateKey = config.get<string>("LOGIN_PAYLOAD_PRIVATE_KEY");

    if (configuredPrivateKey?.trim()) {
      this.privateKeyPem = configuredPrivateKey.replace(/\\n/g, "\n");
      this.publicKeyPem = createPublicKey(
        createPrivateKey(this.privateKeyPem),
      ).export({
        type: "spki",
        format: "pem",
      }) as string;
    } else {
      const keyPair = generateKeyPairSync("rsa", {
        modulusLength: 4096,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      this.privateKeyPem = keyPair.privateKey;
      this.publicKeyPem = keyPair.publicKey;
    }

    this.keyId = createHash("sha256")
      .update(this.publicKeyPem)
      .digest("hex")
      .slice(0, 16);
  }

  publicKey() {
    return {
      keyId: this.keyId,
      algorithm: "RSA-OAEP-256",
      publicKey: this.publicKeyPem,
    };
  }

  decrypt(dto: LoginDto): LoginDto {
    if (!dto.encryptedPayload) return dto;
    if (dto.keyId !== this.keyId) {
      throw new BadRequestException("La llave de cifrado del login expiro");
    }

    try {
      const decrypted = privateDecrypt(
        {
          key: this.privateKeyPem,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        Buffer.from(dto.encryptedPayload, "base64"),
      );
      const payload = JSON.parse(
        decrypted.toString("utf8"),
      ) as DecryptedLoginPayload;

      if (
        typeof payload.email !== "string" ||
        typeof payload.password !== "string"
      ) {
        throw new Error("Invalid decrypted login payload");
      }

      return {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      };
    } catch {
      throw new BadRequestException("No se pudo descifrar el login");
    }
  }
}
