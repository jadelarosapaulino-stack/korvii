import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'core/api_client.dart';
import 'core/activity_repository.dart';
import 'core/app_config.dart';
import 'core/auth_repository.dart';
import 'core/education_repository.dart';
import 'core/location_service.dart';
import 'core/notification_service.dart';
import 'core/reports_repository.dart';
import 'features/auth/login_screen.dart';
import 'features/home/citizen_shell.dart';
import 'shared/korvi_letter_loader.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const storage = FlutterSecureStorage();
  final api = ApiClient(storage);
  final notifications = NotificationService();
  await notifications.init();

  runApp(
    KorviMobileApp(
      activity: ActivityRepository(api),
      auth: AuthRepository(api),
      reports: ReportsRepository(api),
      education: EducationRepository(api),
      location: LocationService(),
      notifications: notifications,
      initiallyAuthenticated: await api.hasToken(),
    ),
  );
}

class KorviMobileApp extends StatelessWidget {
  const KorviMobileApp({
    super.key,
    required this.activity,
    required this.auth,
    required this.reports,
    required this.education,
    required this.location,
    required this.notifications,
    required this.initiallyAuthenticated,
  });

  final ActivityRepository activity;
  final AuthRepository auth;
  final ReportsRepository reports;
  final EducationRepository education;
  final LocationService location;
  final NotificationService notifications;
  final bool initiallyAuthenticated;

  @override
  Widget build(BuildContext context) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF00C2A8),
      brightness: Brightness.light,
      primary: const Color(0xFF0B1F3A),
      secondary: const Color(0xFF00C2A8),
      tertiary: const Color(0xFFFF6B35),
      surface: Colors.white,
    );

    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: colorScheme,
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          centerTitle: false,
          elevation: 0,
          scrolledUnderElevation: 0,
          backgroundColor: Color(0xFFF8FAFC),
          foregroundColor: Color(0xFF102033),
          titleTextStyle: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w900,
              color: Color(0xFF102033)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide.none),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFFDDE4EA)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Color(0xFF00C2A8), width: 2),
          ),
          labelStyle: const TextStyle(color: Color(0xFF6B7785)),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF0B1F3A),
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(52),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF102033),
            side: const BorderSide(color: Color(0xFFDDE4EA)),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            textStyle: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        navigationBarTheme: NavigationBarThemeData(
          height: 78,
          elevation: 0,
          backgroundColor: Colors.white,
          indicatorColor: const Color(0xFFC9F5EE),
          labelTextStyle: WidgetStateProperty.all(
            const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Color(0xFF102033)),
          ),
          iconTheme: WidgetStateProperty.resolveWith((states) {
            return IconThemeData(
              color: states.contains(WidgetState.selected)
                  ? const Color(0xFF00C2A8)
                  : const Color(0xFF6B7785),
              size: states.contains(WidgetState.selected) ? 29 : 26,
            );
          }),
        ),
      ),
      home: _SessionGate(
        auth: auth,
        activity: activity,
        reports: reports,
        education: education,
        location: location,
        notifications: notifications,
        initiallyAuthenticated: initiallyAuthenticated,
      ),
    );
  }
}

class _SessionGate extends StatefulWidget {
  const _SessionGate({
    required this.auth,
    required this.activity,
    required this.reports,
    required this.education,
    required this.location,
    required this.notifications,
    required this.initiallyAuthenticated,
  });

  final AuthRepository auth;
  final ActivityRepository activity;
  final ReportsRepository reports;
  final EducationRepository education;
  final LocationService location;
  final NotificationService notifications;
  final bool initiallyAuthenticated;

  @override
  State<_SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<_SessionGate> {
  late bool _authenticated = widget.initiallyAuthenticated;
  late bool _checkingSession = widget.initiallyAuthenticated;

  @override
  void initState() {
    super.initState();
    if (_checkingSession) {
      _validateSession();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingSession) {
      return const Scaffold(
        body: Center(
          child: KorviLetterLoader(
            label: 'KORVI Drive',
          ),
        ),
      );
    }

    if (!_authenticated) {
      return LoginScreen(
        auth: widget.auth,
        onAuthenticated: () {
          setState(() => _authenticated = true);
          widget.activity
              .track(
                  eventType: 'auth', action: 'login_success', screen: 'login')
              .catchError((_) {});
        },
      );
    }

    return CitizenShell(
      auth: widget.auth,
      activity: widget.activity,
      reports: widget.reports,
      education: widget.education,
      location: widget.location,
      notifications: widget.notifications,
      onLogout: () => setState(() => _authenticated = false),
    );
  }

  Future<void> _validateSession() async {
    try {
      await widget.auth.me();
      if (!mounted) return;
      setState(() {
        _authenticated = true;
        _checkingSession = false;
      });
    } catch (_) {
      await widget.auth.logout();
      if (!mounted) return;
      setState(() {
        _authenticated = false;
        _checkingSession = false;
      });
    }
  }
}
