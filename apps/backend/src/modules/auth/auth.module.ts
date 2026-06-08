import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import type { JwtModuleOptions } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailService } from "./email.service";
import { JwtStrategy } from "./jwt.strategy";
import { SocialAuthSettingsService } from "./social-auth-settings.service";

type JwtExpiresIn = NonNullable<JwtModuleOptions["signOptions"]>["expiresIn"];

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const expiresIn = (config.get<string>("JWT_EXPIRES_IN") ??
          "1d") as JwtExpiresIn;

        return {
          secret:
            config.get<string>("JWT_SECRET") ?? "change_me_for_production",
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    JwtStrategy,
    SocialAuthSettingsService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
