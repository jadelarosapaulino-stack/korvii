import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { ExternalApiLoggerService } from "../system-config/external-api-logger.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly externalApiLogger: ExternalApiLoggerService,
  ) {}

  async sendActivationCode(to: string, code: string) {
    await this.sendCode(
      to,
      "Codigo de activacion - Korvi",
      code,
      "activar tu cuenta",
    );
  }

  async sendPasswordResetCode(to: string, code: string) {
    await this.sendCode(
      to,
      "Codigo de recuperacion - Korvi",
      code,
      "recuperar tu contrasena",
    );
  }

  private async sendCode(
    to: string,
    subject: string,
    code: string,
    purpose: string,
  ) {
    const text = [
      `Tu codigo para ${purpose} es: ${code}`,
      "Este codigo vence en 15 minutos.",
      "Si no solicitaste esta accion, puedes ignorar este mensaje.",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#102033">
        <h2>Korvi</h2>
        <p>Tu codigo para ${purpose} es:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>Este codigo vence en 15 minutos.</p>
        <p>Si no solicitaste esta accion, puedes ignorar este mensaje.</p>
      </div>
    `;

    const host = this.config.get<string>("SMTP_HOST");
    if (!host) {
      this.logger.warn(`SMTP no configurado. Codigo para ${to}: ${code}`);
      return;
    }

    const port = this.config.get<number>("SMTP_PORT", 587);
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASSWORD");
    const from = this.config.get<string>(
      "SMTP_FROM",
      "Korvi <no-reply@korvi.local>",
    );

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    try {
      await transporter.sendMail({ from, to, subject, text, html });
    } catch (error) {
      await this.externalApiLogger.recordException({
        provider: "SMTP",
        service: host,
        operation: `send email (${purpose})`,
        error,
        message: "No se pudo enviar correo por SMTP",
      });
      throw error;
    }
  }
}
