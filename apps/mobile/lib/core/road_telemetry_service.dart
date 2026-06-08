import 'dart:async';
import 'dart:math';

import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';

import 'reports_repository.dart';

class RoadTelemetryService {
  RoadTelemetryService(this._reports);

  final ReportsRepository _reports;
  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  StreamSubscription<Position>? _positionSubscription;
  Position? _lastPosition;
  DateTime? _lastImpactSentAt;
  DateTime? _lastSpeedDropSentAt;
  bool _running = false;
  bool _sending = false;

  bool get running => _running;

  Future<void> start() async {
    if (_running) return;

    final permission = await Geolocator.checkPermission();
    var nextPermission = permission;
    if (nextPermission == LocationPermission.denied) {
      nextPermission = await Geolocator.requestPermission();
    }
    if (nextPermission == LocationPermission.denied ||
        nextPermission == LocationPermission.deniedForever) {
      throw Exception('La app necesita permiso de ubicacion.');
    }

    _running = true;
    _accelerometerSubscription = accelerometerEventStream(
      samplingPeriod: const Duration(milliseconds: 250),
    ).listen(_handleAcceleration);
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 8,
      ),
    ).listen(_handlePosition);
  }

  Future<void> stop() async {
    _running = false;
    await _accelerometerSubscription?.cancel();
    await _positionSubscription?.cancel();
    _accelerometerSubscription = null;
    _positionSubscription = null;
    _lastPosition = null;
  }

  void dispose() {
    unawaited(stop());
  }

  void _handleAcceleration(AccelerometerEvent event) {
    final position = _lastPosition;
    if (!_running || position == null || position.accuracy > 45) return;

    final magnitude =
        sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
    if (magnitude < 24) return;
    if (!_canSend(_lastImpactSentAt, const Duration(seconds: 45))) return;

    _lastImpactSentAt = DateTime.now();
    unawaited(_send(
      eventType: 'impact',
      latitude: position.latitude,
      longitude: position.longitude,
      accelerationMagnitude: magnitude,
      accuracyMeters: position.accuracy,
    ));
  }

  void _handlePosition(Position position) {
    if (!_running) return;
    final previous = _lastPosition;
    _lastPosition = position;
    if (previous == null || position.accuracy > 45) return;

    final beforeKmh = max<double>(0, previous.speed * 3.6);
    final afterKmh = max<double>(0, position.speed * 3.6);
    final seconds = max(
      1,
      position.timestamp.difference(previous.timestamp).inMilliseconds / 1000,
    );
    final drop = beforeKmh - afterKmh;
    final fastEnough = beforeKmh >= 18;
    final abruptEnough = drop >= 18 && seconds <= 8;

    if (!fastEnough || !abruptEnough) return;
    if (!_canSend(_lastSpeedDropSentAt, const Duration(seconds: 60))) return;

    _lastSpeedDropSentAt = DateTime.now();
    unawaited(_send(
      eventType: 'speed_drop',
      latitude: position.latitude,
      longitude: position.longitude,
      speedBeforeKmh: beforeKmh,
      speedAfterKmh: afterKmh,
      accuracyMeters: position.accuracy,
    ));
  }

  bool _canSend(DateTime? lastSentAt, Duration cooldown) {
    if (_sending) return false;
    if (lastSentAt == null) return true;
    return DateTime.now().difference(lastSentAt) >= cooldown;
  }

  Future<void> _send({
    required String eventType,
    required double latitude,
    required double longitude,
    double? accelerationMagnitude,
    double? speedBeforeKmh,
    double? speedAfterKmh,
    double? accuracyMeters,
  }) async {
    _sending = true;
    try {
      await _reports.sendRoadTelemetry(
        eventType: eventType,
        latitude: latitude,
        longitude: longitude,
        accelerationMagnitude: accelerationMagnitude,
        speedBeforeKmh: speedBeforeKmh,
        speedAfterKmh: speedAfterKmh,
        accuracyMeters: accuracyMeters,
      );
    } catch (_) {
      // La telemetria no debe interrumpir el uso del mapa.
    } finally {
      _sending = false;
    }
  }
}
