import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../core/location_service.dart';
import '../../core/models.dart';
import '../../core/notification_service.dart';
import '../../core/road_telemetry_service.dart';
import '../../core/reports_repository.dart';
import '../../shared/korvi_letter_loader.dart';
import '../../shared/motion.dart';
import '../../shared/risk_pin.dart';

class RiskMapScreen extends StatefulWidget {
  const RiskMapScreen({
    super.key,
    required this.reports,
    required this.location,
    required this.notifications,
    this.onCreateReport,
  });

  final ReportsRepository reports;
  final LocationService location;
  final NotificationService notifications;
  final VoidCallback? onCreateReport;

  @override
  State<RiskMapScreen> createState() => _RiskMapScreenState();
}

class _RiskMapScreenState extends State<RiskMapScreen> {
  final _map = MapController();
  List<ReportPoint> _reports = [];
  MapTileSource _tileSource = MapTileSource.openStreetMap();
  Position? _position;
  bool _loading = true;
  bool _avoidRiskZones = false;
  bool _roadTelemetryEnabled = false;
  bool _followUserLocation = false;
  String? _message;
  late final RoadTelemetryService _roadTelemetry;
  StreamSubscription<Position>? _positionSubscription;

  @override
  void initState() {
    super.initState();
    _roadTelemetry = RoadTelemetryService(widget.reports);
    _load();
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    _roadTelemetry.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final center = _mapCenterFromReports();

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          FlutterMap(
            mapController: _map,
            options: MapOptions(initialCenter: center, initialZoom: 13),
            children: [
              TileLayer(
                key: ValueKey(_tileSource.urlTemplate),
                urlTemplate: _tileSource.urlTemplate,
                userAgentPackageName: 'com.korvi.mobile',
              ),
              if (_avoidRiskZones)
                CircleLayer(
                  circles: _riskZones
                      .map(
                        (report) => CircleMarker(
                          point: LatLng(report.latitude, report.longitude),
                          radius: report.riskLevel >= 5 ? 700 : 500,
                          useRadiusInMeter: true,
                          color: Color(
                              report.riskLevel >= 5 ? 0x33B42318 : 0x2EB7791F),
                          borderColor: Color(
                              report.riskLevel >= 5 ? 0x99B42318 : 0x99B7791F),
                          borderStrokeWidth: 2,
                        ),
                      )
                      .toList(),
                ),
              MarkerLayer(
                markers: [
                  if (_position != null)
                    Marker(
                      point: LatLng(_position!.latitude, _position!.longitude),
                      width: 52,
                      height: 52,
                      child: const _CurrentLocationPin(),
                    ),
                  ..._reports.map(
                    (report) => Marker(
                      point: LatLng(report.latitude, report.longitude),
                      width: 44,
                      height: 54,
                      child: RiskPin(
                        icon: _iconFor(report.category),
                        color: _colorFor(report.riskLevel),
                        riskLevel: report.riskLevel,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          Positioned(
            left: 18,
            right: 18,
            top: MediaQuery.paddingOf(context).top + 10,
            child: MotionFadeSlide(
              offset: const Offset(0, -18),
              child: _MapTopPanel(
                reports: _reports.length,
                riskZones: _riskZones.length,
                avoidEnabled: _avoidRiskZones,
                roadTelemetryEnabled: _roadTelemetryEnabled,
                onRefresh: _load,
                onToggleAvoid: () =>
                    setState(() => _avoidRiskZones = !_avoidRiskZones),
                onToggleTelemetry: _toggleRoadTelemetry,
              ),
            ),
          ),
          if (_loading)
            const Center(
              child: KorviLetterLoader(
                label: 'KORVI Drive',
              ),
            ),
          if (!_loading && _message != null)
            Positioned(
              left: 18,
              right: 18,
              top: MediaQuery.paddingOf(context).top + 110,
              child: MotionFadeSlide(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 16,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline,
                            color: Color(0xFF00C2A8)),
                        const SizedBox(width: 10),
                        Expanded(
                            child: Text(_message!,
                                style: Theme.of(context).textTheme.bodyMedium)),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            right: 18,
            top: MediaQuery.paddingOf(context).top + 186,
            child: MotionFadeSlide(
              delay: const Duration(milliseconds: 120),
              offset: const Offset(18, 0),
              child: _MapControls(
                onZoomIn: () => _zoomBy(1),
                onZoomOut: () => _zoomBy(-1),
                onLocate: _centerOnCurrentPosition,
              ),
            ),
          ),
          Positioned(
            left: 18,
            right: 18,
            bottom: MediaQuery.paddingOf(context).bottom + 92,
            child: MotionFadeSlide(
              delay: const Duration(milliseconds: 180),
              child: _MapActionSheet(
                reports: _reports.length,
                riskZones: _riskZones.length,
                avoidEnabled: _avoidRiskZones,
                roadTelemetryEnabled: _roadTelemetryEnabled,
                onCreateReport: widget.onCreateReport,
                onToggleTelemetry: _toggleRoadTelemetry,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<ReportPoint> get _riskZones {
    return _reports
        .where((report) =>
            report.status != 'RESOLVED' && report.status != 'REJECTED')
        .where((report) =>
            report.riskLevel >= 4 ||
            report.category == ReportCategory.floodZone.value)
        .toList();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final reports = await widget.reports.mapPoints();
      final tileSource = await widget.reports.mapTileSource();
      Position? position;
      String? message;

      try {
        position = await widget.location.currentPosition();
      } catch (_) {
        message = 'Mostrando reportes sin usar tu ubicacion actual.';
      }

      if (position != null &&
          _isInDominicanRepublic(position.latitude, position.longitude)) {
        final nearbyHighRisk = reports.where((report) {
          final distance = Geolocator.distanceBetween(
            position!.latitude,
            position.longitude,
            report.latitude,
            report.longitude,
          );
          return distance <= 50 &&
              (report.riskLevel >= 4 ||
                  report.category == ReportCategory.floodZone.value);
        }).toList();

        if (nearbyHighRisk.isNotEmpty) {
          await widget.notifications.nearbyRiskAlert(
            'Riesgo vial cercano',
            'Hay ${nearbyHighRisk.length} reporte(s) de alto riesgo cerca de tu ubicacion.',
          );
        }
      } else if (position != null && reports.isNotEmpty) {
        message =
            'Tu ubicacion actual esta fuera de RD. Mostrando los reportes registrados.';
      }

      if (!mounted) return;
      setState(() {
        _position = position;
        _reports = reports;
        _tileSource = tileSource;
        _message = message ??
            (reports.isEmpty
                ? 'No hay reportes disponibles para mostrar.'
                : null);
      });
      _startLiveLocationTracking();
      final hasReports = reports.isNotEmpty;
      final shouldCenterOnPosition = !hasReports &&
          position != null &&
          _isInDominicanRepublic(position.latitude, position.longitude);
      final center = hasReports
          ? _mapCenterFromReports(reports)
          : shouldCenterOnPosition
              ? LatLng(position.latitude, position.longitude)
              : _mapCenterFromReports(reports);
      _map.move(center, max(_map.camera.zoom, hasReports ? 12 : 14));
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'No fue posible cargar los reportes del mapa.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  LatLng _mapCenterFromReports([List<ReportPoint>? reports]) {
    final points = reports ?? _reports;
    if (points.isEmpty) return const LatLng(18.4861, -69.9312);

    final latitude =
        points.map((report) => report.latitude).reduce((a, b) => a + b) /
            points.length;
    final longitude =
        points.map((report) => report.longitude).reduce((a, b) => a + b) /
            points.length;
    return LatLng(latitude, longitude);
  }

  bool _isInDominicanRepublic(double latitude, double longitude) {
    return latitude >= 17.4 &&
        latitude <= 20.1 &&
        longitude >= -72.2 &&
        longitude <= -68;
  }

  Future<void> _toggleRoadTelemetry() async {
    if (_roadTelemetryEnabled) {
      await _roadTelemetry.stop();
      if (!mounted) return;
      setState(() {
        _roadTelemetryEnabled = false;
        _message = 'Deteccion automatica de via en mal estado desactivada.';
      });
      return;
    }

    try {
      await _roadTelemetry.start();
      if (!mounted) return;
      setState(() {
        _roadTelemetryEnabled = true;
        _message =
            'Deteccion automatica activa mientras usas el mapa. Se enviaran solo impactos o frenadas relevantes.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _roadTelemetryEnabled = false;
        _message =
            'No se pudo activar la deteccion vial. Revisa permisos de ubicacion y sensores.';
      });
    }
  }

  Future<void> _startLiveLocationTracking() async {
    if (_positionSubscription != null) return;

    try {
      final stream = await widget.location.positionStream(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilterMeters: 5,
      );
      _positionSubscription = stream.listen(
        (position) {
          if (!mounted || position.accuracy > 80) return;
          setState(() => _position = position);
          if (_followUserLocation) {
            _map.move(
              LatLng(position.latitude, position.longitude),
              max(_map.camera.zoom, 16),
            );
          }
        },
        onError: (_) {
          _positionSubscription?.cancel();
          _positionSubscription = null;
        },
      );
    } catch (_) {
      // El mapa sigue funcionando aunque el usuario no habilite ubicacion en vivo.
    }
  }

  void _zoomBy(double delta) {
    final nextZoom = (_map.camera.zoom + delta).clamp(4.0, 18.0);
    _map.move(_map.camera.center, nextZoom);
  }

  void _centerOnCurrentPosition() {
    final position = _position;
    if (position == null) {
      _load();
      return;
    }
    _followUserLocation = true;
    _map.move(LatLng(position.latitude, position.longitude), 16);
    _startLiveLocationTracking();
  }

  IconData _iconFor(String category) {
    return switch (category) {
      'ACCIDENT' => Icons.car_crash,
      'TRAFFIC_LIGHT_DAMAGED' => Icons.traffic,
      'ROAD_DAMAGE' => Icons.construction,
      'ROAD_OBSTRUCTION' => Icons.warning_amber,
      'POOR_LIGHTING' => Icons.lightbulb,
      'MISSING_SIGNAGE' => Icons.signpost,
      'RECKLESS_DRIVING' => Icons.speed,
      'DANGEROUS_CROSSING' => Icons.directions_walk,
      'FLOOD_ZONE' => Icons.flood,
      'POLICE_ON_ROAD' => Icons.local_police,
      _ => Icons.warning,
    };
  }

  Color _colorFor(int riskLevel) {
    if (riskLevel >= 5) return const Color(0xFFD83B2D);
    if (riskLevel == 4) return const Color(0xFFFF6B35);
    if (riskLevel == 3) return const Color(0xFFFFA37F);
    return const Color(0xFF00C2A8);
  }
}

class _CurrentLocationPin extends StatelessWidget {
  const _CurrentLocationPin();

  @override
  Widget build(BuildContext context) {
    return PulseHalo(
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: const Color(0xFF00C2A8),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 4),
        ),
        child: const Icon(Icons.navigation, color: Colors.white, size: 23),
      ),
    );
  }
}

class _MapTopPanel extends StatelessWidget {
  const _MapTopPanel(
      {required this.reports,
      required this.riskZones,
      required this.avoidEnabled,
      required this.roadTelemetryEnabled,
      required this.onRefresh,
      required this.onToggleAvoid,
      required this.onToggleTelemetry});

  final int reports;
  final int riskZones;
  final bool avoidEnabled;
  final bool roadTelemetryEnabled;
  final VoidCallback onRefresh;
  final VoidCallback onToggleAvoid;
  final VoidCallback onToggleTelemetry;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(26),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F000000),
            blurRadius: 24,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0B1F3A),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Center(
                    child: Text(
                      'KRV',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(text: 'KORVI'),
                            TextSpan(
                              text: ' Drive',
                              style: TextStyle(color: Color(0xFFFF6B35)),
                            ),
                          ],
                        ),
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF102033)),
                      ),
                      SizedBox(height: 2),
                      Text('Mapa ciudadano en tiempo real',
                          style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF6B7785))),
                      SizedBox(height: 1),
                      Text('Smart Mobility Platform',
                          style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF00C2A8))),
                    ],
                  ),
                ),
                _RoundIconButton(
                  icon: Icons.refresh,
                  tooltip: 'Actualizar',
                  onTap: onRefresh,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _MetricPill(
                      icon: Icons.place,
                      label: '$reports reportes',
                      color: const Color(0xFF00C2A8)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MetricPill(
                      icon: Icons.warning,
                      label: '$riskZones zonas',
                      color: const Color(0xFFFF6B35)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _StatusToggle(
                    icon: avoidEnabled ? Icons.shield : Icons.shield_outlined,
                    label: 'Evitar riesgo',
                    active: avoidEnabled,
                    onTap: onToggleAvoid,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatusToggle(
                    icon: roadTelemetryEnabled
                        ? Icons.sensors
                        : Icons.sensors_outlined,
                    label: 'Via automatica',
                    active: roadTelemetryEnabled,
                    onTap: onToggleTelemetry,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MapControls extends StatelessWidget {
  const _MapControls({
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onLocate,
  });

  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onLocate;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _RoundIconButton(icon: Icons.add, tooltip: 'Acercar', onTap: onZoomIn),
        const SizedBox(height: 10),
        _RoundIconButton(
            icon: Icons.remove, tooltip: 'Alejar', onTap: onZoomOut),
        const SizedBox(height: 10),
        _RoundIconButton(
            icon: Icons.near_me_outlined,
            tooltip: 'Mi ubicacion',
            onTap: onLocate),
      ],
    );
  }
}

class _MapActionSheet extends StatelessWidget {
  const _MapActionSheet({
    required this.reports,
    required this.riskZones,
    required this.avoidEnabled,
    required this.roadTelemetryEnabled,
    required this.onCreateReport,
    required this.onToggleTelemetry,
  });

  final int reports;
  final int riskZones;
  final bool avoidEnabled;
  final bool roadTelemetryEnabled;
  final VoidCallback? onCreateReport;
  final VoidCallback onToggleTelemetry;

  @override
  Widget build(BuildContext context) {
    final progress = reports == 0 ? 0.18 : min(1.0, reports / 30);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.98),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x29000000),
            blurRadius: 28,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                _CompactMetric(value: '$reports', label: 'reportes'),
                const Spacer(),
                _CompactMetric(value: '$riskZones', label: 'riesgo alto'),
                const Spacer(),
                _CompactMetric(
                    value: roadTelemetryEnabled ? 'ON' : 'OFF',
                    label: 'sensores'),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 7,
                      backgroundColor: const Color(0xFFE7ECE8),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          Color(0xFF00C2A8)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.arrow_forward, size: 20),
              ],
            ),
            const SizedBox(height: 14),
            if (avoidEnabled)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _InlineNotice(
                  icon: Icons.shield,
                  text: riskZones == 0
                      ? 'No hay zonas de alto riesgo activas cerca.'
                      : 'Evita las zonas sombreadas: hay $riskZones punto(s) de alto riesgo.',
                  color: const Color(0xFFD83B2D),
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: onCreateReport,
                    icon: const Icon(Icons.report_problem_outlined),
                    label: const Text('Reportar riesgo'),
                  ),
                ),
                const SizedBox(width: 10),
                _RoundIconButton(
                  icon: roadTelemetryEnabled
                      ? Icons.pause
                      : Icons.sensors_outlined,
                  tooltip: roadTelemetryEnabled
                      ? 'Pausar deteccion'
                      : 'Activar deteccion vial',
                  onTap: onToggleTelemetry,
                  dark: false,
                ),
                const SizedBox(width: 10),
                _RoundIconButton(
                  icon: Icons.help_outline,
                  tooltip: 'Ayuda',
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Usa el mapa para evitar riesgos, reportar incidentes y activar sensores cuando transites.'),
                    ),
                  ),
                  dark: false,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.dark = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: MotionPressable(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: dark ? const Color(0xFF0B1F3A) : Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: dark ? null : Border.all(color: const Color(0xFFE2EAE4)),
            boxShadow: dark
                ? null
                : const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 14,
                      offset: Offset(0, 6),
                    ),
                  ],
          ),
          child: Icon(icon,
              color: dark ? Colors.white : const Color(0xFF102033), size: 22),
        ),
      ),
    );
  }
}

class _StatusToggle extends StatelessWidget {
  const _StatusToggle({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFE5FBF7) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
              color:
                  active ? const Color(0xFFC9F5EE) : const Color(0xFFDDE4EA)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 17,
                color:
                    active ? const Color(0xFF00C2A8) : const Color(0xFF6B7785)),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: active
                      ? const Color(0xFF0B1F3A)
                      : const Color(0xFF6B7785),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompactMetric extends StatelessWidget {
  const _CompactMetric({required this.value, required this.label});

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: Color(0xFF102033))),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7785))),
      ],
    );
  }
}

class _InlineNotice extends StatelessWidget {
  const _InlineNotice({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Color.lerp(color, Colors.white, 0.9),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, color: Color(0xFF102033))),
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill(
      {required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Color.lerp(color, Colors.white, 0.84),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 5),
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF102033))),
          ),
        ],
      ),
    );
  }
}
