import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Report } from "../reports/entities/report.entity";
import { UserProgress } from "../education/entities/user-progress.entity";
import { GamificationService } from "../gamification/gamification.service";
import { RolePermissionsService } from "../role-permissions/role-permissions.service";
import { UserRole } from "../../common/enums/user-role.enum";
import { QueryUsersDto } from "./dto/query-users.dto";
import { UpdateUserAdminDto } from "./dto/update-user-admin.dto";
import { User } from "./user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    @InjectRepository(Report) private readonly reportsRepo: Repository<Report>,
    @InjectRepository(UserProgress)
    private readonly progressRepo: Repository<UserProgress>,
    private readonly gamification: GamificationService,
    private readonly rolePermissions: RolePermissionsService,
  ) {}

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
  }

  findByEmailWithSecrets(email: string) {
    return this.repo
      .createQueryBuilder("user")
      .addSelect("user.passwordHash")
      .addSelect("user.activationCodeHash")
      .addSelect("user.passwordResetCodeHash")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
  }

  findByEmail(email: string) {
    return this.repo
      .createQueryBuilder("user")
      .where("LOWER(user.email) = LOWER(:email)", { email })
      .getOne();
  }

  save(user: User) {
    return this.repo.save(user);
  }

  async findAll(query: QueryUsersDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const qb = this.repo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.institution", "institution")
      .orderBy("user.createdAt", "DESC");

    if (query.role) qb.andWhere("user.role = :role", { role: query.role });
    if (query.isActive !== undefined)
      qb.andWhere("user.isActive = :isActive", { isActive: query.isActive });
    if (query.q?.trim()) {
      const search = `%${query.q.trim()}%`;
      qb.andWhere(
        "(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))",
        { search },
      );
    }

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const reportCounts = await this.reportCountsByUser(
      users.map((user) => user.id),
    );

    return {
      data: users.map((user) =>
        this.serializeAdminUser(user, reportCounts.get(user.id) ?? 0),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateUserAdmin(id: string, dto: UpdateUserAdminDto, actorId: string) {
    const user = await this.findById(id);
    if (user.id === actorId && dto.isActive === false) {
      throw new BadRequestException("No puedes desactivar tu propio usuario.");
    }
    if (
      user.id === actorId &&
      dto.role &&
      this.rolePermissions.baseRoleFor(dto.role) !== UserRole.SUPER_ADMIN
    ) {
      throw new BadRequestException(
        "No puedes quitarte el rol de super administrador.",
      );
    }

    if (dto.role !== undefined) {
      if (!this.rolePermissions.exists(dto.role))
        throw new BadRequestException("El rol seleccionado no existe.");
      user.role = dto.role;
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
      if (dto.isActive && !user.activatedAt) user.activatedAt = new Date();
    }

    const saved = await this.repo.save(user);
    return this.serializeAdminUser(saved);
  }

  async updatePassword(id: string, passwordHash: string) {
    const user = await this.findById(id);
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;
    return this.repo.save(user);
  }

  async findById(id: string) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Usuario no encontrado");
    return user;
  }

  async updateProfile(id: string, data: Partial<User>) {
    const user = await this.findById(id);
    this.repo.merge(user, {
      fullName: data.fullName ?? user.fullName,
      province: data.province ?? user.province,
      municipality: data.municipality ?? user.municipality,
      vehicleType: data.vehicleType ?? user.vehicleType,
      phone: data.phone ?? user.phone,
      occupation: data.occupation ?? user.occupation,
      mobilityMode: data.mobilityMode ?? user.mobilityMode,
      drivingFrequency: data.drivingFrequency ?? user.drivingFrequency,
      emergencyContactName:
        data.emergencyContactName ?? user.emergencyContactName,
      emergencyContactPhone:
        data.emergencyContactPhone ?? user.emergencyContactPhone,
      preferredContactChannel:
        data.preferredContactChannel ?? user.preferredContactChannel,
      avatarUrl: data.avatarUrl ?? user.avatarUrl,
      avatarPreset: data.avatarPreset ?? user.avatarPreset,
      notificationsEnabled:
        data.notificationsEnabled ?? user.notificationsEnabled,
      decisionInsightsConsent:
        data.decisionInsightsConsent ?? user.decisionInsightsConsent,
    });
    return this.repo.save(user);
  }

  async getProfile(id: string) {
    const user = await this.findById(id);
    const [reports, progress, highRiskReports] = await Promise.all([
      this.reportsRepo.find({
        where: { createdBy: { id } },
        order: { createdAt: "DESC" },
        take: 6,
      }),
      this.progressRepo.find({
        where: { user: { id } },
        order: { updatedAt: "DESC" },
      }),
      this.reportsRepo
        .createQueryBuilder("report")
        .where('report."createdById" = :id', { id })
        .andWhere("report.riskLevel >= :riskLevel", { riskLevel: 4 })
        .getCount(),
    ]);

    const reportTotals = await this.reportsRepo
      .createQueryBuilder("report")
      .select("report.status", "status")
      .addSelect("COUNT(report.id)", "count")
      .where('report."createdById" = :id', { id })
      .groupBy("report.status")
      .getRawMany<{ status: string; count: string }>();

    const statusCounts = reportTotals.reduce<Record<string, number>>(
      (totals, item) => {
        totals[item.status] = Number(item.count);
        return totals;
      },
      {},
    );
    const totalReports = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    const completedProgress = progress.filter((item) => item.completed);
    const educationPoints = completedProgress.reduce(
      (sum, item) => sum + Number(item.lesson?.points ?? 0),
      0,
    );
    const averageScore = completedProgress.length
      ? Math.round(
          completedProgress.reduce(
            (sum, item) => sum + Number(item.score ?? 0),
            0,
          ) / completedProgress.length,
        )
      : 0;
    const profileFields = [
      user.fullName,
      user.province,
      user.municipality,
      user.vehicleType,
      user.phone,
      user.occupation,
      user.mobilityMode,
      user.drivingFrequency,
      user.emergencyContactName,
      user.emergencyContactPhone,
    ];
    const profileCompletion = Math.round(
      (profileFields.filter(Boolean).length / profileFields.length) * 100,
    );
    const gamification = await this.gamification.summarize({
      totalReports,
      validatedReports: statusCounts.VALIDATED ?? 0,
      resolvedReports: statusCounts.RESOLVED ?? 0,
      highRiskReports,
      completedLessons: completedProgress.length,
      educationPoints,
      averageScore,
      profileCompletion,
    });

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      province: user.province,
      municipality: user.municipality,
      vehicleType: user.vehicleType,
      institution: user.institution
        ? {
            id: user.institution.id,
            name: user.institution.name,
            type: user.institution.type,
            province: user.institution.province,
            municipality: user.institution.municipality,
          }
        : null,
      institutionRole: user.institutionRole,
      phone: user.phone,
      occupation: user.occupation,
      mobilityMode: user.mobilityMode,
      drivingFrequency: user.drivingFrequency,
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      preferredContactChannel: user.preferredContactChannel,
      avatarUrl: user.avatarUrl,
      avatarPreset: user.avatarPreset,
      notificationsEnabled: user.notificationsEnabled,
      decisionInsightsConsent: user.decisionInsightsConsent,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      contributions: {
        totalReports,
        pendingReports: statusCounts.PENDING ?? 0,
        validatedReports: statusCounts.VALIDATED ?? 0,
        inProgressReports: statusCounts.IN_PROGRESS ?? 0,
        resolvedReports: statusCounts.RESOLVED ?? 0,
        rejectedReports: statusCounts.REJECTED ?? 0,
        duplicateReports: statusCounts.DUPLICATE ?? 0,
        highRiskReports,
        recentReports: reports.map((report) => ({
          id: report.id,
          title: report.title,
          category: report.category,
          status: report.status,
          riskLevel: report.riskLevel,
          createdAt: report.createdAt,
        })),
      },
      education: {
        points: educationPoints,
        completedLessons: completedProgress.length,
        lessonsInProgress: progress.filter(
          (item) => !item.completed && item.progressPercent > 0,
        ).length,
        averageScore,
        recentProgress: progress.slice(0, 5).map((item) => ({
          id: item.id,
          lessonId: item.lesson?.id,
          lessonTitle: item.lesson?.title,
          completed: item.completed,
          progressPercent: item.progressPercent,
          score: item.score,
          points: item.lesson?.points ?? 0,
          updatedAt: item.updatedAt,
        })),
      },
      gamification,
    };
  }

  private async reportCountsByUser(userIds: string[]) {
    if (!userIds.length) return new Map<string, number>();

    const rows = await this.reportsRepo
      .createQueryBuilder("report")
      .select('report."createdById"', "userId")
      .addSelect("COUNT(report.id)", "count")
      .where('report."createdById" IN (:...userIds)', { userIds })
      .groupBy('report."createdById"')
      .getRawMany<{ userId: string; count: string }>();

    return new Map(rows.map((row) => [row.userId, Number(row.count)]));
  }

  private serializeAdminUser(user: User, reportCount = 0) {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
      province: user.province,
      municipality: user.municipality,
      phone: user.phone,
      institution: user.institution
        ? {
            id: user.institution.id,
            name: user.institution.name,
            type: user.institution.type,
          }
        : null,
      reportCount,
      activatedAt: user.activatedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
