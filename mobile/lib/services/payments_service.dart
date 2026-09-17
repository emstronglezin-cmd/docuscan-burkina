import '../models/payment.dart';
import 'api_client.dart';

/// Service paiements: initie et verifie des paiements REELS via Saspay,
/// exclusivement a travers le backend (aucune cle secrete Saspay ni
/// logique de paiement cote client).
class PaymentsService {
  final ApiClient _api = ApiClient.instance;

  /// Cree une session de paiement hebergee Saspay (page web de paiement)
  /// pour un pack de credits. Retourne le paiement local incluant
  /// `checkoutUrl` a ouvrir dans un navigateur/webview.
  Future<SaspayPaymentModel> initiateCheckout(String creditPackId) async {
    final data = await _api.post(
      '/payments/checkout',
      body: {'creditPackId': creditPackId},
    );
    return SaspayPaymentModel.fromJson(data);
  }

  /// Initie un paiement softpay (push direct sur le telephone via mobile
  /// money Moov/Orange Burkina Faso).
  Future<SaspayPaymentModel> initiateSoftpay({
    required String creditPackId,
    required String network, // 'moov_bf' ou 'orange_bf'
    required String phone,
  }) async {
    final data = await _api.post(
      '/payments/softpay',
      body: {
        'creditPackId': creditPackId,
        'network': network,
        'phone': phone,
      },
    );
    return SaspayPaymentModel.fromJson(data);
  }

  /// Force une re-verification ACTIVE aupres de Saspay via le backend
  /// (jamais confiance au frontend seul). A utiliser en polling apres
  /// retour d'un checkout ou en pull-to-refresh.
  Future<SaspayPaymentModel> verify(String paymentId) async {
    final data = await _api.post('/payments/$paymentId/verify');
    return SaspayPaymentModel.fromJson(data);
  }

  Future<SaspayPaymentModel> getPayment(String paymentId) async {
    final data = await _api.get('/payments/$paymentId');
    return SaspayPaymentModel.fromJson(data);
  }

  Future<List<SaspayPaymentModel>> listPayments() async {
    final data = await _api.get('/payments');
    final list = data['payments'] as List<dynamic>? ?? [];
    return list.map((e) => SaspayPaymentModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
