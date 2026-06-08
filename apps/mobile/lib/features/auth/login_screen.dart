import 'package:dio/dio.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../core/auth_repository.dart';
import '../../shared/korvi_letter_loader.dart';

const _korviNavy = Color(0xFF0B1F3A);
const _korviTeal = Color(0xFF00C2A8);
const _korviOrange = Color(0xFFFF6B35);
const _korviBg = Color(0xFFF8FAFC);
const _korviTextMuted = Color(0xFF64748B);
const _korviBorder = Color(0xFFE2E8F0);

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.auth,
    required this.onAuthenticated,
  });

  final AuthRepository auth;
  final VoidCallback onAuthenticated;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static bool _googleInitialized = false;

  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  bool _googleEnabled = true;
  bool _facebookEnabled = true;
  String? _socialLoading;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadSocialAuthConfig();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _korviBg,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 430),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(28, 28, 28, 24),
              children: [
                const SizedBox(height: 14),
                const _AuthBrandHeader(
                  title: 'Iniciar sesion',
                  subtitle:
                      'Accede a KORVI Drive para reportar riesgos, consultar el mapa y usar el modo emergencia.',
                ),
                const SizedBox(height: 36),
                _AuthTextField(
                  controller: _email,
                  icon: Icons.mail_outline_rounded,
                  hint: 'Correo',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 14),
                _AuthTextField(
                  controller: _password,
                  icon: Icons.lock_outline_rounded,
                  hint: 'Contrasena',
                  obscureText: !_showPassword,
                  suffix: IconButton(
                    tooltip:
                        _showPassword ? 'Ocultar contrasena' : 'Ver contrasena',
                    onPressed: () =>
                        setState(() => _showPassword = !_showPassword),
                    icon: Icon(
                      _showPassword
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                    ),
                  ),
                  onSubmitted: (_) {
                    if (!_isBusy) _login();
                  },
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: _showRecoverySheet,
                    child: const Text('Olvide mi contrasena'),
                  ),
                ),
                if (_error != null)
                  _AuthMessage(message: _error!, isError: true),
                const SizedBox(height: 12),
                _AuthPrimaryButton(
                  label: 'Entrar',
                  icon: Icons.login_rounded,
                  loading: _loading,
                  onPressed: _isBusy ? null : _login,
                ),
                if (_googleEnabled || _facebookEnabled) ...[
                  const SizedBox(height: 18),
                  const _AuthDivider(label: 'O'),
                  const SizedBox(height: 18),
                  if (_googleEnabled) ...[
                    _AuthOutlineAction(
                      leading: const _ProviderMark(
                          label: 'G', color: Color(0xFF4285F4)),
                      label: _socialLoading == 'google'
                          ? 'Conectando con Google'
                          : 'Continuar con Google',
                      loading: _socialLoading == 'google',
                      onPressed: _isBusy ? null : _loginWithGoogle,
                    ),
                  ],
                  if (_googleEnabled && _facebookEnabled)
                    const SizedBox(height: 10),
                  if (_facebookEnabled)
                    _AuthOutlineAction(
                      leading: const _ProviderMark(
                          label: 'f', color: Color(0xFF1877F2)),
                      label: _socialLoading == 'facebook'
                          ? 'Conectando con Facebook'
                          : 'Continuar con Facebook',
                      loading: _socialLoading == 'facebook',
                      onPressed: _isBusy ? null : _loginWithFacebook,
                    ),
                ],
                const SizedBox(height: 26),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Flexible(
                      child: Text(
                        'No tienes cuenta?',
                        style: TextStyle(color: _korviTextMuted),
                      ),
                    ),
                    TextButton(
                      onPressed: _showRegisterSheet,
                      child: const Text('Crear cuenta'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  bool get _isBusy => _loading || _socialLoading != null;

  Future<void> _loadSocialAuthConfig() async {
    try {
      final config = await widget.auth.socialAuthConfig();
      if (!mounted) return;
      setState(() {
        _googleEnabled = config.google;
        _facebookEnabled = config.facebook;
      });
    } catch (_) {
      // Mantiene la compatibilidad si el backend aun no expone la configuracion.
    }
  }

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.auth.login(_email.text, _password.text);
      widget.onAuthenticated();
    } catch (_) {
      setState(() => _error = 'No fue posible iniciar sesion.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loginWithGoogle() async {
    setState(() {
      _socialLoading = 'google';
      _error = null;
    });

    try {
      await _ensureGoogleInitialized();
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw UnsupportedError('Google Sign-In no esta disponible.');
      }

      final account = await GoogleSignIn.instance.authenticate(
        scopeHint: const ['email', 'profile'],
      );
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw StateError('Google no devolvio idToken.');
      }

      await widget.auth.socialLogin(provider: 'google', token: idToken);
      widget.onAuthenticated();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No fue posible iniciar sesion con Google.');
      }
    } finally {
      if (mounted) setState(() => _socialLoading = null);
    }
  }

  Future<void> _loginWithFacebook() async {
    setState(() {
      _socialLoading = 'facebook';
      _error = null;
    });

    try {
      final result = await FacebookAuth.instance.login(
        permissions: const ['email', 'public_profile'],
        loginTracking: LoginTracking.enabled,
      );

      if (result.status == LoginStatus.cancelled) return;
      if (result.status != LoginStatus.success) {
        throw StateError(result.message ?? 'Facebook login failed');
      }

      final token = result.accessToken?.tokenString;
      if (token == null || token.isEmpty) {
        throw StateError('Facebook no devolvio accessToken.');
      }

      await widget.auth.socialLogin(provider: 'facebook', token: token);
      widget.onAuthenticated();
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'No fue posible iniciar sesion con Facebook.');
      }
    } finally {
      if (mounted) setState(() => _socialLoading = null);
    }
  }

  Future<void> _ensureGoogleInitialized() async {
    if (_googleInitialized) return;

    const serverClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
    await GoogleSignIn.instance.initialize(
      serverClientId: serverClientId.isEmpty ? null : serverClientId,
    );
    _googleInitialized = true;
  }

  void _showRegisterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RegisterSheet(
        auth: widget.auth,
        onAuthenticated: widget.onAuthenticated,
      ),
    );
  }

  void _showRecoverySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RecoverySheet(auth: widget.auth),
    );
  }
}

class _RegisterSheet extends StatefulWidget {
  const _RegisterSheet({required this.auth, required this.onAuthenticated});

  final AuthRepository auth;
  final VoidCallback onAuthenticated;

  @override
  State<_RegisterSheet> createState() => _RegisterSheetState();
}

class _RegisterSheetState extends State<_RegisterSheet> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _province = TextEditingController();
  final _municipality = TextEditingController();
  String _vehicleType = 'Motocicleta';
  bool _loading = false;
  bool _showPassword = false;
  String? _message;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return _AuthSheetFrame(
      child: ListView(
        shrinkWrap: true,
        padding: EdgeInsets.fromLTRB(
          24,
          20,
          24,
          MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        children: [
          const _SheetHandle(),
          const _AuthBrandHeader(
            compact: true,
            title: 'Crear cuenta',
            subtitle: 'KORVI Drive',
          ),
          const SizedBox(height: 24),
          _AuthTextField(
            controller: _name,
            icon: Icons.person_outline_rounded,
            hint: 'Nombre completo',
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _AuthTextField(
            controller: _email,
            icon: Icons.mail_outline_rounded,
            hint: 'Correo',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _AuthTextField(
            controller: _password,
            icon: Icons.lock_outline_rounded,
            hint: 'Contrasena',
            obscureText: !_showPassword,
            suffix: IconButton(
              tooltip: _showPassword ? 'Ocultar contrasena' : 'Ver contrasena',
              onPressed: () => setState(() => _showPassword = !_showPassword),
              icon: Icon(
                _showPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _AuthTextField(
                  controller: _province,
                  icon: Icons.map_outlined,
                  hint: 'Provincia',
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _AuthTextField(
                  controller: _municipality,
                  icon: Icons.location_city_outlined,
                  hint: 'Municipio',
                  textInputAction: TextInputAction.next,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _vehicleType,
            decoration: _pillInputDecoration(
              hint: 'Tipo de usuario vial',
              icon: Icons.directions_car_filled_outlined,
            ),
            borderRadius: BorderRadius.circular(18),
            items: const [
              'Motocicleta',
              'Carro',
              'Peaton',
              'Transporte publico',
            ]
                .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                .toList(),
            onChanged: (value) =>
                setState(() => _vehicleType = value ?? _vehicleType),
          ),
          if (_message != null) _AuthMessage(message: _message!),
          if (_error != null) _AuthMessage(message: _error!, isError: true),
          const SizedBox(height: 18),
          _AuthPrimaryButton(
            label: 'Registrar y enviar codigo',
            icon: Icons.person_add_alt_1_rounded,
            loading: _loading,
            onPressed: _loading ? null : _register,
          ),
          const SizedBox(height: 22),
          const _AuthDivider(label: 'Activacion'),
          const SizedBox(height: 18),
          _OtpLikeField(controller: _code),
          const SizedBox(height: 14),
          _AuthOutlineAction(
            icon: Icons.verified_user_outlined,
            label: 'Activar cuenta',
            onPressed: _loading ? null : _activate,
          ),
          TextButton(
            onPressed: _loading ? null : _resendActivationCode,
            child: const Text('Reenviar codigo'),
          ),
        ],
      ),
    );
  }

  Future<void> _register() async {
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      await widget.auth.register(
        fullName: _name.text,
        email: _email.text,
        password: _password.text,
        province: _province.text,
        municipality: _municipality.text,
        vehicleType: _vehicleType,
      );
      setState(() => _message =
          'Cuenta creada. Revisa el codigo enviado al correo para activarla.');
    } catch (error) {
      setState(() =>
          _error = _authErrorMessage(error, 'No fue posible crear la cuenta.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _activate() async {
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      await widget.auth.activate(_email.text, _code.text);
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onAuthenticated();
    } catch (error) {
      setState(() => _error =
          _authErrorMessage(error, 'No fue posible activar la cuenta.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resendActivationCode() async {
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      await widget.auth.resendActivationCode(_email.text);
      setState(() =>
          _message = 'Si el correo esta pendiente, recibira un nuevo codigo.');
    } catch (error) {
      setState(() => _error =
          _authErrorMessage(error, 'No fue posible reenviar el codigo.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _RecoverySheet extends StatefulWidget {
  const _RecoverySheet({required this.auth});

  final AuthRepository auth;

  @override
  State<_RecoverySheet> createState() => _RecoverySheetState();
}

class _RecoverySheetState extends State<_RecoverySheet> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _showPassword = false;
  String? _message;
  String? _error;

  @override
  Widget build(BuildContext context) {
    return _AuthSheetFrame(
      child: ListView(
        shrinkWrap: true,
        padding: EdgeInsets.fromLTRB(
          24,
          20,
          24,
          MediaQuery.viewInsetsOf(context).bottom + 24,
        ),
        children: [
          const _SheetHandle(),
          const _AuthBrandHeader(
            compact: true,
            title: 'Recuperar acceso',
            subtitle: 'Te enviaremos un codigo para validar tu cuenta KORVI.',
          ),
          const SizedBox(height: 24),
          _AuthTextField(
            controller: _email,
            icon: Icons.mail_outline_rounded,
            hint: 'Correo',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 12),
          _OtpLikeField(controller: _code),
          const SizedBox(height: 12),
          _AuthTextField(
            controller: _password,
            icon: Icons.lock_reset_rounded,
            hint: 'Nueva contrasena',
            obscureText: !_showPassword,
            suffix: IconButton(
              tooltip: _showPassword ? 'Ocultar contrasena' : 'Ver contrasena',
              onPressed: () => setState(() => _showPassword = !_showPassword),
              icon: Icon(
                _showPassword
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
          if (_message != null) _AuthMessage(message: _message!),
          if (_error != null) _AuthMessage(message: _error!, isError: true),
          const SizedBox(height: 18),
          _AuthPrimaryButton(
            label: 'Enviar codigo',
            icon: Icons.mark_email_read_outlined,
            loading: _loading,
            onPressed: _loading ? null : _send,
          ),
          const SizedBox(height: 12),
          _AuthOutlineAction(
            icon: Icons.lock_reset_rounded,
            label: 'Cambiar contrasena',
            onPressed: _loading ? null : _reset,
          ),
        ],
      ),
    );
  }

  Future<void> _send() async {
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      await widget.auth.requestPasswordReset(_email.text);
      setState(() => _message =
          'Si el correo existe, recibira un codigo de recuperacion.');
    } catch (error) {
      setState(() => _error =
          _authErrorMessage(error, 'No fue posible enviar el codigo.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    setState(() {
      _loading = true;
      _error = null;
      _message = null;
    });
    try {
      await widget.auth.resetPassword(_email.text, _code.text, _password.text);
      setState(() =>
          _message = 'Contrasena actualizada. Vuelve al login para entrar.');
    } catch (error) {
      setState(() => _error =
          _authErrorMessage(error, 'No fue posible cambiar la contrasena.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }
}

class _AuthBrandHeader extends StatelessWidget {
  const _AuthBrandHeader({
    required this.title,
    required this.subtitle,
    this.compact = false,
  });

  final String title;
  final String subtitle;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _KorviWordmark(compact: compact),
        SizedBox(height: compact ? 18 : 26),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: _korviNavy,
                fontWeight: FontWeight.w900,
                letterSpacing: 0,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: _korviTextMuted,
                height: 1.35,
              ),
        ),
        const SizedBox(height: 10),
        const Text(
          'KORVI Drive',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: _korviOrange,
            fontSize: 11,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.8,
          ),
        ),
      ],
    );
  }
}

class _KorviWordmark extends StatelessWidget {
  const _KorviWordmark({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return RichText(
      textAlign: TextAlign.center,
      text: TextSpan(
        style: TextStyle(
          fontSize: compact ? 30 : 38,
          fontWeight: FontWeight.w900,
          letterSpacing: 1.1,
        ),
        children: const [
          TextSpan(
            text: 'KORVI',
            style: TextStyle(color: _korviNavy),
          ),
          TextSpan(
            text: ' Drive',
            style: TextStyle(
              color: _korviOrange,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthTextField extends StatelessWidget {
  const _AuthTextField({
    required this.controller,
    required this.icon,
    required this.hint,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.suffix,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final IconData icon;
  final String hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final Widget? suffix;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      obscureText: obscureText,
      onSubmitted: onSubmitted,
      style: const TextStyle(color: _korviNavy, fontWeight: FontWeight.w600),
      decoration: _pillInputDecoration(hint: hint, icon: icon).copyWith(
        suffixIcon: suffix,
      ),
    );
  }
}

class _OtpLikeField extends StatelessWidget {
  const _OtpLikeField({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      maxLength: 6,
      style: const TextStyle(
        color: _korviNavy,
        fontSize: 20,
        fontWeight: FontWeight.w900,
        letterSpacing: 8,
      ),
      decoration: _pillInputDecoration(
        hint: 'Codigo',
        icon: Icons.pin_outlined,
      ).copyWith(counterText: ''),
    );
  }
}

class _AuthPrimaryButton extends StatelessWidget {
  const _AuthPrimaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: _korviOrange,
          foregroundColor: Colors.white,
          disabledBackgroundColor: _korviOrange.withValues(alpha: 0.48),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w900),
        ),
        icon: loading
            ? const SizedBox(
                width: 46,
                child: KorviLetterLoader(
                  dark: true,
                  compact: true,
                  showLabel: false,
                ),
              )
            : Icon(icon ?? Icons.arrow_forward_rounded),
        label: Text(label),
      ),
    );
  }
}

class _AuthOutlineAction extends StatelessWidget {
  const _AuthOutlineAction({
    required this.label,
    required this.onPressed,
    this.icon,
    this.leading,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Widget? leading;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: _korviNavy,
          side: const BorderSide(color: _korviBorder),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
          backgroundColor: Colors.white,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (loading)
              const SizedBox(
                width: 46,
                child: KorviLetterLoader(
                  compact: true,
                  showLabel: false,
                ),
              )
            else
              leading ?? Icon(icon ?? Icons.arrow_forward_rounded, size: 20),
            const SizedBox(width: 10),
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
          ],
        ),
      ),
    );
  }
}

class _AuthDivider extends StatelessWidget {
  const _AuthDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: _korviBorder)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            label,
            style: const TextStyle(
              color: _korviTextMuted,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const Expanded(child: Divider(color: _korviBorder)),
      ],
    );
  }
}

class _AuthMessage extends StatelessWidget {
  const _AuthMessage({required this.message, this.isError = false});

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final color = isError ? Theme.of(context).colorScheme.error : _korviTeal;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: TextStyle(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _AuthSheetFrame extends StatelessWidget {
  const _AuthSheetFrame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.92,
      ),
      decoration: const BoxDecoration(
        color: _korviBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SafeArea(top: false, child: child),
    );
  }
}

class _SheetHandle extends StatelessWidget {
  const _SheetHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        margin: const EdgeInsets.only(bottom: 18),
        decoration: BoxDecoration(
          color: _korviBorder,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}

class _ProviderMark extends StatelessWidget {
  const _ProviderMark({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        color: color,
        fontSize: 18,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

InputDecoration _pillInputDecoration({
  required String hint,
  required IconData icon,
}) {
  return InputDecoration(
    hintText: hint,
    hintStyle:
        const TextStyle(color: _korviTextMuted, fontWeight: FontWeight.w500),
    prefixIcon: Icon(icon, color: _korviTextMuted, size: 20),
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(999),
      borderSide: const BorderSide(color: Colors.white),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(999),
      borderSide: const BorderSide(color: _korviTeal, width: 1.5),
    ),
    errorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(999),
      borderSide: const BorderSide(color: _korviOrange),
    ),
    focusedErrorBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(999),
      borderSide: const BorderSide(color: _korviOrange, width: 1.5),
    ),
  );
}

String _authErrorMessage(Object error, String fallback) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final message = data['message'];
      if (message is String && message.isNotEmpty) return message;
      if (message is List && message.isNotEmpty) return message.join('\n');
    }
  }
  return fallback;
}
