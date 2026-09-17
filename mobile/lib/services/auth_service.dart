import '../models/user.dart';
import 'api_client.dart';
import 'token_storage.dart';

/// Service d'authentification: appelle exclusivement les endpoints REELS
/// du backend NestJS (/api/v1/auth/*). Aucune simulation locale.
class AuthService {
  final ApiClient _api = ApiClient.instance;
  final TokenStorage _tokenStorage = TokenStorage();

  Future<AppUser> register({
    required String email,
    required String password,
    String? fullName,
    String? phone,
  }) async {
    final data = await _api.post(
      '/auth/register',
      body: {
        'email': email,
        'password': password,
        if (fullName != null && fullName.isNotEmpty) 'fullName': fullName,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      },
      auth: false,
    );
    return _handleAuthResponse(data);
  }

  Future<AppUser> login({required String email, required String password}) async {
    final data = await _api.post(
      '/auth/login',
      body: {'email': email, 'password': password},
      auth: false,
    );
    return _handleAuthResponse(data);
  }

  Future<AppUser> _handleAuthResponse(Map<String, dynamic> data) async {
    final tokens = data['tokens'] as Map<String, dynamic>;
    await _tokenStorage.saveTokens(
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
    return AppUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // meme si l'appel echoue (ex: token deja expire), on nettoie localement
    }
    await _tokenStorage.clear();
  }

  Future<bool> hasSession() async {
    final token = await _tokenStorage.getRefreshToken();
    return token != null;
  }

  Future<AppUser> fetchMe() async {
    final data = await _api.get('/users/me');
    return AppUser.fromJson(data);
  }
}
