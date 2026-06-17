import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { randomBytes, randomInt } from "node:crypto";
import { UserRole } from "../../common/enums/user-role.enum";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { ExternalApiLoggerService } from "../system-config/external-api-logger.service";
import { UsersService } from "../users/users.service";
import { ActivateAccountDto } from "./dto/activate-account.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestCodeDto } from "./dto/request-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SocialAuthDto } from "./dto/social-auth.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { EmailService } from "./email.service";
import { LoginPayloadCryptoService } from "./login-payload-crypto.service";
import {
  SocialAuthSettings,
  SocialAuthSettingsService,
} from "./social-auth-settings.service";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
  province?: string;
  municipality?: string;
  vehicleType?: string;
  institution?: {
    id: string;
    name: string;
    type: string;
    province?: string;
    municipality?: string;
  } | null;
  institutionRole?: string;
  createdAt?: Date;
  updatedAt?: Date;
  contributions?: {
    totalReports: number;
    pendingReports: number;
    validatedReports: number;
    inProgressReports: number;
    resolvedReports: number;
    rejectedReports: number;
    duplicateReports: number;
    highRiskReports: number;
    recentReports: Array<Record<string, unknown>>;
  };
  education?: {
    points: number;
    completedLessons: number;
    lessonsInProgress: number;
    averageScore: number;
    recentProgress: Array<Record<string, unknown>>;
  };
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

export interface PendingActivationResponse {
  requiresActivation: true;
  email: string;
  message: string;
}

interface SocialProfile {
  provider: "google" | "facebook";
  providerUserId: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly socialAuthSettings: SocialAuthSettingsService,
    private readonly loginPayloadCrypto: LoginPayloadCryptoService,
    private readonly externalApiLogger: ExternalApiLoggerService,
  ) {}

  async register(dto: RegisterDto): Promise<PendingActivationResponse> {
    const registration = this.loginPayloadCrypto.decryptRegister(dto);
    if (
      !registration.fullName?.trim() ||
      !registration.email?.trim() ||
      !registration.password ||
      registration.password.length < 8
    ) {
      throw new BadRequestException("Datos de registro invalidos");
    }

    const existing = await this.usersService.findByEmailWithPassword(
      registration.email,
    );
    if (existing) throw new ConflictException("El correo ya esta registrado");

    const passwordHash = await bcrypt.hash(registration.password, 12);
    const activationCode = this.generateCode();
    const user = await this.usersService.create({
      fullName: registration.fullName,
      email: registration.email,
      passwordHash,
      role: UserRole.CITIZEN,
      province: registration.province,
      municipality: registration.municipality,
      vehicleType: registration.vehicleType,
      isActive: false,
      activationCodeHash: await bcrypt.hash(activationCode, 12),
      activationCodeExpiresAt: this.codeExpiration(),
    });

    await this.emailService.sendActivationCode(user.email, activationCode);
    return {
      requiresActivation: true,
      email: user.email,
      message:
        "Cuenta creada. Revisa tu correo e ingresa el codigo de activacion.",
    };
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const credentials = this.loginPayloadCrypto.decrypt(dto);
    if (!credentials.email || !credentials.password) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const user = await this.usersService.findByEmailWithPassword(
      credentials.email,
    );
    if (!user) throw new UnauthorizedException("Credenciales invalidas");
    if (!user.isActive)
      throw new UnauthorizedException("La cuenta esta pendiente de activacion");

    const valid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Credenciales invalidas");

    return this.issueToken(user.id);
  }

  async socialLogin(dto: SocialAuthDto): Promise<AuthSession> {
    if (!this.socialProviderEnabled(dto.provider)) {
      throw new BadRequestException(
        `El acceso con ${dto.provider === "google" ? "Google" : "Facebook"} esta desactivado`,
      );
    }

    const profile =
      dto.provider === "google"
        ? await this.verifyGoogleToken(dto.token)
        : await this.verifyFacebookToken(dto.token);

    if (!profile.email || !profile.emailVerified) {
      throw new UnauthorizedException(
        "El proveedor no confirmo un correo valido",
      );
    }

    const existing = await this.usersService.findByEmail(profile.email);
    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true;
        existing.activatedAt = existing.activatedAt ?? new Date();
        await this.usersService.save(existing);
      }
      return this.issueToken(existing.id);
    }

    const user = await this.usersService.create({
      fullName: profile.fullName,
      email: profile.email,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 12),
      role: UserRole.CITIZEN,
      isActive: true,
      activatedAt: new Date(),
    });

    return this.issueToken(user.id);
  }

  socialAuthConfig() {
    return {
      google: this.socialProviderEnabled("google"),
      googleClientId: this.socialAuthSettings.googleClientId(),
      googleConfigured: Boolean(this.socialAuthSettings.googleClientId()),
      facebook: this.socialProviderEnabled("facebook"),
      facebookAppId: this.socialAuthSettings.facebookAppId(),
      facebookConfigured: Boolean(
        this.socialAuthSettings.facebookAppId() &&
          this.socialAuthSettings.facebookAppSecret(),
      ),
    };
  }

  socialAuthSettingsConfig() {
    const settings = this.socialAuthSettings.get();
    return {
      googleClientId: settings.googleClientId,
      facebookAppId: settings.facebookAppId,
      facebookAppSecret: "",
      facebookAppSecretConfigured: Boolean(settings.facebookAppSecret),
    };
  }

  updateSocialAuthSettings(
    patch: Partial<SocialAuthSettings>,
  ): Promise<SocialAuthSettings> {
    return this.socialAuthSettings.update(patch);
  }

  async activateAccount(dto: ActivateAccountDto): Promise<AuthSession> {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user || !user.activationCodeHash)
      throw new BadRequestException("Codigo de activacion invalido");
    if (
      !user.activationCodeExpiresAt ||
      user.activationCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException("El codigo de activacion expiro");
    }

    const valid = await bcrypt.compare(dto.code, user.activationCodeHash);
    if (!valid) throw new BadRequestException("Codigo de activacion invalido");

    user.isActive = true;
    user.activatedAt = new Date();
    user.activationCodeHash = null;
    user.activationCodeExpiresAt = null;
    await this.usersService.save(user);
    return this.issueToken(user.id);
  }

  async resendActivationCode(dto: RequestCodeDto) {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user) return this.genericCodeResponse();
    if (user.isActive) return { message: "La cuenta ya esta activa." };

    const code = this.generateCode();
    user.activationCodeHash = await bcrypt.hash(code, 12);
    user.activationCodeExpiresAt = this.codeExpiration();
    await this.usersService.save(user);
    await this.emailService.sendActivationCode(user.email, code);
    return this.genericCodeResponse();
  }

  async requestPasswordReset(dto: RequestCodeDto) {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user || !user.isActive) return this.genericCodeResponse();

    const code = this.generateCode();
    user.passwordResetCodeHash = await bcrypt.hash(code, 12);
    user.passwordResetCodeExpiresAt = this.codeExpiration();
    await this.usersService.save(user);
    await this.emailService.sendPasswordResetCode(user.email, code);
    return this.genericCodeResponse();
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmailWithSecrets(dto.email);
    if (!user || !user.passwordResetCodeHash)
      throw new BadRequestException("Codigo de recuperacion invalido");
    if (
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException("El codigo de recuperacion expiro");
    }

    const valid = await bcrypt.compare(dto.code, user.passwordResetCodeHash);
    if (!valid)
      throw new BadRequestException("Codigo de recuperacion invalido");

    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.passwordResetCodeHash = null;
    user.passwordResetCodeExpiresAt = null;
    await this.usersService.save(user);
    return { message: "Contrasena actualizada correctamente." };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const profile = await this.usersService.findById(userId);
    const user = await this.usersService.findByEmailWithPassword(profile.email);
    if (!user) throw new UnauthorizedException("Usuario no encontrado");

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid)
      throw new UnauthorizedException("La contrasena actual no es correcta");

    await this.usersService.updatePassword(
      user.id,
      await bcrypt.hash(dto.newPassword, 12),
    );
    return { message: "Contrasena actualizada correctamente." };
  }

  toAuthUser(user: AuthUser): AuthUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      province: user.province,
      municipality: user.municipality,
      vehicleType: user.vehicleType,
      institution: user.institution,
      institutionRole: user.institutionRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      contributions: user.contributions,
      education: user.education,
    };
  }

  getProfile(userId: string) {
    return this.usersService.getProfile(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.usersService.updateProfile(userId, dto);
    return this.getProfile(userId);
  }

  private async issueToken(userId: string): Promise<AuthSession> {
    const user = await this.usersService.getProfile(userId);
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      accessToken,
      user: this.toAuthUser(user),
    };
  }

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private codeExpiration(): Date {
    return new Date(Date.now() + 15 * 60 * 1000);
  }

  private genericCodeResponse() {
    return {
      message:
        "Si el correo existe, se enviara un codigo en los proximos minutos.",
    };
  }

  private socialProviderEnabled(provider: "google" | "facebook"): boolean {
    return this.featureFlags.isEnabled(`auth-${provider}`);
  }

  private async verifyGoogleToken(idToken: string): Promise<SocialProfile> {
    const clientId = this.socialAuthSettings.googleClientId();
    if (!clientId)
      throw new BadRequestException("GOOGLE_CLIENT_ID no esta configurado");

    const response = await this.fetchExternal(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      undefined,
      {
        provider: "Google",
        service: "OAuth Token Info",
        operation: "verify social login token",
      },
    );
    if (!response.ok) {
      await this.recordExternalHttpFailure(response, {
        provider: "Google",
        service: "OAuth Token Info",
        operation: "verify social login token",
      });
      throw new UnauthorizedException("Token de Google invalido");
    }

    const data = (await response.json()) as Record<string, string | undefined>;
    if (data.aud !== clientId)
      throw new UnauthorizedException(
        "Token de Google no pertenece a esta aplicacion",
      );
    if (!data.sub || !data.email)
      throw new UnauthorizedException("Google no devolvio un perfil valido");

    return {
      provider: "google",
      providerUserId: data.sub,
      email: data.email,
      fullName: data.name || data.email.split("@")[0],
      emailVerified: data.email_verified === "true",
    };
  }

  private async verifyFacebookToken(
    accessToken: string,
  ): Promise<SocialProfile> {
    const appId = this.socialAuthSettings.facebookAppId();
    const appSecret = this.socialAuthSettings.facebookAppSecret();

    if (appId && appSecret) {
      const appAccessToken = `${appId}|${appSecret}`;
      const debugUrl =
        `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
        `&access_token=${encodeURIComponent(appAccessToken)}`;
      const debugResponse = await this.fetchExternal(debugUrl, undefined, {
        provider: "Facebook",
        service: "Graph API",
        operation: "debug social login token",
      });
      if (!debugResponse.ok) {
        await this.recordExternalHttpFailure(debugResponse, {
          provider: "Facebook",
          service: "Graph API",
          operation: "debug social login token",
        });
        throw new UnauthorizedException("Token de Facebook invalido");
      }

      const debugData = (await debugResponse.json()) as {
        data?: { app_id?: string; is_valid?: boolean };
      };
      if (!debugData.data?.is_valid || debugData.data.app_id !== appId) {
        throw new UnauthorizedException(
          "Token de Facebook no pertenece a esta aplicacion",
        );
      }
    }

    const profileUrl =
      "https://graph.facebook.com/me?fields=id,name,email" +
      `&access_token=${encodeURIComponent(accessToken)}`;
    const profileResponse = await this.fetchExternal(profileUrl, undefined, {
      provider: "Facebook",
      service: "Graph API",
      operation: "fetch social profile",
    });
    if (!profileResponse.ok) {
      await this.recordExternalHttpFailure(profileResponse, {
        provider: "Facebook",
        service: "Graph API",
        operation: "fetch social profile",
      });
      throw new UnauthorizedException("Token de Facebook invalido");
    }

    const data = (await profileResponse.json()) as Record<
      string,
      string | undefined
    >;
    if (!data.id || !data.email) {
      throw new UnauthorizedException(
        "Facebook no devolvio un correo. Verifica el permiso email.",
      );
    }

    return {
      provider: "facebook",
      providerUserId: data.id,
      email: data.email,
      fullName: data.name || data.email.split("@")[0],
      emailVerified: true,
    };
  }

  private async fetchExternal(
    url: string,
    init: RequestInit | undefined,
    context: {
      provider: string;
      service: string;
      operation: string;
    },
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      await this.externalApiLogger.recordException({
        ...context,
        error,
        message: `${context.provider} no disponible`,
      });
      throw error;
    }
  }

  private async recordExternalHttpFailure(
    response: Response,
    context: {
      provider: string;
      service: string;
      operation: string;
    },
  ) {
    await this.externalApiLogger.recordHttpFailure({
      ...context,
      response: response.clone(),
    });
  }
}
