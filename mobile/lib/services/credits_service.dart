import '../models/credit_pack.dart';
import '../models/credit_transaction.dart';
import 'api_client.dart';

/// Service credits: solde, historique et packs, tous recuperes en temps
/// reel depuis le backend. Aucun prix ni solde n'est jamais code en dur
/// cote client.
class CreditsService {
  final ApiClient _api = ApiClient.instance;

  Future<int> getBalance() async {
    final data = await _api.get('/credits/balance');
    return (data['balance'] as num).toInt();
  }

  Future<List<CreditTransactionModel>> getHistory({int limit = 50, int offset = 0}) async {
    final data = await _api.get('/credits/history?limit=$limit&offset=$offset');
    final list = data['transactions'] as List<dynamic>? ?? [];
    return list
        .map((e) => CreditTransactionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Recupere les packs de credits ACTIFS et configurables depuis l'admin.
  /// Jamais hardcode: source unique de verite = backend.
  Future<List<CreditPack>> getPacks() async {
    final data = await _api.get('/credit-packs', auth: false);
    final list = data['packs'] as List<dynamic>? ?? [];
    final packs = list.map((e) => CreditPack.fromJson(e as Map<String, dynamic>)).toList();
    packs.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    return packs;
  }
}
