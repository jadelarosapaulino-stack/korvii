import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { UserRole } from "../../common/enums/user-role.enum";
import { SystemConfigService } from "../system-config/system-config.service";

export interface RolePermissionItem {
  key: string;
  label: string;
  enabled: boolean;
}

export interface RolePermissionSection {
  key: string;
  title: string;
  icon: string;
  items: RolePermissionItem[];
}

export interface RolePermissionView {
  role: string;
  baseRole: UserRole;
  label: string;
  description: string;
  level: string;
  options: RolePermissionSection[];
  actions: RolePermissionSection[];
}

@Injectable()
export class RolePermissionsService implements OnModuleInit {
  private static readonly CONFIG_KEY = "role_permissions";
  private readonly configPath: string;
  private current: RolePermissionView[];

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.configPath = this.config.get<string>(
      "ROLE_PERMISSIONS_CONFIG_PATH",
      join(process.cwd(), ".tmp", "role-permissions-config.json"),
    );
    this.current = this.defaultConfig();
  }

  async onModuleInit() {
    this.current = this.sanitize(
      await this.systemConfig.loadValue(
        RolePermissionsService.CONFIG_KEY,
        this.defaultConfig(),
        this.configPath,
      ),
    );
    await this.persist();
  }

  get(): RolePermissionView[] {
    return structuredClone(this.current);
  }

  async update(next: RolePermissionView[]): Promise<RolePermissionView[]> {
    this.current = this.sanitize(next);
    await this.persist();
    return this.get();
  }

  async reset(): Promise<RolePermissionView[]> {
    this.current = this.defaultConfig();
    await this.persist();
    return this.get();
  }

  exists(role: string): boolean {
    return this.current.some((item) => item.role === role);
  }

  baseRoleFor(role: string): UserRole {
    return (
      this.current.find((item) => item.role === role)?.baseRole ??
      (Object.values(UserRole).includes(role as UserRole)
        ? (role as UserRole)
        : UserRole.CITIZEN)
    );
  }

  private async persist() {
    await this.systemConfig.saveValue(
      RolePermissionsService.CONFIG_KEY,
      this.current,
    );
  }

  private sanitize(input: RolePermissionView[]): RolePermissionView[] {
    const incomingRoles = Array.isArray(input) ? input : [];
    const incomingByRole = new Map(
      incomingRoles.map((role) => [this.normalizeRole(role.role), role]),
    );
    const defaults = this.defaultConfig().map((defaultRole) => {
      const incoming = incomingByRole.get(defaultRole.role);
      return this.mergeRole(defaultRole, incoming);
    });
    const defaultRoleKeys = new Set(defaults.map((role) => role.role));
    const custom = incomingRoles
      .map((role) => ({ ...role, role: this.normalizeRole(role.role) }))
      .filter((role) => role.role && !defaultRoleKeys.has(role.role))
      .map((role) => this.mergeRole(this.customFallback(role), role));

    return [...defaults, ...custom];
  }

  private mergeRole(
    defaults: RolePermissionView,
    incoming: RolePermissionView | undefined,
  ): RolePermissionView {
    return {
      ...defaults,
      baseRole: Object.values(UserRole).includes(incoming?.baseRole as UserRole)
        ? (incoming?.baseRole as UserRole)
        : defaults.baseRole,
      label: String(incoming?.label || defaults.label),
      description: String(incoming?.description || defaults.description),
      level: String(incoming?.level || defaults.level),
      options: this.mergeSections(defaults.options, incoming?.options),
      actions: this.mergeSections(defaults.actions, incoming?.actions),
    };
  }

  private customFallback(role: RolePermissionView): RolePermissionView {
    const base =
      this.defaultConfig().find((item) => item.role === role.baseRole) ??
      this.defaultConfig()[0];
    return {
      ...base,
      role: role.role,
      baseRole: role.baseRole,
      label: role.label || role.role,
      level: role.level || "Personalizado",
      description:
        role.description ||
        "Rol personalizado configurado por el super administrador.",
    };
  }

  private normalizeRole(role: unknown): string {
    return String(role || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_")
      .slice(0, 80);
  }

  private mergeSections(
    defaults: RolePermissionSection[],
    incoming: RolePermissionSection[] | undefined,
  ): RolePermissionSection[] {
    const incomingByKey = new Map(
      (incoming ?? []).map((section) => [section.key, section]),
    );
    return defaults.map((section) => {
      const stored = incomingByKey.get(section.key);
      const storedItems = new Map(
        (stored?.items ?? []).map((item) => [item.key, item]),
      );
      return {
        ...section,
        items: section.items.map((item) => ({
          ...item,
          enabled: storedItems.has(item.key)
            ? Boolean(storedItems.get(item.key)?.enabled)
            : item.enabled,
        })),
      };
    });
  }

  private item(key: string, label: string, enabled = true): RolePermissionItem {
    return { key, label, enabled };
  }

  private defaultConfig(): RolePermissionView[] {
    return [
      {
        role: UserRole.CITIZEN,
        baseRole: UserRole.CITIZEN,
        label: "Ciudadano",
        level: "Acceso base",
        description:
          "Usuario registrado orientado a reportar incidencias, consultar el mapa y capacitarse.",
        options: [
          {
            key: "navigation",
            title: "Navegacion",
            icon: "apps",
            items: [
              this.item("map", "Mapa de riesgo"),
              this.item("reports", "Reportes"),
              this.item("new-report", "Nuevo reporte"),
              this.item("education", "Educacion vial"),
            ],
          },
          {
            key: "account",
            title: "Cuenta",
            icon: "account_circle",
            items: [
              this.item("profile", "Mi perfil"),
              this.item("password", "Cambio de contrasena"),
              this.item("basic-preferences", "Preferencias basicas"),
            ],
          },
        ],
        actions: [
          {
            key: "citizen-reports",
            title: "Reportes ciudadanos",
            icon: "report_problem",
            items: [
              this.item("create-reports", "Crear reportes"),
              this.item("view-public-reports", "Consultar reportes publicados"),
              this.item(
                "submit-evidence",
                "Aportar datos de ubicacion y evidencia",
              ),
            ],
          },
          {
            key: "education-actions",
            title: "Educacion",
            icon: "school",
            items: [
              this.item("view-lessons", "Ver lecciones"),
              this.item("complete-progress", "Completar progreso educativo"),
              this.item("earn-points", "Acumular puntos de aprendizaje"),
            ],
          },
        ],
      },
      {
        role: UserRole.MODERATOR,
        baseRole: UserRole.MODERATOR,
        label: "Moderador",
        level: "Operacion",
        description:
          "Rol operativo para validar reportes y apoyar el seguimiento diario de incidencias.",
        options: [
          {
            key: "navigation",
            title: "Navegacion",
            icon: "apps",
            items: [
              this.item("dashboard", "Panel ejecutivo"),
              this.item("map", "Mapa de riesgo"),
              this.item("reports", "Reportes"),
              this.item("intelligence", "Intelligence"),
              this.item("education", "Educacion vial"),
            ],
          },
          {
            key: "admin",
            title: "Administracion",
            icon: "admin_panel_settings",
            items: [
              this.item("admin-reports", "Gestion institucional"),
              this.item("admin-education", "Gestion educativa"),
              this.item("admin-traffic-lights", "Catalogo de semaforos"),
            ],
          },
        ],
        actions: [
          {
            key: "reports",
            title: "Reportes",
            icon: "fact_check",
            items: [
              this.item("validate-reports", "Validar reportes"),
              this.item("assign-responsible", "Asignar responsables"),
              this.item("change-status", "Cambiar estados operativos"),
              this.item(
                "view-intelligence",
                "Consultar analitica e inteligencia",
              ),
            ],
          },
          {
            key: "content-traffic",
            title: "Contenido y semaforos",
            icon: "traffic",
            items: [
              this.item("manage-education", "Administrar contenido educativo"),
              this.item(
                "import-traffic-lights",
                "Consultar e importar semaforos",
              ),
              this.item(
                "update-traffic-lights",
                "Actualizar estado operativo de semaforos",
              ),
            ],
          },
        ],
      },
      {
        role: UserRole.INSTITUTION_ADMIN,
        baseRole: UserRole.INSTITUTION_ADMIN,
        label: "Admin institucional",
        level: "Institucional",
        description:
          "Gestiona operaciones institucionales y seguimiento de incidencias en su ambito.",
        options: [
          {
            key: "navigation",
            title: "Navegacion",
            icon: "apps",
            items: [
              this.item("dashboard", "Panel ejecutivo"),
              this.item("map", "Mapa de riesgo"),
              this.item("reports", "Reportes"),
              this.item("intelligence", "Intelligence"),
              this.item("education", "Educacion vial"),
            ],
          },
          {
            key: "admin",
            title: "Administracion",
            icon: "admin_panel_settings",
            items: [
              this.item("admin-reports", "Gestion institucional"),
              this.item("admin-education", "Gestion educativa"),
              this.item("admin-traffic-lights", "Catalogo de semaforos"),
            ],
          },
        ],
        actions: [
          {
            key: "reports",
            title: "Reportes",
            icon: "assignment_turned_in",
            items: [
              this.item("validate-reports", "Validar reportes"),
              this.item("assign-cases", "Asignar casos"),
              this.item("change-status", "Cambiar estados"),
              this.item(
                "view-institutional-analytics",
                "Consultar analitica institucional",
              ),
            ],
          },
          {
            key: "traffic-lights",
            title: "Semaforos",
            icon: "traffic",
            items: [
              this.item("view-traffic-lights", "Consultar semaforos"),
              this.item("import-osm", "Importar ubicaciones OSM"),
              this.item(
                "update-sync-status",
                "Actualizar sincronizacion y estado",
              ),
            ],
          },
        ],
      },
      {
        role: UserRole.INSURANCE_ADMIN,
        baseRole: UserRole.INSURANCE_ADMIN,
        label: "Admin aseguradora",
        level: "Analisis",
        description:
          "Consulta reportes, riesgos y analitica para evaluacion y seguimiento de casos.",
        options: [
          {
            key: "navigation",
            title: "Navegacion",
            icon: "apps",
            items: [
              this.item("dashboard", "Panel ejecutivo"),
              this.item("map", "Mapa de riesgo"),
              this.item("reports", "Reportes"),
              this.item("intelligence", "Intelligence"),
              this.item("education", "Educacion vial"),
            ],
          },
          {
            key: "admin",
            title: "Administracion",
            icon: "admin_panel_settings",
            items: [
              this.item("admin-reports", "Gestion institucional"),
              this.item("admin-education", "Gestion educativa"),
            ],
          },
        ],
        actions: [
          {
            key: "reports",
            title: "Reportes",
            icon: "query_stats",
            items: [
              this.item(
                "view-admin-reports",
                "Consultar gestion institucional",
              ),
              this.item(
                "track-reports",
                "Asignar o actualizar seguimiento de reportes",
              ),
              this.item(
                "view-intelligence",
                "Consultar analitica e inteligencia",
              ),
            ],
          },
          {
            key: "content",
            title: "Contenido",
            icon: "video_library",
            items: [
              this.item(
                "manage-education",
                "Administrar contenido educativo segun permisos operativos",
              ),
            ],
          },
        ],
      },
      {
        role: UserRole.SUPER_ADMIN,
        baseRole: UserRole.SUPER_ADMIN,
        label: "Super admin",
        level: "Sistema",
        description:
          "Control completo del sistema, usuarios, configuracion y operaciones criticas.",
        options: [
          {
            key: "navigation",
            title: "Navegacion",
            icon: "apps",
            items: [
              this.item("dashboard", "Panel ejecutivo"),
              this.item("map", "Mapa de riesgo"),
              this.item("reports", "Reportes"),
              this.item("intelligence", "Intelligence"),
              this.item("education", "Educacion vial"),
            ],
          },
          {
            key: "admin",
            title: "Administracion",
            icon: "admin_panel_settings",
            items: [
              this.item("admin-reports", "Gestion institucional"),
              this.item("admin-education", "Gestion educativa"),
              this.item("admin-traffic-lights", "Catalogo de semaforos"),
              this.item("admin-users", "Usuarios registrados"),
              this.item("admin-roles", "Permisos por rol"),
              this.item("admin-system", "Parametros del sistema"),
            ],
          },
        ],
        actions: [
          {
            key: "users-system",
            title: "Usuarios y sistema",
            icon: "manage_accounts",
            items: [
              this.item("change-user-roles", "Cambiar roles de usuarios"),
              this.item("toggle-accounts", "Activar o desactivar cuentas"),
              this.item(
                "manage-system-params",
                "Administrar parametros del sistema",
              ),
              this.item("configure-integrations", "Configurar integraciones"),
            ],
          },
          {
            key: "full-operation",
            title: "Operacion completa",
            icon: "tune",
            items: [
              this.item(
                "restricted-operations",
                "Eliminar o administrar operaciones restringidas",
              ),
              this.item(
                "critical-traffic-actions",
                "Ejecutar acciones criticas de semaforos",
              ),
              this.item(
                "risk-gamification-rules",
                "Gestionar reglas de riesgo y gamificacion",
              ),
            ],
          },
        ],
      },
    ];
  }
}
