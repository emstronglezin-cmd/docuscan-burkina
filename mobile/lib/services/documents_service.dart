import 'api_client.dart';
import 'api_exception.dart';

/// Service documents: confirme un export PDF REALISE LOCALEMENT et
/// demande le debit du credit correspondant au backend.
///
/// Le fichier PDF lui-meme n'est JAMAIS envoye au serveur: seules des
/// metadonnees (nom, nombre de pages, taille, reference unique cote
/// client) transitent, conformement a l'exigence de confidentialite.
class DocumentsService {
  final ApiClient _api = ApiClient.instance;

  /// [documentReference] doit etre l'UUID local du document (LocalDocument.id).
  /// Idempotent cote backend: rejouer avec la meme reference ne debite
  /// jamais deux fois, ce qui protege contre les doubles-clics/relances.
  Future<Map<String, dynamic>> confirmExport({
    required String documentReference,
    required String fileName,
    required int pageCount,
    int? fileSizeBytes,
  }) async {
    try {
      return await _api.post(
        '/documents/export',
        body: {
          'documentReference': documentReference,
          'fileName': fileName,
          'pageCount': pageCount,
          if (fileSizeBytes != null) 'fileSizeBytes': fileSizeBytes,
          'platform': 'mobile',
        },
      );
    } on ApiException {
      rethrow;
    }
  }

  Future<List<dynamic>> listRemoteHistory({int limit = 50, int offset = 0}) async {
    final data = await _api.get('/documents?limit=$limit&offset=$offset');
    return data['documents'] as List<dynamic>? ?? [];
  }
}
