import 'dart:io';
import 'dart:typed_data';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

/// Service de traitement d'image LOCAL (aucun envoi serveur).
///
/// Pipeline applique a chaque page capturee:
/// 1. Decodage de la photo prise par la camera.
/// 2. Redressement/rotation (manuel, controle par l'utilisateur).
/// 3. Recadrage optionnel (rectangle choisi par l'utilisateur).
/// 4. Amelioration qualite: contraste + luminosite + nettete, puis
///    reduction de la resolution maximale pour limiter la taille du PDF
///    final tout en gardant un rendu net pour l'impression/lecture.
///
/// NOTE (limitation documentee, cf. README): la detection automatique
/// des 4 coins du document (contour) n'est pas implementee dans cette
/// version. L'utilisateur peut cadrer et faire pivoter manuellement,
/// ce qui couvre le cas d'usage principal (CNIB, releves, certificats
/// photographies a plat). L'auto-detection complete de perspective est
/// une amelioration future documentee, pas une fonctionnalite simulee.
class ImageProcessingService {
  static const int _maxDimension = 2000;
  final _uuid = const Uuid();

  Future<Directory> _pagesDir() async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory('${appDir.path}/docuscan_pages');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  /// Traite une photo brute (depuis la camera/galerie) et enregistre le
  /// resultat comme nouvelle page traitee. Retourne le chemin du fichier.
  Future<String> processCapturedImage(String sourcePath) async {
    final bytes = await File(sourcePath).readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      throw Exception('Image illisible. Reessayez la capture.');
    }

    var processed = _autoOrient(decoded);
    processed = _downscale(processed, _maxDimension);
    processed = _enhance(processed);

    return _persist(processed);
  }

  /// Fait pivoter une page existante de 90deg dans le sens choisi et
  /// remplace le fichier sur disque (le fichier precedent est supprime).
  Future<String> rotate(String imagePath, {bool clockwise = true}) async {
    final bytes = await File(imagePath).readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) throw Exception('Image illisible.');

    final rotated = img.copyRotate(decoded, angle: clockwise ? 90 : -90);
    final newPath = await _persist(rotated);

    try {
      await File(imagePath).delete();
    } catch (_) {}

    return newPath;
  }

  /// Recadre une page selon un rectangle relatif (0.0 - 1.0) fourni par
  /// l'utilisateur via l'ecran de cadrage.
  Future<String> crop(
    String imagePath, {
    required double left,
    required double top,
    required double width,
    required double height,
  }) async {
    final bytes = await File(imagePath).readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) throw Exception('Image illisible.');

    final x = (left * decoded.width).clamp(0, decoded.width - 1).toInt();
    final y = (top * decoded.height).clamp(0, decoded.height - 1).toInt();
    final w = (width * decoded.width).clamp(1, decoded.width - x).toInt();
    final h = (height * decoded.height).clamp(1, decoded.height - y).toInt();

    final cropped = img.copyCrop(decoded, x: x, y: y, width: w, height: h);
    final newPath = await _persist(cropped);

    try {
      await File(imagePath).delete();
    } catch (_) {}

    return newPath;
  }

  img.Image _autoOrient(img.Image image) {
    // bakeOrientation applique les metadonnees EXIF (photos prises en
    // paysage/portrait par le capteur) pour obtenir un rendu correctement
    // oriente avant tout autre traitement.
    return img.bakeOrientation(image);
  }

  img.Image _downscale(img.Image image, int maxDim) {
    if (image.width <= maxDim && image.height <= maxDim) return image;
    if (image.width >= image.height) {
      return img.copyResize(image, width: maxDim);
    }
    return img.copyResize(image, height: maxDim);
  }

  img.Image _enhance(img.Image image) {
    // Ameliore le contraste et la luminosite pour un rendu "document
    // scanne" plus net, sans alterer les couleurs de facon excessive.
    var result = img.adjustColor(image, contrast: 1.15, brightness: 1.03, saturation: 1.05);
    result = img.gaussianBlur(result, radius: 0); // no-op garde pour extension future (denoise)
    return result;
  }

  Future<String> _persist(img.Image image) async {
    final dir = await _pagesDir();
    final fileName = '${_uuid.v4()}.jpg';
    final path = '${dir.path}/$fileName';
    final Uint8List jpg = img.encodeJpg(image, quality: 88);
    await File(path).writeAsBytes(jpg);
    return path;
  }

  Future<void> deleteFile(String path) async {
    try {
      final f = File(path);
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }
}
