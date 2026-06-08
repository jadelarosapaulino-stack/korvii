import 'package:flutter/material.dart';

class RiskPin extends StatelessWidget {
  const RiskPin({
    super.key,
    required this.icon,
    required this.color,
    required this.riskLevel,
    this.selected = false,
  });

  final IconData icon;
  final Color color;
  final int riskLevel;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final size = selected ? 46.0 : 38.0;
    final height = size + 13;

    return SizedBox(
      width: size,
      height: height,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          CustomPaint(
            size: Size(size, height),
            painter: _RiskPinPainter(
              color: color,
              borderWidth: selected ? 3 : 2.5,
            ),
          ),
          SizedBox(
            width: size,
            height: size,
            child: Icon(icon, color: Colors.white, size: selected ? 23 : 19),
          ),
          Positioned(
            right: 0,
            top: 0,
            child: Container(
              width: selected ? 23 : 20,
              height: selected ? 23 : 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0xFF172126),
                border: Border.all(color: Colors.white, width: 1.8),
                shape: BoxShape.circle,
              ),
              child: Text(
                '$riskLevel',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RiskPinPainter extends CustomPainter {
  const _RiskPinPainter({required this.color, required this.borderWidth});

  final Color color;
  final double borderWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width / 2, size.height - 1)
      ..cubicTo(
        size.width * 0.39,
        size.height * 0.82,
        size.width * 0.08,
        size.height * 0.66,
        size.width * 0.08,
        size.height * 0.38,
      )
      ..cubicTo(
        size.width * 0.08,
        size.height * 0.15,
        size.width * 0.25,
        0,
        size.width / 2,
        0,
      )
      ..cubicTo(
        size.width * 0.75,
        0,
        size.width * 0.92,
        size.height * 0.15,
        size.width * 0.92,
        size.height * 0.38,
      )
      ..cubicTo(
        size.width * 0.92,
        size.height * 0.66,
        size.width * 0.61,
        size.height * 0.82,
        size.width / 2,
        size.height - 1,
      )
      ..close();

    final fill = Paint()..color = color;
    canvas.drawPath(path, fill);

    final border = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;
    canvas.drawPath(path, border);
  }

  @override
  bool shouldRepaint(covariant _RiskPinPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.borderWidth != borderWidth;
}
