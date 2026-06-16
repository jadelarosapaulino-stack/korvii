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
import { RegisterDto } from "./dto/register.dto";

interface DecryptedLoginPayload {
  email?: unknown;
  password?: unknown;
}

interface DecryptedRegisterPayload extends DecryptedLoginPayload {
  fullName?: unknown;
  province?: unknown;
  municipality?: unknown;
  vehicleType?: unknown;
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

  decryptRegister(dto: RegisterDto): RegisterDto {
    if (!dto.encryptedPayload) return dto;
    if (dto.keyId !== this.keyId) {
      throw new BadRequestException("La llave de cifrado del registro expiro");
    }

    try {
      const payload = this.decryptPayload<DecryptedRegisterPayload>(
        dto.encryptedPayload,
      );

      if (
        typeof payload.fullName !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.password !== "string"
      ) {
        throw new Error("Invalid decrypted register payload");
      }

      return {
        fullName: payload.fullName.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        province:
          typeof payload.province === "string"
            ? payload.province.trim()
            : undefined,
        municipality:
          typeof payload.municipality === "string"
            ? payload.municipality.trim()
            : undefined,
        vehicleType:
          typeof payload.vehicleType === "string"
            ? payload.vehicleType.trim()
            : undefined,
      };
    } catch {
      throw new BadRequestException("No se pudo descifrar el registro");
    }
  }

  private decryptPayload<T>(encryptedPayload: string): T {
    const decrypted = privateDecrypt(
      {
        key: this.privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedPayload, "base64"),
    );

    return JSON.parse(decrypted.toString("utf8")) as T;
  }
}
