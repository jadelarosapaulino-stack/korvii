import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportStatus } from "../../common/enums/report-status.enum";
import { Report } from "../reports/entities/report.entity";

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Report) private readonly reportsRepo: Repository<Report>,
  ) {}

  async summary() {
    const [total, pending, validated, inProgress, resolved] = await Promise.all(
      [
        this.reportsRepo.count(),
        this.reportsRepo.count({ where: { status: ReportStatus.PENDING } }),
        this.reportsRepo.count({ where: { status: ReportStatus.VALIDATED } }),
        this.reportsRepo.count({ where: { status: ReportStatus.IN_PROGRESS } }),
        this.reportsRepo.count({ where: { status: ReportStatus.RESOLVED } }),
      ],
    );

    const byCategory = await this.reportsRepo
      .createQueryBuilder("report")
      .select("report.category", "category")
      .addSelect("COUNT(*)", "count")
      .groupBy("report.category")
      .orderBy("COUNT(*)", "DESC")
      .getRawMany();

    const byProvince = await this.reportsRepo
      .createQueryBuilder("report")
      .select("COALESCE(report.province, :unknown)", "province")
      .addSelect("COUNT(*)", "count")
      .setParameter("unknown", "Sin provincia")
      .groupBy("report.province")
      .orderBy("COUNT(*)", "DESC")
      .limit(10)
      .getRawMany();

    const avgRiskRaw = await this.reportsRepo
      .createQueryBuilder("report")
      .select("AVG(report.riskLevel)", "avgRisk")
      .getRawOne<{ avgRisk: string }>();

    return {
      total,
      pending,
      validated,
      inProgress,
      resolved,
      averageRisk: Number(Number(avgRiskRaw?.avgRisk ?? 0).toFixed(2)),
      byCategory,
      byProvince,
    };
  }

  async intelligence() {
    const openStatuses = [
      ReportStatus.PENDING,
      ReportStatus.VALIDATED,
      ReportStatus.IN_PROGRESS,
    ];
    const [total, highRisk, floodZones, openReports, resolved] =
      await Promise.all([
        this.reportsRepo.count(),
        this.reportsRepo
          .createQueryBuilder("report")
          .where("report.riskLevel >= :riskLevel", { riskLevel: 4 })
          .getCount(),
        this.reportsRepo
          .createQueryBuilder("report")
          .where("report.category = :category", { category: "FLOOD_ZONE" })
          .getCount(),
        this.reportsRepo
          .createQueryBuilder("report")
          .where("report.status IN (:...statuses)", { statuses: openStatuses })
          .getCount(),
        this.reportsRepo.count({ where: { status: ReportStatus.RESOLVED } }),
      ]);

    const [byProvince, byMunicipality, byCategory, byHour, byRoadSignal] =
      await Promise.all([
        this.riskRows("COALESCE(report.province, :unknown)", "province", 8),
        this.riskRows(
          "COALESCE(report.municipality, :unknown)",
          "municipality",
          10,
        ),
        this.riskRows("report.category", "category", 10),
        this.reportsRepo
          .createQueryBuilder("report")
          .select(`EXTRACT(HOUR FROM report.createdAt)`, "hour")
          .addSelect("COUNT(report.id)", "count")
          .addSelect("AVG(report.riskLevel)", "avgRisk")
          .groupBy(`EXTRACT(HOUR FROM report.createdAt)`)
          .orderBy(`EXTRACT(HOUR FROM report.createdAt)`, "ASC")
          .getRawMany<{ hour: string; count: string; avgRisk: string }>(),
        this.riskRows(
          `CASE
          WHEN LOWER(report.description) LIKE '%autopista%' THEN 'Autopista'
          WHEN LOWER(report.description) LIKE '%puente%' THEN 'Puente'
          WHEN LOWER(report.description) LIKE '%tunel%' THEN 'Tunel'
          WHEN LOWER(report.description) LIKE '%avenida%' OR LOWER(report.title) LIKE '%avenida%' THEN 'Avenida'
          WHEN LOWER(report.description) LIKE '%calle%' OR LOWER(report.title) LIKE '%calle%' THEN 'Calle'
          ELSE 'No clasificada'
        END`,
          "roadType",
          6,
        ),
      ]);

    const exposureScore = Math.min(
      100,
      Math.round(
        ((highRisk * 9 + floodZones * 14 + openReports * 3 + total) /
          Math.max(total, 1)) *
          8,
      ),
    );
    const preventionIndex = Math.max(
      0,
      Math.min(100, 100 - exposureScore + Math.min(20, resolved * 2)),
    );

    return {
      product: "Korvi Intelligence",
      generatedAt: new Date(),
      kpis: {
        totalReports: total,
        highRiskReports: highRisk,
        floodZones,
        openReports,
        resolvedReports: resolved,
        exposureScore,
        preventionIndex,
      },
      trends: {
        byProvince,
        byMunicipality,
        byCategory,
        byHour: byHour.map((row) => ({
          hour: Number(row.hour),
          count: Number(row.count),
          averageRisk: Number(Number(row.avgRisk ?? 0).toFixed(2)),
        })),
        byRoadType: byRoadSignal,
      },
      preventionSignals: [
        highRisk > 0
          ? `${highRisk} reportes de alto riesgo requieren priorizacion.`
          : "Sin reportes de alto riesgo activos en la muestra.",
        floodZones > 0
          ? `${floodZones} zonas de posible inundacion deben evitarse en rutas sugeridas.`
          : "Sin zonas de inundacion activas.",
        byMunicipality[0]
          ? `${byMunicipality[0].label} lidera el scoring territorial.`
          : "Aun no hay suficiente actividad territorial.",
      ],
    };
  }

  private riskRows(expression: string, alias: string, limit: number) {
    return this.reportsRepo
      .createQueryBuilder("report")
      .select(expression, alias)
      .addSelect("COUNT(report.id)", "count")
      .addSelect("AVG(report.riskLevel)", "avgRisk")
      .addSelect(
        "SUM(CASE WHEN report.riskLevel >= 4 THEN 1 ELSE 0 END)",
        "highRiskCount",
      )
      .setParameter("unknown", "Sin definir")
      .groupBy(expression)
      .orderBy("AVG(report.riskLevel)", "DESC")
      .addOrderBy("COUNT(report.id)", "DESC")
      .limit(limit)
      .getRawMany<Record<string, string>>()
      .then((rows) =>
        rows.map((row) => ({
          label: row[alias] ?? "Sin definir",
          count: Number(row.count),
          averageRisk: Number(Number(row.avgRisk ?? 0).toFixed(2)),
          highRiskCount: Number(row.highRiskCount ?? 0),
          score: Math.min(
            100,
            Math.round(
              Number(row.avgRisk ?? 0) * 16 +
                Number(row.highRiskCount ?? 0) * 6 +
                Number(row.count ?? 0) * 2,
            ),
          ),
        })),
      );
  }
}
