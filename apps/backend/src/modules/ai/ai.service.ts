import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ReportCategory } from "../../common/enums/report-category.enum";

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
  private readonly logger = new Logger(AiService.name);
  private readonly categories = Object.values(ReportCategory);

  constructor(private readonly config: ConfigService) {}

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
      throw new Error(
        `OpenAI HTTP ${response.status}${body ? `: ${body.slice(0, 220)}` : ""}`,
      );
    }

    const data = (await response.json()) as OpenAiResponse;
    const text = this.extractOutputText(data);
    const parsed = JSON.parse(text) as ReportAiAnalysis;
    return this.normalizeAnalysis(parsed);
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
}
