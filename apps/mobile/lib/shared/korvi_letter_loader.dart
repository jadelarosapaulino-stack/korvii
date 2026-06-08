import 'package:flutter/material.dart';

class KorviLetterLoader extends StatefulWidget {
  const KorviLetterLoader({
    super.key,
    this.label = 'Mobility intelligence',
    this.dark = false,
    this.compact = false,
    this.showLabel = true,
  });

  final String label;
  final bool dark;
  final bool compact;
  final bool showLabel;

  @override
  State<KorviLetterLoader> createState() => _KorviLetterLoaderState();
}

class _KorviLetterLoaderState extends State<KorviLetterLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1250),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final baseColor = widget.dark ? Colors.white : const Color(0xFF0B1F3A);
    final mutedColor =
        widget.dark ? const Color(0xFF00C2A8) : const Color(0xFF64748B);
    final size = widget.compact ? 14.0 : 30.0;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final activeIndex = (_controller.value * 5).floor().clamp(0, 4);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(5, (index) {
                final active = index == activeIndex;
                return AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 140),
                  curve: Curves.easeOut,
                  style: TextStyle(
                    color: active
                        ? (index.isEven
                            ? const Color(0xFF00C2A8)
                            : const Color(0xFFFF6B35))
                        : baseColor.withValues(
                            alpha: widget.dark ? 0.52 : 0.42),
                    fontSize: size,
                    fontWeight: FontWeight.w900,
                    letterSpacing: widget.compact ? 0.8 : 1.3,
                    shadows: active
                        ? [
                            Shadow(
                              color: (index.isEven
                                      ? const Color(0xFF00C2A8)
                                      : const Color(0xFFFF6B35))
                                  .withValues(alpha: 0.36),
                              blurRadius: widget.compact ? 8 : 16,
                            ),
                          ]
                        : null,
                  ),
                  child: Text('KORVI'[index]),
                );
              }),
            ),
            if (widget.showLabel) ...[
              const SizedBox(height: 8),
              Text(
                widget.label.toUpperCase(),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: mutedColor,
                  fontSize: widget.compact ? 9 : 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}
