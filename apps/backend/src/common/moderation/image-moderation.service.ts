import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { Express } from "express";
import { Repository } from "typeorm";
import { SystemConfigEntry } from "../../modules/system-config/system-config.entity";

export type ImageModerationContext = "avatar" | "education" | "report";

interface OpenAiModerationResponse {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
}

interface ImageModerationDecision {
  allowed: boolean;
  blockedCategories: string[];
  scores: Record<string, number>;
}

interface ExternalApiLogEntry {
  id: string;
  provider: string;
  service: string;
  operation: string;
  status?: number;
  message: string;
  details?: string;
  createdAt: string;
}

const commonBlockedCategories = [
  "sexual",
  "sexual/minors",
  "self-harm",
  "self-harm/intent",
  "self-harm/instructions",
  "violence/graphic",
];

const blockedCategoriesByContext: Record<ImageModerationContext, string[]> = {
  avatar: [...commonBlockedCategories, "violence"],
  education: [...commonBlockedCategories, "violence"],
  report: commonBlockedCategories,
};

@Injectable()
export class ImageModerationService {
  private static readonly EXTERNAL_API_LOGS_KEY = "external_api_logs";
  private static readonly MAX_EXTERNAL_API_LOGS = 100;
  private readonly logger = new Logger(ImageModerationService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SystemConfigEntry)
    private readonly configRepo: Repository<SystemConfigEntry>,
  ) {}

  async assertAllowed(
    file: Express.Multer.File,
    context: ImageModerationContext,
  ): Promise<void> {
    if (!this.isEnabled()) return;

    const decision = await this.moderate(file, context);
    if (decision.allowed) return;

    this.logger.warn(
      `Imagen bloqueada por moderacion (${context}): ${decision.blockedCategories.join(", ")}`,
    );
    throw new BadRequestException({
      message:
        "La imagen no cumple las politicas de contenido permitido. Sube otra imagen o solicita revision.",
      blockedCategories: decision.blockedCategories,
    });
  }

  private isEnabled() {
    return (
      this.config.get<string>("IMAGE_MODERATION_ENABLED", "true") !== "false"
    );
  }

  private async moderate(
    file: Express.Multer.File,
    context: ImageModerationContext,
  ): Promise<ImageModerationDecision> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    const requireModeration =
      this.config.get<string>("IMAGE_MODERATION_REQUIRED", "true") !== "false";

    if (!apiKey) {
      if (requireModeration) {
        throw new ServiceUnavailableException(
          "La moderacion de imagenes requiere OPENAI_API_KEY.",
        );
      }

      this.logger.warn(
        "IMAGE_MODERATION_ENABLED esta activo, pero OPENAI_API_KEY no esta configurado; se omite la verificacion.",
      );
      return { allowed: true, blockedCategories: [], scores: {} };
    }

    const model = this.config.get<string>(
      "IMAGE_MODERATION_MODEL",
      "omni-moderation-latest",
    );
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const requestBody = JSON.stringify({
      model,
      input: [
        {
          type: "image_url",
          image_url: { url: dataUrl },
        },
      ],
    });
    const response = await this.fetchWithRetry(
      "https://api.openai.com/v1/moderations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      },
    );

    if (!response.ok) {
      const body = await response.text();
      await this.recordExternalApiError({
        provider: "OpenAI",
        service: "Moderations API",
        operation: `image moderation (${context})`,
        status: response.status,
        message: this.openAiUserSafeMessage(response.status),
        details: body,
      });

      if (response.status === 429) {
        throw new ServiceUnavailableException(
          "No pudimos verificar la imagen en este momento. Intenta nuevamente en unos segundos.",
        );
      }
      throw new ServiceUnavailableException(
        "No pudimos verificar la imagen en este momento. Intenta nuevamente o sube otra imagen.",
      );
    }

    const data = (await response.json()) as OpenAiModerationResponse;
    const result = data.results?.[0];
    const categories = result?.categories ?? {};
    const scores = result?.category_scores ?? {};
    const scoreThreshold = this.config.get<number>(
      "IMAGE_MODERATION_SCORE_THRESHOLD",
      0.85,
    );
    const blockedCategories = blockedCategoriesByContext[context].filter(
      (category) =>
        categories[category] || (scores[category] ?? 0) >= scoreThreshold,
    );

    return {
      allowed: blockedCategories.length === 0,
      blockedCategories,
      scores,
    };
  }

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    maxAttempts = 3,
  ): Promise<Response> {
    let lastResponse: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(url, init);
      if (response.status !== 429 || attempt === maxAttempts) {
        return response;
      }

      lastResponse = response;
      const retryAfterMs = this.retryAfterMs(response);
      const backoffMs = retryAfterMs ?? 500 * 2 ** (attempt - 1);
      this.logger.warn(
        `OpenAI moderation rate limit, retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})`,
      );
      await this.sleep(backoffMs);
    }

    return lastResponse as Response;
  }

  private retryAfterMs(response: Response): number | null {
    const retryAfter = response.headers.get("retry-after");
    if (!retryAfter) return null;

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private openAiUserSafeMessage(status: number): string {
    if (status === 429) return "OpenAI rate limit durante moderacion.";
    if (status >= 500) return "OpenAI no disponible durante moderacion.";
    return "OpenAI rechazo la solicitud de moderacion.";
  }

  private async recordExternalApiError(
    entry: Omit<ExternalApiLogEntry, "id" | "createdAt">,
  ) {
    const nextEntry: ExternalApiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ...entry,
      details: entry.details ? entry.details.slice(0, 1200) : undefined,
    };

    try {
      const stored = await this.configRepo.findOne({
        where: { key: ImageModerationService.EXTERNAL_API_LOGS_KEY },
      });
      const current = Array.isArray(stored?.value?.["logs"])
        ? (stored.value["logs"] as ExternalApiLogEntry[])
        : [];
      const logs = [
        nextEntry,
        ...current,
      ].slice(0, ImageModerationService.MAX_EXTERNAL_API_LOGS);

      await this.configRepo.save(
        this.configRepo.create({
          key: ImageModerationService.EXTERNAL_API_LOGS_KEY,
          value: { logs },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo registrar error de API externa: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
