import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { SystemConfigService } from "../system-config/system-config.service";

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  critical?: boolean;
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private static readonly CONFIG_KEY = "feature_flags";
  private readonly configPath: string;
  private current: FeatureFlag[];

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.configPath = this.config.get<string>(
      "FEATURE_FLAGS_CONFIG_PATH",
      join(process.cwd(), ".tmp", "feature-flags-config.json"),
    );
    this.current = this.defaultFlags();
  }

  async onModuleInit() {
    this.current = this.sanitize(
      await this.systemConfig.loadValue(
        FeatureFlagsService.CONFIG_KEY,
        this.defaultFlags(),
        this.configPath,
      ),
    );
    await this.persist();
  }

  get(): FeatureFlag[] {
    return structuredClone(this.current);
  }

  isEnabled(key: string): boolean {
    return this.current.find((flag) => flag.key === key)?.enabled ?? false;
  }

  async update(next: FeatureFlag[]): Promise<FeatureFlag[]> {
    this.current = this.sanitize(next);
    await this.persist();
    return this.get();
  }

  async reset(): Promise<FeatureFlag[]> {
    this.current = this.defaultFlags();
    await this.persist();
    return this.get();
  }

  private async persist() {
    await this.systemConfig.saveValue(
      FeatureFlagsService.CONFIG_KEY,
      this.current,
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
