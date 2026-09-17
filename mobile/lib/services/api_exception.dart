/// Exception levee par ApiClient pour toute reponse HTTP non-2xx.
/// `code` correspond au champ `code` renvoye par le backend (ex:
/// "insufficient_credits") quand disponible, ce qui permet a l'UI de
/// reagir specifiquement (ex: rediriger vers l'achat de credits).
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? code;
  final Map<String, dynamic>? body;

  ApiException({
    required this.statusCode,
    required this.message,
    this.code,
    this.body,
  });

  bool get isInsufficientCredits => code == 'insufficient_credits';
  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
