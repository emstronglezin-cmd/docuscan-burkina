import 'package:hive/hive.dart';

part 'local_document.g.dart';

/// Document numerise stocke localement sur l'appareil.
///
/// Respect de la confidentialite: les images des pages et le PDF genere
/// restent sur l'appareil (dossier documents de l'app). Seules des
/// METADONNEES (nom, nombre de pages, taille, reference) sont envoyees
/// au backend lors de l'export, pour debiter le credit correspondant.
@HiveType(typeId: 0)
class LocalDocument extends HiveObject {
  @HiveField(0)
  String id; // uuid genere cote client, sert de documentReference (idempotence backend)

  @HiveField(1)
  String name;

  @HiveField(2)
  List<String> pageImagePaths; // chemins locaux des images de pages (apres traitement)

  @HiveField(3)
  DateTime createdAt;

  @HiveField(4)
  int pageCount;

  @HiveField(5)
  String? pdfPath; // chemin local du PDF genere, une fois exporte

  @HiveField(6)
  int? fileSizeBytes;

  @HiveField(7)
  bool exported; // true des que le credit a ete debite avec succes cote backend

  LocalDocument({
    required this.id,
    required this.name,
    required this.pageImagePaths,
    required this.createdAt,
    required this.pageCount,
    this.pdfPath,
    this.fileSizeBytes,
    this.exported = false,
  });
}
