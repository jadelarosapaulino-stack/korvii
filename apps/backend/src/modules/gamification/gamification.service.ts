import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GamificationSetting } from "./gamification-setting.entity";

export interface GamificationMetrics {
  totalReports: number;
  validatedReports: number;
  resolvedReports: number;
  highRiskReports: number;
  completedLessons: number;
  educationPoints: number;
  averageScore: number;
  profileCompletion: number;
}

export interface EarnedBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  earnedAt: Date;
}

export interface GamificationSummary {
  points: {
    total: number;
    reports: number;
    validation: number;
    education: number;
    profile: number;
  };
  level: {
    name: string;
    current: number;
    nextAt: number;
    progressPercent: number;
  };
  badges: EarnedBadge[];
  availableBadges: Array<
    Omit<EarnedBadge, "earnedAt"> & {
      progress: number;
      target: number;
      earned: boolean;
    }
  >;
  settings: Record<string, number>;
}

const DEFAULT_SETTINGS: Record<string, number> = {
  pointsReportCreated: 10,
  pointsValidatedReport: 30,
  pointsResolvedReport: 20,
  pointsHighRiskReport: 10,
  pointsLessonCompleted: 25,
  pointsHighEducationScore: 10,
  pointsProfileComplete: 40,
  highEducationScoreThreshold: 85,
  firstReportThreshold: 1,
  activeReporterThreshold: 5,
  trustedReporterThreshold: 3,
  highRiskWatcherThreshold: 3,
  roadScholarThreshold: 3,
  profileCompleteThreshold: 80,
  pointsBronzeThreshold: 100,
  pointsSilverThreshold: 300,
  pointsGoldThreshold: 700,
};

const DEFAULT_BADGE_ICONS: Record<string, string> = {
  firstReportThreshold: "flag",
  activeReporterThreshold: "campaign",
  trustedReporterThreshold: "verified",
  highRiskWatcherThreshold: "shield",
  roadScholarThreshold: "school",
  profileCompleteThreshold: "person",
  pointsBronzeThreshold: "emoji_events",
  pointsSilverThreshold: "military_tech",
  pointsGoldThreshold: "workspace_premium",
};

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(GamificationSetting)
    private readonly settingsRepo: Repository<GamificationSetting>,
  ) {}

  async getSettings(): Promise<Record<string, any>> {
    const stored = await this.settingsRepo.find();
    return stored.reduce<Record<string, any>>(
      (settings, item) => {
        settings[item.key] = item.value;
        if (DEFAULT_BADGE_ICONS[item.key]) {
          settings[`${item.key}Icon`] =
            item.icon || DEFAULT_BADGE_ICONS[item.key];
        }
        return settings;
      },
      {
        ...DEFAULT_SETTINGS,
        ...Object.fromEntries(
          Object.entries(DEFAULT_BADGE_ICONS).map(([key, icon]) => [
            `${key}Icon`,
            icon,
          ]),
        ),
      },
    );
  }

  async updateSettings(patch: Record<string, unknown>) {
    const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
    const numericEntries = Object.entries(patch)
      .filter(
        ([key, value]) =>
          allowedKeys.has(key) && Number.isFinite(Number(value)),
      )
      .map(([key, value]) => ({
        key,
        value: Math.max(0, Math.round(Number(value))),
      }));

    for (const entry of numericEntries) {
      const current = await this.settingsRepo.findOneBy({ key: entry.key });
      await this.settingsRepo.save(
        this.settingsRepo.create({
          ...current,
          ...entry,
        }),
      );
    }

    for (const [settingKey, defaultIcon] of Object.entries(
      DEFAULT_BADGE_ICONS,
    )) {
      const requestedIcon = patch[`${settingKey}Icon`];
      if (typeof requestedIcon !== "string") continue;
      const icon = requestedIcon.trim().slice(0, 60) || defaultIcon;
      const current = await this.settingsRepo.findOneBy({ key: settingKey });
      await this.settingsRepo.save(
        this.settingsRepo.create({
          ...current,
          key: settingKey,
          value: current?.value ?? DEFAULT_SETTINGS[settingKey],
          icon,
        }),
      );
    }
    return this.getSettings();
  }

  async summarize(metrics: GamificationMetrics): Promise<GamificationSummary> {
    const settings = await this.getSettings();
    const reportPoints =
      metrics.totalReports * settings.pointsReportCreated +
      metrics.highRiskReports * settings.pointsHighRiskReport;
    const validationPoints =
      metrics.validatedReports * settings.pointsValidatedReport +
      metrics.resolvedReports * settings.pointsResolvedReport;
    const educationPoints =
      metrics.educationPoints +
      metrics.completedLessons * settings.pointsLessonCompleted +
      (metrics.averageScore >= settings.highEducationScoreThreshold
        ? settings.pointsHighEducationScore
        : 0);
    const profilePoints =
      metrics.profileCompletion >= settings.profileCompleteThreshold
        ? settings.pointsProfileComplete
        : 0;
    const total =
      reportPoints + validationPoints + educationPoints + profilePoints;
    const availableBadges = this.badgeDefinitions(settings).map((badge) => {
      const progress = this.badgeProgress(badge.id, metrics, total);
      return {
        ...badge,
        progress,
        earned: progress >= badge.target,
      };
    });
    const badges = availableBadges
      .filter((badge) => badge.earned)
      .map(
        ({
          progress: _progress,
          target: _target,
          earned: _earned,
          ...badge
        }) => ({
          ...badge,
          earnedAt: new Date(),
        }),
      );

    return {
      points: {
        total,
        reports: reportPoints,
        validation: validationPoints,
        education: educationPoints,
        profile: profilePoints,
      },
      level: this.levelFor(total, settings),
      badges,
      availableBadges,
      settings,
    };
  }

  private badgeDefinitions(settings: Record<string, any>) {
    return [
      {
        id: "first-report",
        title: "Primer aviso",
        description: "Creo su primer reporte ciudadano.",
        icon: String(settings.firstReportThresholdIcon || "flag"),
        color: "#00A99D",
        target: settings.firstReportThreshold,
      },
      {
        id: "active-reporter",
        title: "Reportero activo",
        description: "Acumula reportes ciudadanos enviados.",
        icon: String(settings.activeReporterThresholdIcon || "campaign"),
        color: "#2F80ED",
        target: settings.activeReporterThreshold,
      },
      {
        id: "trusted-reporter",
        title: "Fuente confiable",
        description: "Tiene reportes validados por el equipo.",
        icon: String(settings.trustedReporterThresholdIcon || "verified"),
        color: "#7C3AED",
        target: settings.trustedReporterThreshold,
      },
      {
        id: "high-risk-watcher",
        title: "Guardián vial",
        description: "Detecta riesgos altos en la vía.",
        icon: String(settings.highRiskWatcherThresholdIcon || "shield"),
        color: "#E23D3D",
        target: settings.highRiskWatcherThreshold,
      },
      {
        id: "road-scholar",
        title: "Aprendiz vial",
        description: "Completa lecciones educativas.",
        icon: String(settings.roadScholarThresholdIcon || "school"),
        color: "#FFB020",
        target: settings.roadScholarThreshold,
      },
      {
        id: "profile-ready",
        title: "Perfil completo",
        description: "Mantiene datos útiles para la atención.",
        icon: String(settings.profileCompleteThresholdIcon || "person"),
        color: "#00A99D",
        target: settings.profileCompleteThreshold,
      },
      {
        id: "points-bronze",
        title: "Bronce vial",
        description: "Alcanza el primer hito de puntos.",
        icon: String(settings.pointsBronzeThresholdIcon || "emoji_events"),
        color: "#B7791F",
        target: settings.pointsBronzeThreshold,
      },
      {
        id: "points-silver",
        title: "Plata vial",
        description: "Mantiene participación destacada.",
        icon: String(settings.pointsSilverThresholdIcon || "military_tech"),
        color: "#6B7280",
        target: settings.pointsSilverThreshold,
      },
      {
        id: "points-gold",
        title: "Oro vial",
        description: "Contribución ciudadana sobresaliente.",
        icon: String(
          settings.pointsGoldThresholdIcon || "workspace_premium",
        ),
        color: "#F59E0B",
        target: settings.pointsGoldThreshold,
      },
    ];
  }

  private badgeProgress(
    id: string,
    metrics: GamificationMetrics,
    totalPoints: number,
  ): number {
    if (id === "first-report" || id === "active-reporter")
      return metrics.totalReports;
    if (id === "trusted-reporter") return metrics.validatedReports;
    if (id === "high-risk-watcher") return metrics.highRiskReports;
    if (id === "road-scholar") return metrics.completedLessons;
    if (id === "profile-ready") return metrics.profileCompletion;
    return totalPoints;
  }

  private levelFor(points: number, settings: Record<string, number>) {
    const levels = [
      {
        current: 1,
        name: "Explorador vial",
        threshold: 0,
        nextAt: settings.pointsBronzeThreshold,
      },
      {
        current: 2,
        name: "Colaborador vial",
        threshold: settings.pointsBronzeThreshold,
        nextAt: settings.pointsSilverThreshold,
      },
      {
        current: 3,
        name: "Protector vial",
        threshold: settings.pointsSilverThreshold,
        nextAt: settings.pointsGoldThreshold,
      },
      {
        current: 4,
        name: "Lider ciudadano",
        threshold: settings.pointsGoldThreshold,
        nextAt: settings.pointsGoldThreshold,
      },
    ];
    const level =
      [...levels].reverse().find((item) => points >= item.threshold) ??
      levels[0];
    const span = Math.max(1, level.nextAt - level.threshold);
    return {
      name: level.name,
      current: level.current,
      nextAt: level.nextAt,
      progressPercent:
        level.current === 4
          ? 100
          : Math.min(
              100,
              Math.round(((points - level.threshold) / span) * 100),
            ),
    };
  }
}
