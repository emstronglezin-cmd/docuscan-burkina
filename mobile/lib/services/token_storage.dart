import 'package:shared_preferences/shared_preferences.dart';

/// Stockage local des jetons JWT (access + refresh).
/// Utilise shared_preferences pour la simplicite; les jetons sont courts
/// (access) / longs (refresh) et signes cote serveur, donc leur presence
/// en clair sur l'appareil est un compromis acceptable pour du mobile.
class TokenStorage {
  static const _accessKey = 'docuscan_access_token';
  static const _refreshKey = 'docuscan_refresh_token';

  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, accessToken);
    await prefs.setString(_refreshKey, refreshToken);
  }

  Future<String?> getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_accessKey);
  }

  Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_refreshKey);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_accessKey);
    await prefs.remove(_refreshKey);
  }
}
