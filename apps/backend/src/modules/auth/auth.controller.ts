import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags } from "@nestjs/swagger";
import type { Express } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { UserRole } from "../../common/enums/user-role.enum";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ImageModerationService } from "../../common/moderation/image-moderation.service";
import { StorageService } from "../../common/storage/storage.service";
import { AuthService } from "./auth.service";
import { ActivateAccountDto } from "./dto/activate-account.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { RequestCodeDto } from "./dto/request-code.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SocialAuthDto } from "./dto/social-auth.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

const allowedAvatarMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly imageModeration: ImageModerationService,
    private readonly storage: StorageService,
  ) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("social")
  socialLogin(@Body() dto: SocialAuthDto) {
    return this.authService.socialLogin(dto);
  }

  @Get("social/config")
  socialAuthConfig() {
    return this.authService.socialAuthConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Get("social/settings")
  socialAuthSettings() {
    return this.authService.socialAuthSettingsConfig();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @Patch("social/settings")
  updateSocialAuthSettings(
    @Body()
    dto: {
      googleClientId?: string;
      facebookAppId?: string;
    },
  ) {
    return this.authService.updateSocialAuthSettings(dto);
  }

  @Post("activate")
  activate(@Body() dto: ActivateAccountDto) {
    return this.authService.activateAccount(dto);
  }

  @Post("activation-code")
  resendActivationCode(@Body() dto: RequestCodeDto) {
    return this.authService.resendActivationCode(dto);
  }

  @Post("password/forgot")
  forgotPassword(@Body() dto: RequestCodeDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post("password/reset")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("password/change")
  changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me")
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, callback) => {
        if (!allowedAvatarMimeTypes.has(file.mimetype)) {
          callback(
            new BadRequestException(
              "Solo se permiten imagenes JPG, PNG o WebP",
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile() avatar?: Express.Multer.File,
  ) {
    if (!avatar)
      throw new BadRequestException("La imagen del avatar es requerida");

    await this.imageModeration.assertAllowed(avatar, "avatar");
    const avatarUrl = await this.storage.uploadPublicFile("avatars", avatar);
    return this.authService.updateProfile(user.id, {
      avatarUrl,
      avatarPreset: "photo",
    });
  }
}
