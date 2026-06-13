import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_config.dart';
import '../../core/location_service.dart';
import '../../core/models.dart';
import '../../core/reports_repository.dart';
import '../../shared/motion.dart';
import '../../shared/risk_pin.dart';

class ReportCreateScreen extends StatefulWidget {
  const ReportCreateScreen(
      {super.key, required this.reports, required this.location});

  final ReportsRepository reports;
  final LocationService location;

  @override
  State<ReportCreateScreen> createState() => _ReportCreateScreenState();
}

class _ReportCreateScreenState extends State<ReportCreateScreen> {
  static const _defaultLocation = LatLng(18.4861, -69.9312);
  static const _nearbyRadiusMeters = 50.0;

  final _map = MapController();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _province = TextEditingController();
  final _municipality = TextEditingController();
  final _address = TextEditingController();
  final _picker = ImagePicker();

  ReportCategory _category = ReportCategory.trafficLightDamaged;
  int _riskLevel = 4;
  int _suggestedRiskLevel = 4;
  bool _riskManuallyAdjusted = false;
  bool _titleManuallyAdjusted = false;
  bool _descriptionManuallyAdjusted = false;
  bool _applyingSuggestion = false;
  bool _loading = false;
  bool _locating = false;
  bool _loadingNearby = false;
  String? _message;
  String _locationMessage = 'Usa GPS o toca el mapa para ubicar el reporte.';
  String _riskReason = 'Nivel 4/5 calculado por categoria y descripcion.';
  LatLng? _selectedLocation;
  double? _locationAccuracy;
  List<File> _photos = [];
  List<ReportPoint> _existingReports = [];
  List<ReportPoint> _nearbyReports = [];

  final Map<ReportCategory, ({String title, String description})> _suggestions =
      {
    ReportCategory.accident: (
      title: 'Accidente de transito reportado',
      description:
          'Se reporta un accidente de transito que puede afectar la circulacion y representar riesgo para conductores, motociclistas o peatones.',
    ),
    ReportCategory.trafficLightDamaged: (
      title: 'Semaforo danado en interseccion principal',
      description:
          'El semaforo no funciona correctamente y genera riesgo para conductores, motociclistas y peatones en la interseccion.',
    ),
    ReportCategory.roadDamage: (
      title: 'Via en mal estado',
      description:
          'La via presenta hoyos, grietas o deterioro que puede provocar maniobras peligrosas, danos a vehiculos o accidentes.',
    ),
    ReportCategory.roadObstruction: (
      title: 'Obstruccion en la via',
      description:
          'Hay escombros, basura, objetos caidos u otro elemento inusual que bloquea o reduce la movilidad en la ruta.',
    ),
    ReportCategory.poorLighting: (
      title: 'Zona con poca iluminacion',
      description:
          'El tramo tiene iluminacion insuficiente durante la noche, reduciendo la visibilidad y aumentando el riesgo para usuarios de la via.',
    ),
    ReportCategory.missingSignage: (
      title: 'Senalizacion ausente o deteriorada',
      description:
          'Falta senalizacion vial o la existente esta deteriorada, lo que puede generar confusion y maniobras inseguras.',
    ),
    ReportCategory.recklessDriving: (
      title: 'Conduccion imprudente frecuente',
      description:
          'Se observa conduccion imprudente en la zona, como exceso de velocidad, rebases peligrosos o irrespeto a senales de transito.',
    ),
    ReportCategory.dangerousCrossing: (
      title: 'Cruce peligroso para peatones',
      description:
          'El cruce representa riesgo para peatones y conductores por falta de control, visibilidad limitada o alto flujo vehicular.',
    ),
    ReportCategory.floodZone: (
      title: 'Zona de posible inundacion',
      description:
          'Se reporta acumulacion de agua o posible inundacion en la via. Evita transitar por este tramo hasta que sea validado o resuelto.',
    ),
    ReportCategory.other: (
      title: 'Riesgo vial reportado',
      description:
          'Describe el riesgo vial observado, indicando como afecta la seguridad de peatones, conductores o motociclistas.',
    ),
  };

  @override
  void initState() {
    super.initState();
    _applyCategorySuggestion(_category);
    _title.addListener(_onTitleChanged);
    _description.addListener(_onDescriptionChanged);
    _loadExistingReports();
    _useGps();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _province.dispose();
    _municipality.dispose();
    _address.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedLocation ?? _defaultLocation;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo reporte'),
        actions: [
          IconButton(
            onPressed: _locating ? null : _useGps,
            icon: const Icon(Icons.my_location),
            tooltip: 'Usar GPS',
          ),
        ],
      ),
      body: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(
            16, 16, 16, MediaQuery.paddingOf(context).bottom + 120),
        children: [
          MotionFadeSlide(
            child: _ReportHero(
              category: _category.label,
              riskLevel: _riskLevel,
              reportsNearby: _nearbyReports.length,
              color: _colorFor(_riskLevel),
            ),
          ),
          const SizedBox(height: 12),
          const _SectionHeader(
              number: '01',
              title: 'Incidente',
              subtitle: 'Categoria, titulo y contexto.'),
          TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Titulo')),
          const SizedBox(height: 12),
          DropdownButtonFormField<ReportCategory>(
            initialValue: _category,
            decoration: const InputDecoration(labelText: 'Tipo de reporte'),
            items: ReportCategory.values.map((category) {
              return DropdownMenuItem(
                  value: category, child: Text(category.label));
            }).toList(),
            onChanged: (value) => _changeCategory(value ?? _category),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 4,
            decoration: const InputDecoration(labelText: 'Descripcion'),
          ),
          const SizedBox(height: 18),
          _SectionHeader(
              number: '02',
              title: 'Ubicacion y severidad',
              subtitle: _locationMessage),
          MotionFadeSlide(
            delay: const Duration(milliseconds: 120),
            child: Container(
              height: 280,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFDDE4EA), width: 2),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: FlutterMap(
                  mapController: _map,
                  options: MapOptions(
                    initialCenter: selected,
                    initialZoom: _selectedLocation == null ? 12 : 16,
                    onTap: (tapPosition, point) =>
                        _setLocation(point, null, 'manual'),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate:
                          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.korvi.mobile',
                    ),
                    CircleLayer(
                      circles: [
                        if (_selectedLocation != null)
                          CircleMarker(
                            point: _selectedLocation!,
                            radius: _nearbyRadiusMeters,
                            useRadiusInMeter: true,
                            color: const Color(0x1F00C2A8),
                            borderColor: const Color(0x6600C2A8),
                            borderStrokeWidth: 2,
                          ),
                      ],
                    ),
                    MarkerLayer(
                      markers: [
                        ..._nearbyReports.map(
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
                        if (_selectedLocation != null)
                          Marker(
                            point: _selectedLocation!,
                            width: 56,
                            height: 66,
                            child: PulseHalo(
                              child: RiskPin(
                                icon: Icons.add_location_alt,
                                color: const Color(0xFF00C2A8),
                                riskLevel: _riskLevel,
                                selected: true,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _locating ? null : _useGps,
                icon: _locating
                    ? const SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.gps_fixed),
                label: const Text('Usar GPS'),
              ),
              OutlinedButton.icon(
                onPressed: _selectedLocation == null
                    ? null
                    : () => _map.move(_selectedLocation!, 17),
                icon: const Icon(Icons.center_focus_strong),
                label: const Text('Centrar punto'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (_selectedLocation != null)
            Text(
              'Coordenadas: ${_selectedLocation!.latitude.toStringAsFixed(7)}, ${_selectedLocation!.longitude.toStringAsFixed(7)}'
              '${_locationAccuracy == null ? ' · Manual' : ' · Precision ${_locationAccuracy!.round()} m'}',
            ),
          if (_nearbyReports.isNotEmpty) ...[
            const SizedBox(height: 10),
            _NearbyReportsCard(reports: _nearbyReports, colorFor: _colorFor),
          ] else if (!_loadingNearby && _selectedLocation != null) ...[
            const SizedBox(height: 10),
            const Text('No hay reportes cercanos en 50 m.'),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: TextField(
                      controller: _province,
                      decoration:
                          const InputDecoration(labelText: 'Provincia'))),
              const SizedBox(width: 12),
              Expanded(
                  child: TextField(
                      controller: _municipality,
                      decoration:
                          const InputDecoration(labelText: 'Municipio'))),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
              controller: _address,
              decoration:
                  const InputDecoration(labelText: 'Direccion o referencia')),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Nivel de riesgo: $_riskLevel',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              TextButton(
                  onPressed: _resetRiskSuggestion,
                  child: const Text('Usar sugerido')),
            ],
          ),
          Slider(
            value: _riskLevel.toDouble(),
            min: 1,
            max: 5,
            divisions: 4,
            label: '$_riskLevel',
            onChanged: (value) {
              setState(() {
                _riskLevel = value.round();
                _riskManuallyAdjusted = _riskLevel != _suggestedRiskLevel;
                _riskReason = _riskManuallyAdjusted
                    ? 'Nivel ajustado manualmente. Sugerencia: $_suggestedRiskLevel/5.'
                    : _riskReason;
              });
            },
          ),
          AnimatedSwitcher(
            duration: KorviMotion.normal,
            child: _RiskReasonCard(
                key: ValueKey(_riskReason),
                level: _riskLevel,
                reason: _riskReason,
                color: _colorFor(_riskLevel)),
          ),
          const SizedBox(height: 18),
          const _SectionHeader(
              number: '03',
              title: 'Evidencia',
              subtitle: 'Hasta 5 imagenes desde camara o galeria.'),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _photos.length >= 5
                    ? null
                    : () => _pickPhotos(ImageSource.camera),
                icon: const Icon(Icons.photo_camera),
                label: const Text('Camara'),
              ),
              OutlinedButton.icon(
                onPressed: _photos.length >= 5
                    ? null
                    : () => _pickPhotos(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: const Text('Galeria'),
              ),
              InputChip(
                avatar: const Icon(Icons.collections, size: 18),
                label: Text('${_photos.length}/5 adjuntas'),
                backgroundColor: const Color(0xFFE5FBF7),
              ),
            ],
          ),
          if (_photos.isNotEmpty) ...[
            const SizedBox(height: 12),
            AnimatedSize(
              duration: KorviMotion.normal,
              curve: KorviMotion.curve,
              child: SizedBox(
                height: 110,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _photos.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(width: 10),
                  itemBuilder: (context, index) {
                    return MotionFadeSlide(
                      key: ValueKey(_photos[index].path),
                      offset: const Offset(16, 0),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.file(_photos[index],
                                width: 120, height: 110, fit: BoxFit.cover),
                          ),
                          Positioned(
                            right: 4,
                            top: 4,
                            child: IconButton.filledTonal(
                              onPressed: () =>
                                  setState(() => _photos.removeAt(index)),
                              icon: const Icon(Icons.close),
                              tooltip: 'Quitar evidencia',
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
          if (_message != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_message!)),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: _loading ? null : _submit,
            icon: _loading
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.send),
            label: const Text('Crear reporte'),
          ),
        ],
      ),
    );
  }

  void _onTitleChanged() {
    if (_applyingSuggestion) return;
    _titleManuallyAdjusted = _normalizeField(_title.text) !=
        _normalizeField(_suggestions[_category]?.title);
    _updateRiskSuggestion();
  }

  void _onDescriptionChanged() {
    if (_applyingSuggestion) return;
    _descriptionManuallyAdjusted = _normalizeField(_description.text) !=
        _normalizeField(_suggestions[_category]?.description);
    _updateRiskSuggestion();
  }

  void _changeCategory(ReportCategory category) {
    setState(() => _category = category);
    _applyCategorySuggestion(category);
    _updateRiskSuggestion();
    if (_requiresEmergencyCall(category)) _showEmergencyPrompt();
  }

  void _applyCategorySuggestion(ReportCategory category) {
    final suggestion =
        _suggestions[category] ?? _suggestions[ReportCategory.other]!;
    _applyingSuggestion = true;
    if (!_titleManuallyAdjusted) {
      _title.text = suggestion.title;
    }
    if (!_descriptionManuallyAdjusted) {
      _description.text = suggestion.description;
    }
    _applyingSuggestion = false;
    _updateRiskSuggestion();
  }

  void _updateRiskSuggestion() {
    final next = _calculateRiskLevel();
    setState(() {
      _suggestedRiskLevel = next.level;
      if (!_riskManuallyAdjusted) _riskLevel = next.level;
      _riskReason = _riskManuallyAdjusted
          ? 'Nivel ajustado manualmente. Sugerencia: ${next.level}/5.'
          : next.reason;
    });
  }

  void _resetRiskSuggestion() {
    final next = _calculateRiskLevel();
    setState(() {
      _riskManuallyAdjusted = false;
      _suggestedRiskLevel = next.level;
      _riskLevel = next.level;
      _riskReason = next.reason;
    });
  }

  ({int level, String reason}) _calculateRiskLevel() {
    final baseByCategory = <ReportCategory, int>{
      ReportCategory.accident: 5,
      ReportCategory.recklessDriving: 5,
      ReportCategory.dangerousCrossing: 4,
      ReportCategory.trafficLightDamaged: 4,
      ReportCategory.roadDamage: 4,
      ReportCategory.roadObstruction: 4,
      ReportCategory.floodZone: 5,
      ReportCategory.poorLighting: 3,
      ReportCategory.missingSignage: 3,
      ReportCategory.other: 2,
    };
    var level = baseByCategory[_category] ?? 3;
    final text = _normalizeText('${_title.text} ${_description.text}');
    const critical = [
      'muerto',
      'fallecido',
      'herido',
      'lesionado',
      'sangre',
      'incendio',
      'fuego',
      'explosion',
      'derrumbe',
      'choque',
      'accidente',
      'inundado',
      'inundacion',
      'agua alta',
      'arrastre',
    ];
    const exposure = [
      'escuela',
      'nino',
      'nina',
      'peaton',
      'motociclista',
      'autopista',
      'puente',
      'tunel',
      'interseccion',
      'curva',
      'sin luz',
      'bloqueado',
      'canada',
      'drenaje',
    ];
    if (critical.any(text.contains)) {
      level = level < 5 ? 5 : level;
    } else if (exposure.any(text.contains)) {
      level = level < 4 ? 4 : level;
    }
    level = level.clamp(1, 5);
    return (
      level: level,
      reason:
          'Nivel $level/5 calculado por categoria y senales detectadas en el texto.'
    );
  }

  Future<void> _loadExistingReports() async {
    setState(() => _loadingNearby = true);
    try {
      final reports = await widget.reports.mapPoints(limit: 100);
      setState(() {
        _existingReports = reports.where(_isOpenValidReport).toList();
      });
      _refreshNearbyReports();
    } catch (_) {
      setState(() => _existingReports = []);
    } finally {
      if (mounted) setState(() => _loadingNearby = false);
    }
  }

  Future<void> _useGps() async {
    setState(() {
      _locating = true;
      _message = null;
      _locationMessage = 'Solicitando ubicacion del dispositivo...';
    });
    try {
      final position = await widget.location.currentPosition();
      _setLocation(
        LatLng(position.latitude, position.longitude),
        position.accuracy,
        _isInDominicanRepublic(position.latitude, position.longitude)
            ? 'device'
            : 'device-outside-rd',
      );
    } catch (_) {
      setState(() => _locationMessage =
          'No se pudo usar GPS. Toca el mapa para seleccionar el punto.');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _setLocation(LatLng location, double? accuracy, String source) {
    setState(() {
      _selectedLocation = location;
      _locationAccuracy = accuracy;
      _locationMessage = switch (source) {
        'device' => 'Ubicacion GPS confirmada.',
        'device-outside-rd' =>
          'GPS fuera de RD. Ajusta el punto manualmente sobre el mapa.',
        _ => 'Ubicacion seleccionada manualmente en el mapa.',
      };
      if (source == 'device-outside-rd') {
        _selectedLocation = _mapCenterFromReports();
        _locationAccuracy = null;
      }
    });
    _map.move(_selectedLocation!, 16);
    _refreshNearbyReports();
  }

  LatLng _mapCenterFromReports() {
    if (_existingReports.isEmpty) return _defaultLocation;
    final latitude = _existingReports
            .map((report) => report.latitude)
            .reduce((a, b) => a + b) /
        _existingReports.length;
    final longitude = _existingReports
            .map((report) => report.longitude)
            .reduce((a, b) => a + b) /
        _existingReports.length;
    return LatLng(latitude, longitude);
  }

  void _refreshNearbyReports() {
    final selected = _selectedLocation;
    if (selected == null) {
      setState(() => _nearbyReports = []);
      return;
    }
    final nearby = _existingReports
        .map((report) {
          final distance = Geolocator.distanceBetween(
            selected.latitude,
            selected.longitude,
            report.latitude,
            report.longitude,
          );
          return (report: report, distance: distance);
        })
        .where((item) => item.distance <= _nearbyRadiusMeters)
        .toList()
      ..sort((a, b) => a.distance.compareTo(b.distance));
    setState(() => _nearbyReports = nearby.map((item) => item.report).toList());
  }

  Future<void> _pickPhotos(ImageSource source) async {
    final remaining = 5 - _photos.length;
    if (remaining <= 0) return;

    final picked = source == ImageSource.camera
        ? [
            if (await _picker.pickImage(source: source, imageQuality: 82)
                case final photo?)
              photo,
          ]
        : await _picker.pickMultiImage(imageQuality: 82, limit: remaining);

    setState(() {
      _photos = [
        ..._photos,
        ...picked.take(remaining).map((photo) => File(photo.path)),
      ];
    });
  }

  Future<void> _submit() async {
    final location = _selectedLocation;
    if (location == null) {
      setState(() => _message = 'Debes seleccionar la ubicacion del reporte.');
      return;
    }
    if (_title.text.trim().isEmpty || _description.text.trim().isEmpty) {
      setState(() => _message = 'Titulo y descripcion son obligatorios.');
      return;
    }

    setState(() {
      _loading = true;
      _message = _photos.isEmpty
          ? 'Sin imagenes adjuntas. Guardando el reporte...'
          : 'Verificando imagenes antes de guardar el reporte...';
    });
    try {
      final result = await widget.reports.createReport(
        title: _title.text,
        category: _category,
        description: _description.text,
        latitude: location.latitude,
        longitude: location.longitude,
        riskLevel: _riskLevel,
        province: _province.text,
        municipality: _municipality.text,
        address: _address.text,
        photos: _photos,
      );
      setState(() {
        _message = result.reused
            ? result.confirmationAdded
                ? 'Ya existia un reporte cercano. Agregamos tu confirmacion.'
                : 'Ya habias confirmado este riesgo anteriormente.'
            : 'Reporte enviado correctamente.';
        _titleManuallyAdjusted = false;
        _descriptionManuallyAdjusted = false;
        _riskManuallyAdjusted = false;
        _photos = [];
        _selectedLocation = null;
        _province.clear();
        _municipality.clear();
        _address.clear();
      });
      _applyCategorySuggestion(_category);
      await _loadExistingReports();
    } catch (error) {
      setState(
        () => _message = _moderationErrorMessage(error) ??
            'No fue posible enviar el reporte.',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _moderationErrorMessage(Object error) {
    if (error is! DioException) return null;
    final data = error.response?.data;
    if (data is! Map) return null;

    final message = data['message'];
    final blockedCategories = data['blockedCategories'];
    if (message is! String && blockedCategories is! List) return null;

    final categories = blockedCategories is List && blockedCategories.isNotEmpty
        ? ' Categorias detectadas: ${blockedCategories.join(', ')}.'
        : '';
    return '${message is String ? message : 'Una imagen adjunta no paso la verificacion de contenido.'}$categories';
  }

  void _showEmergencyPrompt() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.emergency, color: Color(0xFFD83B2D)),
        title: const Text('Esta categoria puede requerir emergencia'),
        content: const Text(
          'Si hay personas heridas, peligro inmediato o bloqueo critico, llama al 911. '
          'El reporte puede continuar luego de registrar la emergencia.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Continuar')),
          FilledButton.icon(
            onPressed: () async {
              Navigator.of(context).pop();
              final location = _selectedLocation;
              await widget.reports.logEmergencyCall(
                category: _category,
                title: _title.text,
                latitude: location?.latitude,
                longitude: location?.longitude,
                province: _province.text,
                municipality: _municipality.text,
                address: _address.text,
                source: 'mobile-report-create-emergency-modal',
              );
              await launchUrl(
                  Uri(scheme: 'tel', path: AppConfig.emergencyPhone));
            },
            icon: const Icon(Icons.call),
            label: const Text('Llamar 911'),
          ),
        ],
      ),
    );
  }

  bool _requiresEmergencyCall(ReportCategory category) {
    return category == ReportCategory.accident ||
        category == ReportCategory.floodZone;
  }

  bool _isOpenValidReport(ReportPoint report) {
    return report.status != 'RESOLVED' &&
        report.status != 'REJECTED' &&
        _isInDominicanRepublic(report.latitude, report.longitude);
  }

  bool _isInDominicanRepublic(double latitude, double longitude) {
    return latitude >= 17.4 &&
        latitude <= 20.1 &&
        longitude >= -72.2 &&
        longitude <= -68;
  }

  Color _colorFor(int riskLevel) {
    if (riskLevel >= 5) return const Color(0xFFD83B2D);
    if (riskLevel == 4) return const Color(0xFFFF6B35);
    if (riskLevel == 3) return const Color(0xFFFFA37F);
    return const Color(0xFF00C2A8);
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
      _ => Icons.warning,
    };
  }

  String _normalizeField(String? value) => (value ?? '').trim();

  String _normalizeText(String value) {
    const replacements = {
      'á': 'a',
      'é': 'e',
      'í': 'i',
      'ó': 'o',
      'ú': 'u',
      'ü': 'u',
      'ñ': 'n',
    };
    var normalized = value.toLowerCase();
    replacements
        .forEach((from, to) => normalized = normalized.replaceAll(from, to));
    return normalized;
  }
}

class _ReportHero extends StatelessWidget {
  const _ReportHero({
    required this.category,
    required this.riskLevel,
    required this.reportsNearby,
    required this.color,
  });

  final String category;
  final int riskLevel;
  final int reportsNearby;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFE5FBF7), Color(0xFFC9F5EE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.add_road, color: Color(0xFF00C2A8)),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Crear alerta vial',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF102033),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: riskLevel / 5,
              minHeight: 7,
              backgroundColor: Colors.white,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _HeroMetric(label: 'Categoria', value: category),
              ),
              const SizedBox(width: 10),
              _HeroMetric(label: 'Riesgo', value: '$riskLevel/5'),
              const SizedBox(width: 10),
              _HeroMetric(label: 'Cerca', value: '$reportsNearby'),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF6B7785))),
          const SizedBox(height: 3),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF102033))),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(
      {required this.number, required this.title, required this.subtitle});

  final String number;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12, top: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE5FBF7),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFC9F5EE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: Colors.white,
            foregroundColor: const Color(0xFF0B1F3A),
            child: Text(number,
                style:
                    const TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w900)),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NearbyReportsCard extends StatelessWidget {
  const _NearbyReportsCard({required this.reports, required this.colorFor});

  final List<ReportPoint> reports;
  final Color Function(int riskLevel) colorFor;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFDDE4EA)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reportes cercanos en 50 m',
                style: Theme.of(context)
                    .textTheme
                    .titleSmall
                    ?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            ...reports.take(4).map(
                  (report) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    leading: CircleAvatar(
                      backgroundColor: colorFor(report.riskLevel),
                      foregroundColor: Colors.white,
                      child: Text('${report.riskLevel}'),
                    ),
                    title: Text(report.title,
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${report.category} - ${report.status} - ${report.confirmationCount} confirmaciones\nConfirmado por: ${_confirmersLabel(report)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }

  String _confirmersLabel(ReportPoint report) {
    final names = report.confirmers
        .map((user) => user.fullName)
        .where((name) => name.trim().isNotEmpty)
        .toList();
    return names.isEmpty ? 'Sin confirmar' : names.join(', ');
  }
}

class _RiskReasonCard extends StatelessWidget {
  const _RiskReasonCard(
      {super.key,
      required this.level,
      required this.reason,
      required this.color});

  final int level;
  final String reason;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Color.lerp(color, Colors.white, 0.88),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Color.lerp(color, Colors.white, 0.55)!),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Text('$level',
                style: const TextStyle(
                    color: Colors.white, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 12),
          Expanded(
              child: Text(reason,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: Color(0xFF102033)))),
        ],
      ),
    );
  }
}
