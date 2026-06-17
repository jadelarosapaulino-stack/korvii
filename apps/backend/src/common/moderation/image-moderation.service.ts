import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Express } from "express";
import { ExternalApiLoggerService } from "../../modules/system-config/external-api-logger.service";

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
  private readonly logger = new Logger(ImageModerationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly externalApiLogger: ExternalApiLoggerService,
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
      `image moderation (${context})`,
    );

    if (!response.ok) {
      await this.externalApiLogger.recordHttpFailure({
        provider: "OpenAI",
        service: "Moderations API",
        operation: `image moderation (${context})`,
        message: this.openAiUserSafeMessage(response.status),
        response,
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
    operation: string,
    maxAttempts = 3,
  ): Promise<Response> {
    let lastResponse: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await this.fetchExternal(url, init, operation);
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

  private async fetchExternal(
    url: string,
    init: RequestInit,
    operation: string,
  ): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      await this.externalApiLogger.recordException({
        provider: "OpenAI",
        service: "Moderations API",
        operation,
        error,
        message: "OpenAI no disponible durante moderacion.",
      });
      throw error;
    }
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
}
