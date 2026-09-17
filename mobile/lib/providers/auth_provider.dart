import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/api_client.dart';
import '../services/api_exception.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  AppUser? _user;
  AuthStatus _status = AuthStatus.unknown;
  bool _loading = false;
  String? _error;

  AppUser? get user => _user;
  AuthStatus get status => _status;
  bool get loading => _loading;
  String? get error => _error;
  bool get isAuthenticated => _status == AuthStatus.authenticated;

  AuthProvider() {
    ApiClient.instance.onUnauthenticated = () async {
      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
    };
  }

  Future<void> bootstrap() async {
    final hasSession = await _authService.hasSession();
    if (!hasSession) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      _user = await _authService.fetchMe();
      _status = AuthStatus.authenticated;
    } catch (_) {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) => _run(() async {
        _user = await _authService.login(email: email, password: password);
        _status = AuthStatus.authenticated;
      });

  Future<bool> register({
    required String email,
    required String password,
    String? fullName,
    String? phone,
  }) => _run(() async {
        _user = await _authService.register(
          email: email,
          password: password,
          fullName: fullName,
          phone: phone,
        );
        _status = AuthStatus.authenticated;
      });

  Future<void> logout() async {
    await _authService.logout();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void updateLocalBalance(int newBalance) {
    if (_user != null) {
      _user = _user!.copyWith(creditBalance: newBalance);
      notifyListeners();
    }
  }

  Future<bool> _run(Future<void> Function() action) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await action();
      _loading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Une erreur est survenue. Reessayez.';
      _loading = false;
      notifyListeners();
      return false;
    }
  }
}
