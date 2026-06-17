class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://korvii-api-prod.up.railway.app/api',
  );

  static const appName = 'KORVI Drive';
  static const emergencyPhone = '911';
}
