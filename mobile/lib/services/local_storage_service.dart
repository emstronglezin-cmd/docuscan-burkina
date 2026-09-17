import 'package:hive_flutter/hive_flutter.dart';
import '../models/local_document.dart';

/// Stockage local des documents scannes (IndexedDB-like via Hive).
///
/// Confidentialite: les documents restent sur l'appareil de l'utilisateur.
/// Cette base locale est la source de verite pour l'historique visible
/// dans l'app (nom, date, nombre de pages, miniature, taille, actions).
class LocalStorageService {
  static const String boxName = 'documents_box';

  static Future<void> init() async {
    await Hive.initFlutter();
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(LocalDocumentAdapter());
    }
    await Hive.openBox<LocalDocument>(boxName);
  }

  Box<LocalDocument> get _box => Hive.box<LocalDocument>(boxName);

  List<LocalDocument> getAll() {
    final list = _box.values.toList();
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  LocalDocument? getById(String id) {
    try {
      return _box.values.firstWhere((d) => d.id == id);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(LocalDocument doc) async {
    await _box.put(doc.id, doc);
  }

  Future<void> delete(String id) async {
    await _box.delete(id);
  }
}
