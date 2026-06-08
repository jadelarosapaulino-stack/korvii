class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api',
  );

  static const appName = 'KORVI Drive';
  static const emergencyPhone = '911';
}
