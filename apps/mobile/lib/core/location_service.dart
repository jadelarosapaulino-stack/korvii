import 'package:geolocator/geolocator.dart';

class LocationService {
  Future<Position> currentPosition() async {
    await _ensureLocationPermission();

    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
    );
  }

  Future<Stream<Position>> positionStream({
    LocationAccuracy accuracy = LocationAccuracy.bestForNavigation,
    int distanceFilterMeters = 5,
  }) async {
    await _ensureLocationPermission();

    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: accuracy,
        distanceFilter: distanceFilterMeters,
      ),
    );
  }

  Future<void> _ensureLocationPermission() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      throw Exception('El GPS esta desactivado.');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw Exception('La app necesita permiso de ubicacion.');
    }
  }
}
