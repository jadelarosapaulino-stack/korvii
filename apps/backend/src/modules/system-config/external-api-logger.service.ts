import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SystemConfigEntry } from "./system-config.entity";
import type { ExternalApiLogEntry } from "./system-config.service";

export type ExternalApiLogInput = Omit<
  ExternalApiLogEntry,
  "id" | "createdAt"
>;

@Injectable()
export class ExternalApiLoggerService {
  private static readonly EXTERNAL_API_LOGS_KEY = "external_api_logs";
  private static readonly MAX_EXTERNAL_API_LOGS = 200;
  private readonly logger = new Logger(ExternalApiLoggerService.name);

  constructor(
    @InjectRepository(SystemConfigEntry)
    private readonly configRepo: Repository<SystemConfigEntry>,
  ) {}

  async record(input: ExternalApiLogInput): Promise<void> {
    const entry: ExternalApiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ...input,
      details: input.details ? this.sanitizeDetails(input.details) : undefined,
    };

    try {
      const stored = await this.configRepo.findOne({
        where: { key: ExternalApiLoggerService.EXTERNAL_API_LOGS_KEY },
      });
      const current = Array.isArray(stored?.value?.["logs"])
        ? (stored.value["logs"] as ExternalApiLogEntry[])
        : [];
      const logs = [entry, ...current].slice(
        0,
        ExternalApiLoggerService.MAX_EXTERNAL_API_LOGS,
      );

      await this.configRepo.save(
        this.configRepo.create({
          key: ExternalApiLoggerService.EXTERNAL_API_LOGS_KEY,
          value: { logs },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar error de API externa: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async recordHttpFailure(input: {
    provider: string;
    service: string;
    operation: string;
    response: Response;
    message?: string;
    details?: string;
  }): Promise<void> {
    const details = input.details ?? (await this.safeResponseText(input.response));
    await this.record({
      provider: input.provider,
      service: input.service,
      operation: input.operation,
      status: input.response.status,
      message:
        input.message ??
        `${input.provider} respondio HTTP ${input.response.status}`,
      details,
    });
  }

  async recordException(input: {
    provider: string;
    service: string;
    operation: string;
    error: unknown;
    message?: string;
  }): Promise<void> {
    await this.record({
      provider: input.provider,
      service: input.service,
      operation: input.operation,
      message: input.message ?? `${input.provider} no disponible`,
      details: this.errorDetails(input.error),
    });
  }

  async safeResponseText(response: Response): Promise<string | undefined> {
    try {
      const text = await response.text();
      return text || undefined;
    } catch {
      return undefined;
    }
  }

  private errorDetails(error: unknown): string {
    if (error instanceof Error) {
      return [error.name, error.message].filter(Boolean).join(": ");
    }
    return String(error);
  }

  private sanitizeDetails(value: string): string {
    return value
      .replace(/(sk-[A-Za-z0-9_-]+)/g, "[redacted]")
      .replace(/([?&](?:key|access_token|api_key|token)=)[^&\s]+/gi, "$1[redacted]")
      .slice(0, 1600);
  }
}
