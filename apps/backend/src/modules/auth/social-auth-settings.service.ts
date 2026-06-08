import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface SocialAuthSettings {
  googleClientId: string;
  facebookAppId: string;
  facebookAppSecret: string;
}

@Injectable()
export class SocialAuthSettingsService {
  private readonly logger = new Logger(SocialAuthSettingsService.name);
  private readonly configPath: string;
  private current: SocialAuthSettings;

  constructor(private readonly config: ConfigService) {
    this.configPath = this.config.get<string>(
      "SOCIAL_AUTH_CONFIG_PATH",
      join(process.cwd(), ".tmp", "social-auth-config.json"),
    );
    this.current = this.load();
  }

  get(): SocialAuthSettings {
    return { ...this.current };
  }

  update(patch: Partial<SocialAuthSettings>): SocialAuthSettings {
    this.current = this.sanitize({ ...this.current, ...patch });
    this.persist();
    return this.get();
  }

  googleClientId(): string {
    return this.current.googleClientId;
  }

  facebookAppId(): string {
    return this.current.facebookAppId;
  }

  facebookAppSecret(): string {
    return this.current.facebookAppSecret;
  }

  private load(): SocialAuthSettings {
    if (!existsSync(this.configPath)) return this.defaultConfig();

    try {
      const stored = JSON.parse(
        readFileSync(this.configPath, "utf8"),
      ) as Partial<SocialAuthSettings>;
      return this.sanitize({ ...this.defaultConfig(), ...stored });
    } catch (error) {
      this.logger.warn(
        `No se pudo leer configuracion de login social: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.defaultConfig();
    }
  }

  private persist() {
    const directory = dirname(this.configPath);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    const persisted = {
      googleClientId: this.current.googleClientId,
      facebookAppId: this.current.facebookAppId,
    };
    writeFileSync(this.configPath, JSON.stringify(persisted, null, 2), "utf8");
  }

  private defaultConfig(): SocialAuthSettings {
    return {
      googleClientId: this.config.get<string>("GOOGLE_CLIENT_ID", "").trim(),
      facebookAppId: this.config.get<string>("FACEBOOK_APP_ID", "").trim(),
      facebookAppSecret: this.config
        .get<string>("FACEBOOK_APP_SECRET", "")
        .trim(),
    };
  }

  private sanitize(config: SocialAuthSettings): SocialAuthSettings {
    return {
      googleClientId: String(config.googleClientId || "").trim(),
      facebookAppId: String(config.facebookAppId || "").trim(),
      facebookAppSecret: this.config
        .get<string>("FACEBOOK_APP_SECRET", "")
        .trim(),
    };
  }
}
