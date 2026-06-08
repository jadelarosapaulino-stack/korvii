enum ReportCategory {
  accident('ACCIDENT', 'Accidente'),
  trafficLightDamaged('TRAFFIC_LIGHT_DAMAGED', 'Semaforo dañado'),
  roadDamage('ROAD_DAMAGE', 'Via en mal estado'),
  roadObstruction('ROAD_OBSTRUCTION', 'Obstruccion en la via'),
  poorLighting('POOR_LIGHTING', 'Falta de iluminacion'),
  missingSignage('MISSING_SIGNAGE', 'Falta de señalizacion'),
  recklessDriving('RECKLESS_DRIVING', 'Conduccion imprudente'),
  dangerousCrossing('DANGEROUS_CROSSING', 'Cruce peligroso'),
  floodZone('FLOOD_ZONE', 'Zona de posible inundacion'),
  other('OTHER', 'Otro riesgo');

  const ReportCategory(this.value, this.label);
  final String value;
  final String label;
}

class AuthUser {
  AuthUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    this.province,
    this.municipality,
    this.vehicleType,
    this.notificationsEnabled,
    this.contributions,
    this.education,
    this.gamification,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        role: json['role'] as String? ?? 'CITIZEN',
        province: json['province'] as String?,
        municipality: json['municipality'] as String?,
        vehicleType: json['vehicleType'] as String?,
        notificationsEnabled: json['notificationsEnabled'] as bool?,
        contributions: UserContributions.fromJson(
            json['contributions'] as Map<String, dynamic>? ?? const {}),
        education: UserEducation.fromJson(
            json['education'] as Map<String, dynamic>? ?? const {}),
        gamification: UserGamification.fromJson(
            json['gamification'] as Map<String, dynamic>? ?? const {}),
      );

  final String id;
  final String fullName;
  final String email;
  final String role;
  final String? province;
  final String? municipality;
  final String? vehicleType;
  final bool? notificationsEnabled;
  final UserContributions? contributions;
  final UserEducation? education;
  final UserGamification? gamification;
}

class UserContributions {
  UserContributions({
    required this.totalReports,
    required this.pendingReports,
    required this.validatedReports,
    required this.inProgressReports,
    required this.resolvedReports,
    required this.rejectedReports,
    required this.duplicateReports,
    required this.highRiskReports,
  });

  factory UserContributions.fromJson(Map<String, dynamic> json) =>
      UserContributions(
        totalReports: (json['totalReports'] as num?)?.toInt() ?? 0,
        pendingReports: (json['pendingReports'] as num?)?.toInt() ?? 0,
        validatedReports: (json['validatedReports'] as num?)?.toInt() ?? 0,
        inProgressReports: (json['inProgressReports'] as num?)?.toInt() ?? 0,
        resolvedReports: (json['resolvedReports'] as num?)?.toInt() ?? 0,
        rejectedReports: (json['rejectedReports'] as num?)?.toInt() ?? 0,
        duplicateReports: (json['duplicateReports'] as num?)?.toInt() ?? 0,
        highRiskReports: (json['highRiskReports'] as num?)?.toInt() ?? 0,
      );

  final int totalReports;
  final int pendingReports;
  final int validatedReports;
  final int inProgressReports;
  final int resolvedReports;
  final int rejectedReports;
  final int duplicateReports;
  final int highRiskReports;
}

class UserEducation {
  UserEducation({
    required this.points,
    required this.completedLessons,
    required this.lessonsInProgress,
    required this.averageScore,
  });

  factory UserEducation.fromJson(Map<String, dynamic> json) => UserEducation(
        points: (json['points'] as num?)?.toInt() ?? 0,
        completedLessons: (json['completedLessons'] as num?)?.toInt() ?? 0,
        lessonsInProgress: (json['lessonsInProgress'] as num?)?.toInt() ?? 0,
        averageScore: (json['averageScore'] as num?)?.toInt() ?? 0,
      );

  final int points;
  final int completedLessons;
  final int lessonsInProgress;
  final int averageScore;
}

class UserGamification {
  UserGamification({
    required this.totalPoints,
    required this.reportPoints,
    required this.validationPoints,
    required this.educationPoints,
    required this.profilePoints,
    required this.levelName,
    required this.level,
    required this.nextAt,
    required this.progressPercent,
    required this.badges,
  });

  factory UserGamification.fromJson(Map<String, dynamic> json) {
    final points = json['points'] as Map<String, dynamic>? ?? const {};
    final level = json['level'] as Map<String, dynamic>? ?? const {};
    return UserGamification(
      totalPoints: (points['total'] as num?)?.toInt() ?? 0,
      reportPoints: (points['reports'] as num?)?.toInt() ?? 0,
      validationPoints: (points['validation'] as num?)?.toInt() ?? 0,
      educationPoints: (points['education'] as num?)?.toInt() ?? 0,
      profilePoints: (points['profile'] as num?)?.toInt() ?? 0,
      levelName: level['name'] as String? ?? 'Explorador vial',
      level: (level['current'] as num?)?.toInt() ?? 1,
      nextAt: (level['nextAt'] as num?)?.toInt() ?? 100,
      progressPercent: (level['progressPercent'] as num?)?.toInt() ?? 0,
      badges: (json['badges'] as List<dynamic>? ?? const [])
          .map((item) => UserBadge.fromJson(item as Map<String, dynamic>))
          .toList(),
    );
  }

  final int totalPoints;
  final int reportPoints;
  final int validationPoints;
  final int educationPoints;
  final int profilePoints;
  final String levelName;
  final int level;
  final int nextAt;
  final int progressPercent;
  final List<UserBadge> badges;
}

class UserBadge {
  UserBadge({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.color,
  });

  factory UserBadge.fromJson(Map<String, dynamic> json) => UserBadge(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? 'Insignia',
        description: json['description'] as String? ?? '',
        icon: json['icon'] as String? ?? 'emoji_events',
        color: json['color'] as String? ?? '#00A99D',
      );

  final String id;
  final String title;
  final String description;
  final String icon;
  final String color;
}

class ReportPoint {
  ReportPoint({
    required this.id,
    required this.title,
    required this.category,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.riskLevel,
    required this.confirmationCount,
    required this.status,
    this.province,
    this.municipality,
    this.address,
    this.source,
    this.createdAt,
    this.confirmers = const [],
    this.photoUrls = const [],
  });

  factory ReportPoint.fromJson(Map<String, dynamic> json) => ReportPoint(
        id: json['id'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        description: json['description'] as String? ?? '',
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        riskLevel: (json['riskLevel'] as num?)?.toInt() ?? 1,
        confirmationCount: (json['confirmationCount'] as num?)?.toInt() ?? 1,
        status: json['status'] as String? ?? 'PENDING',
        province: json['province'] as String?,
        municipality: json['municipality'] as String?,
        address: json['address'] as String?,
        source: json['source'] as String?,
        createdAt: json['createdAt'] as String?,
        confirmers: (json['confirmers'] as List<dynamic>? ?? const [])
            .map((item) =>
                ReportConfirmer.fromJson(item as Map<String, dynamic>))
            .toList(),
        photoUrls: (json['photoUrls'] as List<dynamic>? ?? []).cast<String>(),
      );

  final String id;
  final String title;
  final String category;
  final String description;
  final double latitude;
  final double longitude;
  final int riskLevel;
  final int confirmationCount;
  final String status;
  final String? province;
  final String? municipality;
  final String? address;
  final String? source;
  final String? createdAt;
  final List<ReportConfirmer> confirmers;
  final List<String> photoUrls;
}

class ReportPage {
  ReportPage({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  factory ReportPage.fromJson(Map<String, dynamic> json) => ReportPage(
        data: (json['data'] as List<dynamic>? ?? const [])
            .map((item) => ReportPoint.fromJson(item as Map<String, dynamic>))
            .toList(),
        total: (json['total'] as num?)?.toInt() ?? 0,
        page: (json['page'] as num?)?.toInt() ?? 1,
        limit: (json['limit'] as num?)?.toInt() ?? 20,
        totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
      );

  final List<ReportPoint> data;
  final int total;
  final int page;
  final int limit;
  final int totalPages;
}

class ReportConfirmer {
  ReportConfirmer({
    required this.id,
    required this.fullName,
    this.source,
    this.originalReporter = false,
  });

  factory ReportConfirmer.fromJson(Map<String, dynamic> json) =>
      ReportConfirmer(
        id: json['id'] as String? ?? '',
        fullName: json['fullName'] as String? ?? 'Usuario',
        source: json['source'] as String?,
        originalReporter: json['originalReporter'] as bool? ?? false,
      );

  final String id;
  final String fullName;
  final String? source;
  final bool originalReporter;
}

class CreateReportResult {
  CreateReportResult({
    required this.reused,
    required this.confirmationAdded,
  });

  factory CreateReportResult.fromJson(Map<String, dynamic> json) =>
      CreateReportResult(
        reused: json['reused'] as bool? ?? false,
        confirmationAdded: json['confirmationAdded'] as bool? ?? false,
      );

  final bool reused;
  final bool confirmationAdded;
}

class Lesson {
  Lesson({
    required this.id,
    required this.title,
    required this.category,
    required this.content,
    required this.durationMinutes,
    required this.points,
    this.thumbnailUrl,
  });

  factory Lesson.fromJson(Map<String, dynamic> json) => Lesson(
        id: json['id'] as String,
        title: json['title'] as String,
        category: json['category'] as String? ?? 'General',
        content: json['content'] as String? ?? '',
        durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
        points: (json['points'] as num?)?.toInt() ?? 0,
        thumbnailUrl: json['thumbnailUrl'] as String?,
      );

  final String id;
  final String title;
  final String category;
  final String content;
  final int durationMinutes;
  final int points;
  final String? thumbnailUrl;
}
