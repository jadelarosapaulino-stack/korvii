import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  final _notifications = FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _notifications
        .initialize(const InitializationSettings(android: android, iOS: ios));
  }

  Future<void> nearbyRiskAlert(String title, String body) {
    const androidDetails = AndroidNotificationDetails(
      'nearby-risk',
      'Alertas cercanas',
      channelDescription:
          'Alertas por reportes de alto riesgo cerca del ciudadano.',
      importance: Importance.high,
      priority: Priority.high,
    );
    return _notifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      const NotificationDetails(
          android: androidDetails, iOS: DarwinNotificationDetails()),
    );
  }
}
