import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  critical?: boolean;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly configPath: string;
  private current: FeatureFlag[];

  constructor(private readonly config: ConfigService) {
    this.configPath = this.config.get<string>(
      "FEATURE_FLAGS_CONFIG_PATH",
      join(process.cwd(), ".tmp", "feature-flags-config.json"),
    );
    this.current = this.load();
  }

  get(): FeatureFlag[] {
    return structuredClone(this.current);
  }

  isEnabled(key: string): boolean {
    return this.current.find((flag) => flag.key === key)?.enabled ?? false;
  }

  update(next: FeatureFlag[]): FeatureFlag[] {
    this.current = this.sanitize(next);
    this.persist();
    return this.get();
  }

  reset(): FeatureFlag[] {
    this.current = this.defaultFlags();
    this.persist();
    return this.get();
  }

  private load(): FeatureFlag[] {
    if (!existsSync(this.configPath)) return this.defaultFlags();

    try {
      const stored = JSON.parse(
        readFileSync(this.configPath, "utf8"),
      ) as FeatureFlag[];
      return this.sanitize(stored);
    } catch (error) {
      this.logger.warn(
        `No se pudo leer feature flags: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.defaultFlags();
    }
  }

  private persist() {
    const directory = dirname(this.configPath);
    if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
    writeFileSync(
      this.configPath,
      JSON.stringify(this.current, null, 2),
      "utf8",
    );
  }

  private sanitize(input: FeatureFlag[]): FeatureFlag[] {
    const incomingByKey = new Map(
      (Array.isArray(input) ? input : []).map((flag) => [flag.key, flag]),
    );
    return this.defaultFlags().map((defaults) => {
      const incoming = incomingByKey.get(defaults.key);
      return {
        ...defaults,
        enabled:
          incoming?.critical || defaults.critical
            ? true
            : (incoming?.enabled ?? defaults.enabled),
      };
    });
  }

  private defaultFlags(): FeatureFlag[] {
    return [
      {
        key: "dashboard",
        label: "Panel ejecutivo",
        description: "Metricas, indicadores y vista ejecutiva.",
        group: "Navegacion",
        enabled: true,
      },
      {
        key: "intelligence",
        label: "Korvi Intelligence",
        description: "Analitica avanzada y recomendaciones operativas.",
        group: "Analitica",
        enabled: true,
      },
      {
        key: "reports",
        label: "Reportes",
        description: "Listado y consulta de reportes ciudadanos.",
        group: "Reportes",
        enabled: true,
        critical: true,
      },
      {
        key: "new-report",
        label: "Nuevo reporte",
        description: "Formulario para crear reportes ciudadanos.",
        group: "Reportes",
        enabled: true,
      },
      {
        key: "map",
        label: "Mapa de riesgo",
        description: "Mapa operativo con reportes y capas de riesgo.",
        group: "Mapa",
        enabled: true,
      },
      {
        key: "education",
        label: "Educacion vial",
        description: "Cursos, lecciones, progreso y capacitacion.",
        group: "Educacion",
        enabled: true,
      },
      {
        key: "admin-reports",
        label: "Gestion institucional",
        description: "Administracion y seguimiento de reportes.",
        group: "Administracion",
        enabled: true,
      },
      {
        key: "admin-education",
        label: "Gestion educativa",
        description: "Administracion de cursos y contenido educativo.",
        group: "Administracion",
        enabled: true,
      },
      {
        key: "admin-traffic-lights",
        label: "Catalogo de semaforos",
        description:
          "Importacion, sincronizacion y administracion de semaforos.",
        group: "Administracion",
        enabled: true,
      },
      {
        key: "admin-users",
        label: "Usuarios registrados",
        description: "Administracion de usuarios, roles y estados.",
        group: "Administracion",
        enabled: true,
      },
      {
        key: "admin-roles",
        label: "Permisos por rol",
        description: "Configuracion de roles y permisos operativos.",
        group: "Administracion",
        enabled: true,
      },
      {
        key: "admin-system",
        label: "Configuracion del sistema",
        description: "Parametros globales, feature flags e integraciones.",
        group: "Administracion",
        enabled: true,
        critical: true,
      },
      {
        key: "auth-google",
        label: "Login con Google",
        description:
          "Permite iniciar sesion y crear cuentas ciudadanas mediante Google.",
        group: "Autenticacion",
        enabled: true,
      },
      {
        key: "auth-facebook",
        label: "Login con Facebook",
        description:
          "Permite iniciar sesion y crear cuentas ciudadanas mediante Facebook.",
        group: "Autenticacion",
        enabled: true,
      },
      {
        key: "ai-analysis",
        label: "Analisis con IA",
        description: "Asistencia de IA para clasificar y resumir reportes.",
        group: "Integraciones",
        enabled: true,
      },
      {
        key: "optimized-routes",
        label: "Rutas optimizadas",
        description: "Optimizacion de rutas segun riesgo vial.",
        group: "Integraciones",
        enabled: true,
      },
      {
        key: "weather-monitor",
        label: "Clima e inundaciones",
        description:
          "Monitoreo climatico y activacion de alertas por inundacion.",
        group: "Integraciones",
        enabled: true,
      },
      {
        key: "gamification",
        label: "Gamificacion",
        description: "Puntos, insignias y progreso ciudadano.",
        group: "Experiencia",
        enabled: true,
      },
      {
        key: "subscriptions",
        label: "Suscripciones",
        description: "Flujos de suscripcion y aprobacion institucional.",
        group: "Experiencia",
        enabled: true,
      },
    ];
  }
}
