import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import type { Express } from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Repository } from "typeorm";
import { ReportCategory } from "../../common/enums/report-category.enum";
import { SystemConfigEntry } from "../system-config/system-config.entity";

export interface ReportAiAnalysisInput {
  title: string;
  description: string;
  category: ReportCategory;
  riskLevel: number;
  latitude: number;
  longitude: number;
  province?: string | null;
  municipality?: string | null;
  address?: string | null;
  photoUrls?: string[];
}

export interface ReportAiAnalysis {
  summary: string;
  suggestedCategory: ReportCategory;
  riskScore: number;
  priority: "low" | "medium" | "high" | "critical";
  suggestedInstitution: string;
  confidence: number;
  rationale: string;
}

export interface ReportImageSuggestion {
  title: string;
  description: string;
  summary: string;
  suggestedCategory: ReportCategory;
  riskScore: number;
  confidence: number;
  rationale: string;
  needsUserConfirmation: boolean;
}

interface OpenAiResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
}

type OpenAiInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string };

@Injectable()
export class AiService {
  private static readonly EXTERNAL_API_LOGS_KEY = "external_api_logs";
  private static readonly MAX_EXTERNAL_API_LOGS = 100;
  private readonly logger = new Logger(AiService.name);
  private readonly categories = Object.values(ReportCategory);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SystemConfigEntry)
    private readonly configRepo: Repository<SystemConfigEntry>,
  ) {}

  isEnabled() {
    return (
      this.config.get<string>("AI_ENABLED", "true") !== "false" &&
      Boolean(this.config.get<string>("OPENAI_API_KEY"))
    );
  }

  async analyzeReport(
    input: ReportAiAnalysisInput,
  ): Promise<ReportAiAnalysis | null> {
    if (!this.isEnabled()) return null;

    const apiKey = this.config.getOrThrow<string>("OPENAI_API_KEY");
    const model = this.config.get<string>("OPENAI_MODEL", "gpt-4o-mini");
    const userContent = await this.buildUserContent(input);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Eres un analista operativo de seguridad vial para Republica Dominicana.",
                  "Evalua reportes ciudadanos y devuelve solo JSON valido segun el esquema.",
                  "No inventes evidencia. Si la descripcion es ambigua, baja la confianza.",
                  "La prioridad debe reflejar riesgo inmediato para peatones, motoristas y flujo vial.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: userContent,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "traffic_report_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                suggestedCategory: { type: "string", enum: this.categories },
                riskScore: { type: "integer" },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "critical"],
                },
                suggestedInstitution: { type: "string" },
                confidence: { type: "number" },
                rationale: { type: "string" },
              },
              required: [
                "summary",
                "suggestedCategory",
                "riskScore",
                "priority",
                "suggestedInstitution",
                "confidence",
                "rationale",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      await this.recordExternalApiError({
        provider: "OpenAI",
        service: "Responses API",
        operation: "report analysis",
        status: response.status,
        message: this.openAiUserSafeMessage(response.status),
        details: body,
      });
      throw new ServiceUnavailableException(
        "No pudimos completar el analisis con IA en este momento.",
      );
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = this.extractOutputText(data);
    const parsed = JSON.parse(text) as ReportAiAnalysis;
    return this.normalizeAnalysis(parsed);
  }

  async suggestReportFromImage(
    image: Express.Multer.File,
  ): Promise<ReportImageSuggestion | null> {
    if (!this.isEnabled()) return null;

    const apiKey = this.config.getOrThrow<string>("OPENAI_API_KEY");
    const model = this.config.get<string>("OPENAI_MODEL", "gpt-4o-mini");
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "Eres un analista de seguridad vial para Korvi.",
                  "Observa la imagen y sugiere como clasificar un reporte ciudadano.",
                  "No inventes detalles que no se ven. Si la imagen es ambigua, usa OTHER y baja la confianza.",
                  "Devuelve solo JSON valido segun el esquema.",
                ].join(" "),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "Analiza esta imagen como evidencia inicial de un reporte vial.",
                  `Categorias permitidas: ${this.categories.join(", ")}`,
                  "Genera un titulo breve, una descripcion operacional, categoria sugerida, riesgo 1-5 y confianza 0-1.",
                  "needsUserConfirmation debe ser true si confianza < 0.75 o si faltan detalles contextuales.",
                ].join("\n"),
              },
              {
                type: "input_image",
                image_url: this.fileToDataUrl(image),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "traffic_report_image_suggestion",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                summary: { type: "string" },
                suggestedCategory: { type: "string", enum: this.categories },
                riskScore: { type: "integer" },
                confidence: { type: "number" },
                rationale: { type: "string" },
                needsUserConfirmation: { type: "boolean" },
              },
              required: [
                "title",
                "description",
                "summary",
                "suggestedCategory",
                "riskScore",
                "confidence",
                "rationale",
                "needsUserConfirmation",
              ],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      await this.recordExternalApiError({
        provider: "OpenAI",
        service: "Responses API",
        operation: "image report suggestion",
        status: response.status,
        message: this.openAiUserSafeMessage(response.status),
        details: body,
      });
      throw new ServiceUnavailableException(
        "No pudimos analizar la imagen con IA en este momento.",
      );
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = this.extractOutputText(data);
    return this.normalizeImageSuggestion(JSON.parse(text) as ReportImageSuggestion);
  }

  private async buildUserContent(
    input: ReportAiAnalysisInput,
  ): Promise<OpenAiInputContent[]> {
    const content: OpenAiInputContent[] = [
      { type: "input_text", text: this.buildReportPrompt(input) },
    ];
    const images = await Promise.all(
      (input.photoUrls ?? [])
        .slice(0, 2)
        .map((url) => this.resolveImageUrl(url)),
    );

    for (const imageUrl of images.filter((url): url is string =>
      Boolean(url),
    )) {
      content.push({ type: "input_image", image_url: imageUrl });
    }

    return content;
  }

  private buildReportPrompt(input: ReportAiAnalysisInput) {
    return [
      `Titulo: ${input.title}`,
      `Descripcion: ${input.description}`,
      `Categoria declarada: ${input.category}`,
      `Riesgo declarado: ${input.riskLevel}/5`,
      `Ubicacion: ${input.province || "Sin provincia"} - ${input.municipality || "Sin municipio"}`,
      `Direccion: ${input.address || "Sin direccion"}`,
      `Coordenadas: ${input.latitude}, ${input.longitude}`,
      `Fotos adjuntas: ${input.photoUrls?.length ?? 0}`,
      `Categorias permitidas: ${this.categories.join(", ")}`,
      [
        "Sugiere institucion como texto corto.",
        "Ejemplos: Ayuntamiento municipal, INTRANT, DIGESETT, Ministerio de Obras Publicas, Defensa Civil, 911.",
      ].join(" "),
    ].join("\n");
  }

  private extractOutputText(response: OpenAiResponse) {
    if (response.output_text) return response.output_text;

    const text = response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("")
      .trim();

    if (!text) throw new Error("OpenAI no devolvio texto de analisis.");
    return text;
  }

  private async resolveImageUrl(url: string): Promise<string | null> {
    if (/^https?:\/\//i.test(url)) return url;
    if (!url.startsWith("/uploads/")) return null;

    const safeRelativePath = url
      .replace(/^\/+/, "")
      .split("/")
      .filter((part) => part && part !== "..")
      .join("/");
    const filePath = join(process.cwd(), safeRelativePath);
    if (!existsSync(filePath)) return null;

    const extension = filePath.split(".").pop()?.toLowerCase();
    const mimeType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : "image/jpeg";
    const file = await readFile(filePath);
    return `data:${mimeType};base64,${file.toString("base64")}`;
  }

  private fileToDataUrl(file: Express.Multer.File): string {
    return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  }

  private normalizeAnalysis(value: ReportAiAnalysis): ReportAiAnalysis {
    const suggestedCategory = this.categories.includes(value.suggestedCategory)
      ? value.suggestedCategory
      : ReportCategory.OTHER;
    const riskScore = Math.min(
      5,
      Math.max(1, Math.round(Number(value.riskScore) || 3)),
    );
    const confidence = Math.min(1, Math.max(0, Number(value.confidence) || 0));

    return {
      summary: String(value.summary || "").slice(0, 600),
      suggestedCategory,
      riskScore,
      priority: ["low", "medium", "high", "critical"].includes(value.priority)
        ? value.priority
        : "medium",
      suggestedInstitution: String(
        value.suggestedInstitution || "Autoridad competente",
      ).slice(0, 160),
      confidence,
      rationale: String(value.rationale || "").slice(0, 800),
    };
  }

  private normalizeImageSuggestion(
    value: ReportImageSuggestion,
  ): ReportImageSuggestion {
    const confidence = Math.min(1, Math.max(0, Number(value.confidence) || 0));
    const suggestedCategory = this.categories.includes(value.suggestedCategory)
      ? value.suggestedCategory
      : ReportCategory.OTHER;
    return {
      title: String(value.title || "Riesgo vial detectado").slice(0, 120),
      description: String(
        value.description || "La imagen muestra un posible riesgo vial que requiere validacion.",
      ).slice(0, 700),
      summary: String(value.summary || "").slice(0, 500),
      suggestedCategory,
      riskScore: Math.min(5, Math.max(1, Math.round(Number(value.riskScore) || 3))),
      confidence,
      rationale: String(value.rationale || "").slice(0, 800),
      needsUserConfirmation: Boolean(value.needsUserConfirmation) || confidence < 0.75,
    };
  }

  private openAiUserSafeMessage(status: number): string {
    if (status === 429) return "OpenAI rate limit durante analisis IA.";
    if (status >= 500) return "OpenAI no disponible durante analisis IA.";
    return "OpenAI rechazo la solicitud de analisis IA.";
  }

  private async recordExternalApiError(entry: {
    provider: string;
    service: string;
    operation: string;
    status?: number;
    message: string;
    details?: string;
  }) {
    const nextEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
      ...entry,
      details: entry.details ? entry.details.slice(0, 1200) : undefined,
    };

    try {
      const stored = await this.configRepo.findOne({
        where: { key: AiService.EXTERNAL_API_LOGS_KEY },
      });
      const current = Array.isArray(stored?.value?.["logs"])
        ? (stored.value["logs"] as typeof nextEntry[])
        : [];
      const logs = [nextEntry, ...current].slice(
        0,
        AiService.MAX_EXTERNAL_API_LOGS,
      );
      await this.configRepo.save(
        this.configRepo.create({
          key: AiService.EXTERNAL_API_LOGS_KEY,
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
