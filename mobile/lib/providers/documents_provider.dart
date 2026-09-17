import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../models/local_document.dart';
import '../services/local_storage_service.dart';
import '../services/image_processing_service.dart';
import '../services/pdf_service.dart';

/// Gere l'historique local des documents (source de verite = disque de
/// l'appareil, via Hive) et la session de scan en cours (pages en cours
/// d'ajout avant export final).
class DocumentsProvider extends ChangeNotifier {
  final LocalStorageService _storage = LocalStorageService();
  final ImageProcessingService _imageService = ImageProcessingService();
  final PdfService _pdfService = PdfService();
  final _uuid = const Uuid();

  List<LocalDocument> _documents = [];
  List<String> _currentPages = []; // chemins des pages en cours de scan

  List<LocalDocument> get documents => _documents;
  List<String> get currentPages => _currentPages;
  bool get hasCurrentPages => _currentPages.isNotEmpty;

  void loadDocuments() {
    _documents = _storage.getAll();
    notifyListeners();
  }

  // ---------- Session de scan en cours ----------

  Future<void> addCapturedPage(String rawImagePath) async {
    final processedPath = await _imageService.processCapturedImage(rawImagePath);
    _currentPages.add(processedPath);
    notifyListeners();
  }

  Future<void> rotatePage(int index, {bool clockwise = true}) async {
    final newPath = await _imageService.rotate(_currentPages[index], clockwise: clockwise);
    _currentPages[index] = newPath;
    notifyListeners();
  }

  Future<void> cropPage(
    int index, {
    required double left,
    required double top,
    required double width,
    required double height,
  }) async {
    final newPath = await _imageService.crop(
      _currentPages[index],
      left: left,
      top: top,
      width: width,
      height: height,
    );
    _currentPages[index] = newPath;
    notifyListeners();
  }

  void reorderPages(int oldIndex, int newIndex) {
    if (newIndex > oldIndex) newIndex -= 1;
    final page = _currentPages.removeAt(oldIndex);
    _currentPages.insert(newIndex, page);
    notifyListeners();
  }

  Future<void> removePage(int index) async {
    final path = _currentPages.removeAt(index);
    await _imageService.deleteFile(path);
    notifyListeners();
  }

  void clearCurrentSession() {
    _currentPages = [];
    notifyListeners();
  }

  /// Finalise la session en cours: genere le PDF et cree un LocalDocument
  /// NON encore exporte (le credit n'est debite qu'a l'export explicite).
  Future<LocalDocument> finalizeToDocument(String name) async {
    final id = _uuid.v4();
    final doc = LocalDocument(
      id: id,
      name: name,
      pageImagePaths: List.of(_currentPages),
      createdAt: DateTime.now(),
      pageCount: _currentPages.length,
      exported: false,
    );
    await _storage.save(doc);
    clearCurrentSession();
    loadDocuments();
    return doc;
  }

  // ---------- Documents finalises ----------

  Future<String> ensurePdfGenerated(LocalDocument doc) async {
    if (doc.pdfPath != null) return doc.pdfPath!;
    final path = await _pdfService.generatePdf(
      imagePaths: doc.pageImagePaths,
      fileName: doc.name,
    );
    final size = await _pdfService.fileSize(path);
    doc.pdfPath = path;
    doc.fileSizeBytes = size;
    await _storage.save(doc);
    loadDocuments();
    return path;
  }

  Future<void> markExported(String documentId) async {
    final doc = _storage.getById(documentId);
    if (doc == null) return;
    doc.exported = true;
    await _storage.save(doc);
    loadDocuments();
  }

  Future<void> renameDocument(String documentId, String newName) async {
    final doc = _storage.getById(documentId);
    if (doc == null) return;
    doc.name = newName;
    // Le PDF existant garde son ancien fichier; il sera regenere si besoin.
    await _storage.save(doc);
    loadDocuments();
  }

  Future<void> deleteDocument(String documentId) async {
    final doc = _storage.getById(documentId);
    if (doc == null) return;
    for (final p in doc.pageImagePaths) {
      await _imageService.deleteFile(p);
    }
    if (doc.pdfPath != null) {
      await _imageService.deleteFile(doc.pdfPath!);
    }
    await _storage.delete(documentId);
    loadDocuments();
  }

  LocalDocument? getById(String id) => _storage.getById(id);
}
