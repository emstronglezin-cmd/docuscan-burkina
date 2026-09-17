import 'package:flutter/foundation.dart';
import '../models/credit_pack.dart';
import '../models/credit_transaction.dart';
import '../services/credits_service.dart';

class CreditsProvider extends ChangeNotifier {
  final CreditsService _service = CreditsService();

  int _balance = 0;
  List<CreditPack> _packs = [];
  List<CreditTransactionModel> _history = [];
  bool _loadingBalance = false;
  bool _loadingPacks = false;
  bool _loadingHistory = false;
  String? _error;

  int get balance => _balance;
  List<CreditPack> get packs => _packs;
  List<CreditTransactionModel> get history => _history;
  bool get loadingBalance => _loadingBalance;
  bool get loadingPacks => _loadingPacks;
  bool get loadingHistory => _loadingHistory;
  String? get error => _error;

  Future<void> refreshBalance() async {
    _loadingBalance = true;
    notifyListeners();
    try {
      _balance = await _service.getBalance();
      _error = null;
    } catch (e) {
      _error = 'Impossible de recuperer le solde.';
    }
    _loadingBalance = false;
    notifyListeners();
  }

  Future<void> loadPacks() async {
    _loadingPacks = true;
    notifyListeners();
    try {
      _packs = await _service.getPacks();
      _error = null;
    } catch (e) {
      _error = 'Impossible de charger les packs de credits.';
    }
    _loadingPacks = false;
    notifyListeners();
  }

  Future<void> loadHistory() async {
    _loadingHistory = true;
    notifyListeners();
    try {
      _history = await _service.getHistory();
      _error = null;
    } catch (e) {
      _error = 'Impossible de charger l\'historique.';
    }
    _loadingHistory = false;
    notifyListeners();
  }

  bool get hasCreditForExport => _balance >= 1;
}
