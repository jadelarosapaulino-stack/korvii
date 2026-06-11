import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { SystemConfigService } from "../system-config/system-config.service";

export interface SocialAuthSettings {
  googleClientId: string;
  facebookAppId: string;
  facebookAppSecret: string;
}

@Injectable()
export class SocialAuthSettingsService implements OnModuleInit {
  private static readonly CONFIG_KEY = "social_auth_settings";
  private readonly configPath: string;
  private current: SocialAuthSettings;

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.configPath = this.config.get<string>(
      "SOCIAL_AUTH_CONFIG_PATH",
      join(process.cwd(), ".tmp", "social-auth-config.json"),
    );
    this.current = this.defaultConfig();
  }

  async onModuleInit() {
    const defaults = this.defaultConfig();
    const stored = await this.systemConfig.loadValue(
      SocialAuthSettingsService.CONFIG_KEY,
      defaults,
      this.configPath,
    );
    this.current = this.sanitize(this.mergeWithDefaults(defaults, stored));
    await this.persist();
  }

  get(): SocialAuthSettings {
    return { ...this.current };
  }

  async update(
    patch: Partial<SocialAuthSettings>,
  ): Promise<SocialAuthSettings> {
    this.current = this.sanitize({ ...this.current, ...patch });
    await this.persist();
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

  private async persist() {
    await this.systemConfig.saveValue(
      SocialAuthSettingsService.CONFIG_KEY,
      this.current,
    );
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
      facebookAppSecret: String(config.facebookAppSecret || "").trim(),
    };
  }

  private mergeWithDefaults(
    defaults: SocialAuthSettings,
    stored: SocialAuthSettings,
  ): SocialAuthSettings {
    return {
      googleClientId: this.nonEmpty(stored.googleClientId, defaults.googleClientId),
      facebookAppId: this.nonEmpty(stored.facebookAppId, defaults.facebookAppId),
      facebookAppSecret: this.nonEmpty(
        stored.facebookAppSecret,
        defaults.facebookAppSecret,
      ),
    };
  }

  private nonEmpty(value: unknown, fallback: string): string {
    const normalized = String(value || "").trim();
    return normalized || fallback;
  }
}
