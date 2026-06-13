import 'api_client.dart';
import 'models.dart';

class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  Future<AuthUser> login(String email, String password) async {
    final response = await _api.dio.post('/auth/login', data: {
      'email': email.trim(),
      'password': password,
    });
    await _api.saveToken(response.data['accessToken'] as String);
    return AuthUser.fromJson(response.data['user'] as Map<String, dynamic>);
  }

  Future<AuthUser> socialLogin({
    required String provider,
    required String token,
  }) async {
    final response = await _api.dio.post('/auth/social', data: {
      'provider': provider,
      'token': token,
    });
    await _api.saveToken(response.data['accessToken'] as String);
    return AuthUser.fromJson(response.data['user'] as Map<String, dynamic>);
  }

  Future<SocialAuthConfig> socialAuthConfig() async {
    final response = await _api.dio.get('/auth/social/config');
    return SocialAuthConfig.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? province,
    String? municipality,
    String? vehicleType,
  }) async {
    await _api.dio.post('/auth/register', data: {
      'fullName': fullName,
      'email': email.trim(),
      'password': password,
      'province': province,
      'municipality': municipality,
      'vehicleType': vehicleType,
    });
  }

  Future<void> resendActivationCode(String email) {
    return _api.dio.post('/auth/activation-code',
        data: {'email': email.trim()}).then((_) {});
  }

  Future<AuthUser> activate(String email, String code) async {
    final response = await _api.dio.post('/auth/activate', data: {
      'email': email.trim(),
      'code': code.trim(),
    });
    await _api.saveToken(response.data['accessToken'] as String);
    return AuthUser.fromJson(response.data['user'] as Map<String, dynamic>);
  }

  Future<void> requestPasswordReset(String email) {
    return _api.dio.post('/auth/password/forgot',
        data: {'email': email.trim()}).then((_) {});
  }

  Future<void> resetPassword(String email, String code, String password) {
    return _api.dio.post('/auth/password/reset', data: {
      'email': email.trim(),
      'code': code.trim(),
      'password': password,
    }).then((_) {});
  }

  Future<void> changePassword(String currentPassword, String newPassword) {
    return _api.dio.post('/auth/password/change', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    }).then((_) {});
  }

  Future<AuthUser> updateProfile({
    required String fullName,
    String? phone,
    String? province,
    String? municipality,
    String? occupation,
    String? vehicleType,
    String? mobilityMode,
    String? drivingFrequency,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? preferredContactChannel,
    bool? notificationsEnabled,
    bool? decisionInsightsConsent,
  }) async {
    final response = await _api.dio.patch('/auth/me', data: {
      'fullName': fullName.trim(),
      'phone': phone?.trim(),
      'province': province?.trim(),
      'municipality': municipality?.trim(),
      'occupation': occupation?.trim(),
      'vehicleType': vehicleType?.trim(),
      'mobilityMode': mobilityMode?.trim(),
      'drivingFrequency': drivingFrequency?.trim(),
      'emergencyContactName': emergencyContactName?.trim(),
      'emergencyContactPhone': emergencyContactPhone?.trim(),
      'preferredContactChannel': preferredContactChannel?.trim(),
      'notificationsEnabled': notificationsEnabled,
      'decisionInsightsConsent': decisionInsightsConsent,
    });
    return AuthUser.fromJson(response.data as Map<String, dynamic>);
  }

  Future<AuthUser> me() async {
    final response = await _api.dio.get('/auth/me');
    return AuthUser.fromJson(response.data as Map<String, dynamic>);
  }

  Future<void> logout() => _api.clearToken();
}

class SocialAuthConfig {
  const SocialAuthConfig({
    required this.google,
    required this.facebook,
  });

  final bool google;
  final bool facebook;

  factory SocialAuthConfig.fromJson(Map<String, dynamic> json) {
    return SocialAuthConfig(
      google: json['google'] == true,
      facebook: json['facebook'] == true,
    );
  }
}
