import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Express } from "express";

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

  constructor(private readonly config: ConfigService) {}

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
      this.config.get<string>("IMAGE_MODERATION_REQUIRED", "false") === "true";

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
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ServiceUnavailableException(
        `No fue posible moderar la imagen: HTTP ${response.status}${body ? ` ${body.slice(0, 180)}` : ""}`,
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
}
