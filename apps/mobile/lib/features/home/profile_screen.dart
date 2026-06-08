import 'dart:math';

import 'package:flutter/material.dart';

import '../../core/auth_repository.dart';
import '../../core/models.dart';
import '../../shared/korvi_letter_loader.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.auth, required this.onLogout});

  final AuthRepository auth;
  final VoidCallback onLogout;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<AuthUser> _user;

  @override
  void initState() {
    super.initState();
    _user = widget.auth.me();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Perfil ciudadano')),
      body: FutureBuilder<AuthUser>(
        future: _user,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(
              child: KorviLetterLoader(
                label: 'KORVI Drive',
              ),
            );
          }
          final user = snapshot.data!;
          final contributions =
              user.contributions ?? UserContributions.fromJson(const {});
          final education = user.education ?? UserEducation.fromJson(const {});
          final game = user.gamification ?? UserGamification.fromJson(const {});

          return RefreshIndicator(
            onRefresh: () async => setState(() => _user = widget.auth.me()),
            child: ListView(
              padding: EdgeInsets.fromLTRB(
                  16, 16, 16, MediaQuery.paddingOf(context).bottom + 120),
              children: [
                _ProfileHero(user: user, game: game),
                const SizedBox(height: 12),
                _BadgesCarousel(badges: game.badges),
                const SizedBox(height: 12),
                _PointsBreakdown(game: game),
                const SizedBox(height: 12),
                _MetricsCharts(
                    contributions: contributions, education: education),
                const SizedBox(height: 12),
                _AccountInfoPanel(user: user, auth: widget.auth),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () async {
                    await widget.auth.logout();
                    widget.onLogout();
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('Salir'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({required this.user, required this.game});

  final AuthUser user;
  final UserGamification game;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFD9F6F1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF9BDDD5)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 34,
                backgroundColor: Colors.white,
                child: Text(
                  user.fullName.substring(0, 1).toUpperCase(),
                  style: const TextStyle(
                      color: Color(0xFF2F7D73),
                      fontSize: 28,
                      fontWeight: FontWeight.w900),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.fullName,
                        style: const TextStyle(
                            color: Color(0xFF172126),
                            fontSize: 22,
                            fontWeight: FontWeight.w900)),
                    Text(user.email,
                        style: const TextStyle(
                            color: Color(0xFF526461),
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('Nivel ${game.level} · ${game.levelName}',
                        style: const TextStyle(
                            color: Color(0xFF2F7D73),
                            fontWeight: FontWeight.w900)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: Text('${game.totalPoints}',
                    style: const TextStyle(
                        color: Color(0xFF172126),
                        fontSize: 42,
                        fontWeight: FontWeight.w900)),
              ),
              const Text('PTS',
                  style: TextStyle(
                      color: Color(0xFF2F7D73),
                      fontSize: 18,
                      fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: game.progressPercent / 100,
              minHeight: 12,
              backgroundColor: const Color(0xFFEAF7F5),
              valueColor:
                  const AlwaysStoppedAnimation<Color>(Color(0xFFBFE7DC)),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            game.level >= 4
                ? 'Nivel maximo alcanzado'
                : '${game.progressPercent}% hacia ${game.nextAt} puntos',
            style: const TextStyle(
                color: Color(0xFF526461), fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _PointsBreakdown extends StatelessWidget {
  const _PointsBreakdown({required this.game});

  final UserGamification game;

  @override
  Widget build(BuildContext context) {
    final items = [
      ('Reportes', game.reportPoints, const Color(0xFFBFE7DC), Icons.flag),
      (
        'Validacion',
        game.validationPoints,
        const Color(0xFFA9DDD0),
        Icons.verified
      ),
      (
        'Educacion',
        game.educationPoints,
        const Color(0xFFFFB020),
        Icons.school
      ),
      ('Perfil', game.profilePoints, const Color(0xFF7C3AED), Icons.person),
    ];

    return _Panel(
      title: 'Puntos por actividad',
      child: Column(
        children: [
          SizedBox(
            height: 130,
            child: CustomPaint(
              painter: _DonutPainter(
                  values: items.map((item) => item.$2).toList(),
                  colors: items.map((item) => item.$3).toList()),
              child: Center(
                child: Text('${game.totalPoints}',
                    style: const TextStyle(
                        fontSize: 24, fontWeight: FontWeight.w900)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          ...items.map((item) => _LegendRow(
              label: item.$1, value: item.$2, color: item.$3, icon: item.$4)),
        ],
      ),
    );
  }
}

class _MetricsCharts extends StatelessWidget {
  const _MetricsCharts({required this.contributions, required this.education});

  final UserContributions contributions;
  final UserEducation education;

  @override
  Widget build(BuildContext context) {
    final bars = [
      ('Total', contributions.totalReports, const Color(0xFFBFE7DC)),
      ('Validados', contributions.validatedReports, const Color(0xFFA9DDD0)),
      ('Resueltos', contributions.resolvedReports, const Color(0xFF7C3AED)),
      ('Riesgo alto', contributions.highRiskReports, const Color(0xFFE23D3D)),
    ];

    return _Panel(
      title: 'Metricas ciudadanas',
      child: Column(
        children: [
          SizedBox(
              height: 150,
              child: CustomPaint(
                  painter: _BarChartPainter(bars: bars),
                  child: const SizedBox.expand())),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: _MetricCard(
                      label: 'Lecciones',
                      value: '${education.completedLessons}',
                      icon: Icons.school,
                      color: const Color(0xFFFFB020))),
              const SizedBox(width: 10),
              Expanded(
                  child: _MetricCard(
                      label: 'Promedio',
                      value: '${education.averageScore}%',
                      icon: Icons.insights,
                      color: const Color(0xFFBFE7DC))),
            ],
          ),
        ],
      ),
    );
  }
}

class _BadgesCarousel extends StatelessWidget {
  const _BadgesCarousel({required this.badges});

  final List<UserBadge> badges;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE1ECEA)),
      ),
      child: badges.isEmpty
          ? const SizedBox(
              height: 58,
              child: Center(
                child: Text(
                  'Sin insignias ganadas',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            )
          : SizedBox(
              height: 58,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                itemCount: badges.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) =>
                    _BadgeIcon(badge: badges[index]),
              ),
            ),
    );
  }
}

class _BadgeIcon extends StatelessWidget {
  const _BadgeIcon({required this.badge});

  final UserBadge badge;

  @override
  Widget build(BuildContext context) {
    final color = _hexColor(badge.color);
    return Semantics(
      label: badge.title,
      child: Tooltip(
        message: badge.title,
        child: Container(
          width: 58,
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Color.lerp(color, Colors.white, 0.86),
            shape: BoxShape.circle,
            border: Border.all(
                color: Color.lerp(color, Colors.white, 0.35)!, width: 1.5),
          ),
          child: CircleAvatar(
            radius: 21,
            backgroundColor: color,
            foregroundColor: Colors.white,
            child: Icon(_badgeIcon(badge.icon), size: 22),
          ),
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE1ECEA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _LegendRow extends StatelessWidget {
  const _LegendRow(
      {required this.label,
      required this.value,
      required this.color,
      required this.icon});

  final String label;
  final int value;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
          backgroundColor: color,
          foregroundColor: Colors.white,
          child: Icon(icon, size: 18)),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
      trailing: Text('$value pts',
          style: const TextStyle(fontWeight: FontWeight.w900)),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Color.lerp(color, Colors.white, 0.86),
          borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 8),
          Text(value,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _AccountInfoPanel extends StatelessWidget {
  const _AccountInfoPanel({required this.user, required this.auth});

  final AuthUser user;
  final AuthRepository auth;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Datos de cuenta',
      child: Column(
        children: [
          _InfoTile(
              icon: Icons.two_wheeler,
              label: 'Tipo de usuario vial',
              value: user.vehicleType ?? 'Ciudadano'),
          const SizedBox(height: 10),
          _InfoTile(
              icon: Icons.location_city,
              label: 'Provincia',
              value: user.province ?? 'Sin definir'),
          const SizedBox(height: 10),
          _InfoTile(
              icon: Icons.map,
              label: 'Municipio',
              value: user.municipality ?? 'Sin definir'),
          const SizedBox(height: 10),
          _InfoTile(
              icon: Icons.notifications,
              label: 'Notificaciones',
              value: user.notificationsEnabled == false
                  ? 'Desactivadas'
                  : 'Activadas'),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _showPasswordChangeSheet(context),
              icon: const Icon(Icons.lock_reset),
              label: const Text('Cambiar contrasena con codigo'),
            ),
          ),
        ],
      ),
    );
  }

  void _showPasswordChangeSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _PasswordChangeSheet(auth: auth, email: user.email),
    );
  }
}

class _PasswordChangeSheet extends StatefulWidget {
  const _PasswordChangeSheet({required this.auth, required this.email});

  final AuthRepository auth;
  final String email;

  @override
  State<_PasswordChangeSheet> createState() => _PasswordChangeSheetState();
}

class _PasswordChangeSheetState extends State<_PasswordChangeSheet> {
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _message;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, MediaQuery.viewInsetsOf(context).bottom + 20),
      child: ListView(
        shrinkWrap: true,
        children: [
          Text('Cambiar contrasena',
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Text('El codigo temporal se enviara a ${widget.email}.'),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _loading ? null : _sendCode,
            icon: const Icon(Icons.mark_email_read),
            label: const Text('Enviar codigo'),
          ),
          TextField(
            controller: _code,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            decoration: const InputDecoration(labelText: 'Codigo recibido'),
          ),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Nueva contrasena'),
          ),
          if (_message != null)
            Padding(
                padding: const EdgeInsets.only(top: 8), child: Text(_message!)),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _loading ? null : _changePassword,
            icon: const Icon(Icons.lock_reset),
            label: const Text('Confirmar cambio'),
          ),
        ],
      ),
    );
  }

  Future<void> _sendCode() async {
    setState(() {
      _loading = true;
      _message = null;
      _error = null;
    });
    try {
      await widget.auth.requestPasswordReset(widget.email);
      setState(() => _message = 'Codigo enviado. Revisa tu correo.');
    } catch (_) {
      setState(() => _error = 'No fue posible enviar el codigo.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changePassword() async {
    setState(() {
      _loading = true;
      _message = null;
      _error = null;
    });
    try {
      await widget.auth.resetPassword(widget.email, _code.text, _password.text);
      setState(() => _message = 'Contrasena actualizada correctamente.');
    } catch (_) {
      setState(() => _error = 'No fue posible cambiar la contrasena.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile(
      {required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF6FAF9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE1ECEA)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: const Color(0xFFE0F4F1),
            foregroundColor: const Color(0xFF2F7D73),
            child: Icon(icon, size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 2),
                Text(value, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.values, required this.colors});

  final List<int> values;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final total = values.fold<int>(0, (sum, value) => sum + value);
    final rect = Offset.zero & size;
    final stroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 18
      ..strokeCap = StrokeCap.round;

    var start = -pi / 2;
    if (total == 0) {
      stroke.color = const Color(0xFFE1ECEA);
      canvas.drawArc(rect.deflate(18), 0, pi * 2, false, stroke);
      return;
    }

    for (var index = 0; index < values.length; index++) {
      final sweep = (values[index] / total) * pi * 2;
      stroke.color = colors[index];
      canvas.drawArc(
          rect.deflate(18), start, max(0.05, sweep - 0.03), false, stroke);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter oldDelegate) =>
      oldDelegate.values != values;
}

class _BarChartPainter extends CustomPainter {
  _BarChartPainter({required this.bars});

  final List<(String, int, Color)> bars;

  @override
  void paint(Canvas canvas, Size size) {
    final maxValue = max(1, bars.map((bar) => bar.$2).fold<int>(0, max));
    final barWidth = size.width / (bars.length * 2);
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    for (var index = 0; index < bars.length; index++) {
      final item = bars[index];
      final x = index * barWidth * 2 + barWidth * 0.45;
      final height = (item.$2 / maxValue) * (size.height - 42);
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, size.height - height - 26, barWidth, height),
        const Radius.circular(10),
      );
      canvas.drawRRect(rect, Paint()..color = item.$3);
      textPainter.text = TextSpan(
          text: '${item.$2}',
          style: const TextStyle(
              color: Color(0xFF172126),
              fontSize: 11,
              fontWeight: FontWeight.w900));
      textPainter.layout();
      textPainter.paint(
          canvas,
          Offset(x + (barWidth - textPainter.width) / 2,
              size.height - height - 42));
      textPainter.text = TextSpan(
          text: item.$1,
          style: const TextStyle(
              color: Color(0xFF526461),
              fontSize: 10,
              fontWeight: FontWeight.w700));
      textPainter.layout(maxWidth: barWidth * 1.8);
      textPainter.paint(canvas, Offset(x - barWidth * 0.4, size.height - 18));
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) =>
      oldDelegate.bars != bars;
}

Color _hexColor(String value) {
  final normalized = value.replaceFirst('#', '');
  return Color(int.parse('FF$normalized', radix: 16));
}

IconData _badgeIcon(String icon) {
  return switch (icon) {
    'flag' => Icons.flag,
    'campaign' => Icons.campaign,
    'verified' => Icons.verified,
    'shield' => Icons.shield,
    'school' => Icons.school,
    'person' => Icons.person,
    'military_tech' => Icons.military_tech,
    'workspace_premium' => Icons.workspace_premium,
    _ => Icons.emoji_events,
  };
}
