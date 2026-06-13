import 'package:flutter/material.dart';

class KorviMotion {
  const KorviMotion._();

  static const fast = Duration(milliseconds: 180);
  static const normal = Duration(milliseconds: 320);
  static const slow = Duration(milliseconds: 520);
  static const curve = Curves.easeOutCubic;
}

class MotionFadeSlide extends StatelessWidget {
  const MotionFadeSlide({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = KorviMotion.normal,
    this.offset = const Offset(0, 18),
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final Offset offset;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (reduceMotion) return child;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: duration + delay,
      curve: KorviMotion.curve,
      builder: (context, value, child) {
        final delayed = _delayedValue(value);
        return Opacity(
          opacity: delayed,
          child: Transform.translate(
            offset: Offset(
              offset.dx * (1 - delayed),
              offset.dy * (1 - delayed),
            ),
            child: child,
          ),
        );
      },
      child: child,
    );
  }

  double _delayedValue(double value) {
    if (delay == Duration.zero) return value;
    final total = duration + delay;
    final delayPortion = delay.inMicroseconds / total.inMicroseconds;
    if (value <= delayPortion) return 0;
    return ((value - delayPortion) / (1 - delayPortion)).clamp(0, 1);
  }
}

class MotionPressable extends StatefulWidget {
  const MotionPressable({
    super.key,
    required this.child,
    this.onTap,
    this.borderRadius = const BorderRadius.all(Radius.circular(18)),
  });

  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius borderRadius;

  @override
  State<MotionPressable> createState() => _MotionPressableState();
}

class _MotionPressableState extends State<MotionPressable> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Listener(
      onPointerDown: (_) => setState(() => _pressed = true),
      onPointerCancel: (_) => setState(() => _pressed = false),
      onPointerUp: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: !reduceMotion && _pressed ? 0.96 : 1,
        duration: KorviMotion.fast,
        curve: KorviMotion.curve,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: widget.onTap,
            borderRadius: widget.borderRadius,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}

class PulseHalo extends StatefulWidget {
  const PulseHalo({
    super.key,
    required this.child,
    this.color = const Color(0xFF00C2A8),
    this.size = 58,
  });

  final Widget child;
  final Color color;
  final double size;

  @override
  State<PulseHalo> createState() => _PulseHaloState();
}

class _PulseHaloState extends State<PulseHalo>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;

    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final pulse = Curves.easeOut.transform(_controller.value);
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: widget.size * (0.62 + pulse * 0.38),
                height: widget.size * (0.62 + pulse * 0.38),
                decoration: BoxDecoration(
                  color: widget.color.withValues(alpha: 0.24 * (1 - pulse)),
                  shape: BoxShape.circle,
                ),
              ),
              child!,
            ],
          );
        },
        child: widget.child,
      ),
    );
  }
}
