import 'dart:io';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';

/// Generation REELLE de PDF a partir des pages traitees localement.
///
/// - Format A4 par defaut (portrait/paysage selon l'image).
/// - Chaque image est ajustee (fit) dans la page en conservant les
///   marges, avec une compression JPEG raisonnable deja appliquee en
///   amont par ImageProcessingService (qualite 88) pour un bon
///   compromis qualite/poids.
/// - Le PDF est ecrit dans le stockage local de l'app (jamais envoye
///   au serveur pour sa generation).
class PdfService {
  Future<Directory> _pdfDir() async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory('${appDir.path}/docuscan_pdfs');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Genere un PDF a partir de la liste ordonnee de chemins d'images et
  /// l'enregistre sous [fileName].pdf. Retourne le chemin complet.
  Future<String> generatePdf({
    required List<String> imagePaths,
    required String fileName,
  }) async {
    final doc = pw.Document();

    for (final path in imagePaths) {
      final bytes = await File(path).readAsBytes();
      final image = pw.MemoryImage(bytes);

      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(16),
          build: (context) {
            return pw.Center(
              child: pw.FittedBox(
                fit: pw.BoxFit.contain,
                child: pw.Image(image),
              ),
            );
          },
        ),
      );
    }

    final dir = await _pdfDir();
    final safeName = _sanitizeFileName(fileName);
    final path = '${dir.path}/$safeName.pdf';
    final bytes = await doc.save();
    final file = File(path);
    await file.writeAsBytes(bytes, flush: true);
    return path;
  }

  Future<int> fileSize(String path) async {
    final file = File(path);
    if (!await file.exists()) return 0;
    return file.length();
  }

  String _sanitizeFileName(String name) {
    final cleaned = name.trim().replaceAll(RegExp(r'[^\w\s\-]'), '');
    final collapsed = cleaned.replaceAll(RegExp(r'\s+'), '_');
    return collapsed.isEmpty ? 'document' : collapsed;
  }
}
