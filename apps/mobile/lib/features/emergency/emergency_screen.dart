import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_config.dart';
import '../../core/location_service.dart';
import '../../core/reports_repository.dart';

class EmergencyScreen extends StatefulWidget {
  const EmergencyScreen(
      {super.key, required this.reports, required this.location});

  final ReportsRepository reports;
  final LocationService location;

  @override
  State<EmergencyScreen> createState() => _EmergencyScreenState();
}

class _EmergencyScreenState extends State<EmergencyScreen> {
  bool _loading = false;
  String? _message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Modo emergencia')),
      body: ListView(
        padding: EdgeInsets.fromLTRB(
            20, 20, 20, MediaQuery.paddingOf(context).bottom + 120),
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(
                minHeight: MediaQuery.sizeOf(context).height - 260),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.emergency, size: 84, color: Color(0xFFD83B2D)),
                const SizedBox(height: 18),
                Text('Llamar a organismos de emergencia',
                    textAlign: TextAlign.center,
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                const Text(
                  'Usa esta opcion si hay personas heridas, peligro inmediato, inundacion activa o bloqueo critico de la via.',
                  textAlign: TextAlign.center,
                ),
                const Spacer(),
                if (_message != null)
                  Text(_message!, textAlign: TextAlign.center),
                const SizedBox(height: 14),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD83B2D),
                      minimumSize: const Size.fromHeight(56)),
                  onPressed: _loading ? null : _callEmergency,
                  icon: _loading
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.call),
                  label: const Text('Llamar al 911'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _callEmergency() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final position = await widget.location.currentPosition();
      await widget.reports.logEmergencyCall(
          latitude: position.latitude, longitude: position.longitude);
      await launchUrl(Uri(scheme: 'tel', path: AppConfig.emergencyPhone));
    } catch (_) {
      setState(() => _message =
          'No se pudo abrir la llamada, pero intenta marcar 911 manualmente.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}
