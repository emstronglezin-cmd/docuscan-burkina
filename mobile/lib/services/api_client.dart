import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import 'api_exception.dart';
import 'token_storage.dart';

/// Client HTTP central vers le backend REAL NestJS DocuScan Burkina.
///
/// - Ajoute automatiquement le header Authorization avec l'access token.
/// - En cas de 401, tente UNE fois un rafraichissement via /auth/refresh
///   puis rejoue la requete originale.
/// - Aucune cle secrete (Saspay, JWT secret, etc.) n'existe cote client:
///   uniquement les tokens JWT courts/longs emis par le backend.
class ApiClient {
  ApiClient._internal();
  static final ApiClient instance = ApiClient._internal();

  final TokenStorage _tokenStorage = TokenStorage();
  final String _base = '${AppConfig.apiBaseUrl}/api/v1';

  Future<void> Function()? onUnauthenticated;

  Future<Map<String, dynamic>> get(String path, {bool auth = true}) async {
    return _send('GET', path, auth: auth);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send('POST', path, body: body, auth: auth);
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
  }) async {
    return _send('PATCH', path, body: body, auth: auth);
  }

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    bool auth = true,
    bool isRetry = false,
  }) async {
    final uri = Uri.parse('$_base$path');
    final headers = <String, String>{'Content-Type': 'application/json'};

    if (auth) {
      final token = await _tokenStorage.getAccessToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    http.Response response;
    try {
      switch (method) {
        case 'GET':
          response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 20));
          break;
        case 'POST':
          response = await http
              .post(uri, headers: headers, body: body != null ? jsonEncode(body) : null)
              .timeout(const Duration(seconds: 20));
          break;
        case 'PATCH':
          response = await http
              .patch(uri, headers: headers, body: body != null ? jsonEncode(body) : null)
              .timeout(const Duration(seconds: 20));
          break;
        default:
          throw ApiException(statusCode: 0, message: 'Methode HTTP non supportee: $method');
      }
    } on TimeoutException {
      throw ApiException(
        statusCode: 0,
        message: 'Le serveur ne repond pas. Verifiez votre connexion internet.',
      );
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Impossible de contacter le serveur. Verifiez votre connexion internet.',
      );
    }

    if (response.statusCode == 401 && auth && !isRetry) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        return _send(method, path, body: body, auth: auth, isRetry: true);
      } else {
        if (onUnauthenticated != null) {
          await onUnauthenticated!();
        }
        throw ApiException(statusCode: 401, message: 'Session expiree, veuillez vous reconnecter.');
      }
    }

    Map<String, dynamic> decoded = {};
    if (response.body.isNotEmpty) {
      try {
        final parsed = jsonDecode(response.body);
        if (parsed is Map<String, dynamic>) {
          decoded = parsed;
        }
      } catch (_) {
        // reponse non-JSON, laisse decoded vide
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message = decoded['message'] is List
          ? (decoded['message'] as List).join(', ')
          : (decoded['message']?.toString() ?? 'Erreur inconnue (${response.statusCode})');
      throw ApiException(
        statusCode: response.statusCode,
        message: message,
        code: decoded['code']?.toString(),
        body: decoded,
      );
    }

    return decoded;
  }

  Future<bool> _tryRefresh() async {
    final refreshToken = await _tokenStorage.getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final uri = Uri.parse('$_base/auth/refresh');
      final response = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(const Duration(seconds: 15));

      if (response.statusCode != 200) return false;

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final newAccess = data['accessToken'] as String?;
      final newRefresh = data['refreshToken'] as String?;
      if (newAccess == null || newRefresh == null) return false;

      await _tokenStorage.saveTokens(accessToken: newAccess, refreshToken: newRefresh);
      return true;
    } catch (_) {
      return false;
    }
  }
}
