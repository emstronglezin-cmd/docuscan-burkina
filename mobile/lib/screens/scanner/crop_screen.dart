import 'dart:io';
import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Ecran de recadrage manuel simple: l'utilisateur ajuste un rectangle
/// sur l'image affichee, puis valide. Retourne les coordonnees relatives
/// (0.0 - 1.0) du rectangle a DocumentsProvider.cropPage.
class CropScreen extends StatefulWidget {
  final String imagePath;
  const CropScreen({super.key, required this.imagePath});

  @override
  State<CropScreen> createState() => _CropScreenState();
}

class _CropScreenState extends State<CropScreen> {
  // Rectangle relatif initial: legere marge de 5% de chaque cote.
  Rect _rect = const Rect.fromLTWH(0.05, 0.05, 0.9, 0.9);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Recadrer', style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop({
                'left': _rect.left,
                'top': _rect.top,
                'width': _rect.width,
                'height': _rect.height,
              });
            },
            child: const Text('Valider', style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      body: Center(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return AspectRatio(
              aspectRatio: 3 / 4,
              child: Stack(
                children: [
                  Positioned.fill(child: Image.file(File(widget.imagePath), fit: BoxFit.contain)),
                  Positioned.fill(
                    child: _CropOverlay(
                      rect: _rect,
                      onChanged: (r) => setState(() => _rect = r),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Faites glisser les coins pour ajuster le cadrage du document.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}

class _CropOverlay extends StatelessWidget {
  final Rect rect; // relatif 0..1
  final ValueChanged<Rect> onChanged;

  const _CropOverlay({required this.rect, required this.onChanged});

  static const double _handleSize = 28;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;
        final pxRect = Rect.fromLTWH(rect.left * w, rect.top * h, rect.width * w, rect.height * h);

        void updateFromPixels(Rect newPxRect) {
          final clamped = Rect.fromLTRB(
            newPxRect.left.clamp(0, w - 20),
            newPxRect.top.clamp(0, h - 20),
            newPxRect.right.clamp(20, w),
            newPxRect.bottom.clamp(20, h),
          );
          onChanged(Rect.fromLTWH(
            clamped.left / w,
            clamped.top / h,
            clamped.width / w,
            clamped.height / h,
          ));
        }

        return Stack(
          children: [
            // Zone assombrie en dehors du rectangle
            CustomPaint(
              size: Size(w, h),
              painter: _DimPainter(pxRect),
            ),
            // Rectangle deplacable (drag global)
            Positioned(
              left: pxRect.left,
              top: pxRect.top,
              width: pxRect.width,
              height: pxRect.height,
              child: GestureDetector(
                onPanUpdate: (details) {
                  updateFromPixels(pxRect.shift(details.delta));
                },
                child: Container(
                  decoration: BoxDecoration(border: Border.all(color: AppTheme.accent, width: 2)),
                ),
              ),
            ),
            // Poignee coin bas-droit pour redimensionner
            Positioned(
              left: pxRect.right - _handleSize / 2,
              top: pxRect.bottom - _handleSize / 2,
              child: GestureDetector(
                onPanUpdate: (details) {
                  final newRect = Rect.fromLTRB(
                    pxRect.left,
                    pxRect.top,
                    pxRect.right + details.delta.dx,
                    pxRect.bottom + details.delta.dy,
                  );
                  updateFromPixels(newRect);
                },
                child: Container(
                  width: _handleSize,
                  height: _handleSize,
                  decoration: const BoxDecoration(color: AppTheme.accent, shape: BoxShape.circle),
                  child: const Icon(Icons.open_in_full, size: 14, color: Colors.white),
                ),
              ),
            ),
            // Poignee coin haut-gauche
            Positioned(
              left: pxRect.left - _handleSize / 2,
              top: pxRect.top - _handleSize / 2,
              child: GestureDetector(
                onPanUpdate: (details) {
                  final newRect = Rect.fromLTRB(
                    pxRect.left + details.delta.dx,
                    pxRect.top + details.delta.dy,
                    pxRect.right,
                    pxRect.bottom,
                  );
                  updateFromPixels(newRect);
                },
                child: Container(
                  width: _handleSize,
                  height: _handleSize,
                  decoration: const BoxDecoration(color: AppTheme.accent, shape: BoxShape.circle),
                  child: const Icon(Icons.open_in_full, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _DimPainter extends CustomPainter {
  final Rect hole;
  _DimPainter(this.hole);

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRect(hole)
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(path, Paint()..color = Colors.black.withValues(alpha: 0.55));
  }

  @override
  bool shouldRepaint(covariant _DimPainter oldDelegate) => oldDelegate.hole != hole;
}
