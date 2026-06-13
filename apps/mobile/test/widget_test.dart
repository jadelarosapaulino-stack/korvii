import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ruta_segura_mobile/core/auth_repository.dart';
import 'package:ruta_segura_mobile/core/models.dart';
import 'package:ruta_segura_mobile/features/auth/login_screen.dart';

void main() {
  testWidgets('login calls onAuthenticated after valid credentials',
      (tester) async {
    final auth = _FakeAuthRepository();
    var authenticated = false;

    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(
          auth: auth,
          onAuthenticated: () => authenticated = true,
        ),
      ),
    );

    await tester.enterText(
        find.widgetWithText(TextField, 'Correo').first, ' ciudadano@demo.com ');
    await tester.enterText(
        find.widgetWithText(TextField, 'Contrasena').first, 'Demo12345');
    await tester.tap(find.widgetWithText(FilledButton, 'Entrar'));
    await tester.pumpAndSettle();

    expect(auth.email, ' ciudadano@demo.com ');
    expect(auth.password, 'Demo12345');
    expect(authenticated, isTrue);
  });
}

class _FakeAuthRepository implements AuthRepository {
  String? email;
  String? password;

  @override
  Future<AuthUser> login(String email, String password) async {
    this.email = email;
    this.password = password;
    return AuthUser(
      id: 'user-1',
      fullName: 'Ciudadano Demo',
      email: email.trim(),
      role: 'CITIZEN',
    );
  }

  @override
  Future<AuthUser> socialLogin({
    required String provider,
    required String token,
  }) =>
      throw UnimplementedError();

  @override
  Future<SocialAuthConfig> socialAuthConfig() async =>
      const SocialAuthConfig(google: true, facebook: true);

  @override
  Future<AuthUser> activate(String email, String code) =>
      throw UnimplementedError();

  @override
  Future<void> logout() => throw UnimplementedError();

  @override
  Future<AuthUser> me() => throw UnimplementedError();

  @override
  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? province,
    String? municipality,
    String? vehicleType,
  }) =>
      throw UnimplementedError();

  @override
  Future<void> requestPasswordReset(String email) => throw UnimplementedError();

  @override
  Future<void> resendActivationCode(String email) => throw UnimplementedError();

  @override
  Future<void> resetPassword(String email, String code, String password) =>
      throw UnimplementedError();

  @override
  Future<void> changePassword(String currentPassword, String newPassword) =>
      throw UnimplementedError();

  @override
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
  }) =>
      throw UnimplementedError();
}
