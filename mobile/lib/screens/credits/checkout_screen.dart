import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../models/credit_pack.dart';
import '../../models/payment.dart';
import '../../providers/credits_provider.dart';
import '../../services/payments_service.dart';
import '../../services/api_exception.dart';
import '../../theme/app_theme.dart';

/// Ecran de paiement REEL via Saspay (checkout hebergé).
///
/// - Le backend cree une session Saspay et renvoie une checkoutUrl.
/// - On l'ouvre dans une WebView; le serveur Saspay gere le vrai
///   paiement (mobile money / carte).
/// - Le crédit N'EST JAMAIS appliqué côté client: le backend attend soit
///   le webhook Saspay signé, soit une vérification active
///   (POST /payments/:id/verify) qui interroge réellement Saspay avant
///   de créditer. Ce client se contente de déclencher cette vérification
///   en polling après retour de paiement, sans jamais décider seul.
class CheckoutScreen extends StatefulWidget {
  final CreditPack pack;
  const CheckoutScreen({super.key, required this.pack});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final PaymentsService _paymentsService = PaymentsService();

  bool _initiating = true;
  String? _error;
  SaspayPaymentModel? _payment;
  WebViewController? _webController;
  Timer? _pollTimer;
  bool _verifying = false;

  @override
  void initState() {
    super.initState();
    _initiateCheckout();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _initiateCheckout() async {
    setState(() {
      _initiating = true;
      _error = null;
    });
    try {
      final payment = await _paymentsService.initiateCheckout(widget.pack.id);
      if (payment.checkoutUrl == null) {
        throw ApiException(
          statusCode: 502,
          message: 'Saspay n\'a pas renvoyé de lien de paiement. Réessayez plus tard.',
        );
      }
      setState(() {
        _payment = payment;
        _webController = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..loadRequest(Uri.parse(payment.checkoutUrl!));
        _initiating = false;
      });
      _startPolling(payment.id);
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _initiating = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Impossible d\'initier le paiement Saspay. Vérifiez la configuration serveur (SASPAY_API_KEY).';
        _initiating = false;
      });
    }
  }

  void _startPolling(String paymentId) {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (timer) async {
      if (_verifying) return;
      _verifying = true;
      try {
        final updated = await _paymentsService.verify(paymentId);
        if (updated.status == 'SUCCESS') {
          timer.cancel();
          if (mounted) {
            await context.read<CreditsProvider>().refreshBalance();
            _showSuccessAndClose(updated);
          }
        } else if (updated.status == 'FAILED' || updated.status == 'CANCELLED') {
          timer.cancel();
          if (mounted) {
            setState(() => _error = 'Le paiement a échoué ou a été annulé.');
          }
        }
      } catch (_) {
        // Erreur reseau ponctuelle: on continue le polling.
      } finally {
        _verifying = false;
      }
    });
  }

  void _showSuccessAndClose(SaspayPaymentModel payment) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Paiement confirmé ✅'),
        content: Text('${payment.creditsRequested} crédit(s) ont été ajoutés à votre compte.'),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Retour'),
          ),
        ],
      ),
    );
  }

  Future<void> _manualVerify() async {
    if (_payment == null) return;
    setState(() => _verifying = true);
    try {
      final updated = await _paymentsService.verify(_payment!.id);
      if (updated.status == 'SUCCESS') {
        await context.read<CreditsProvider>().refreshBalance();
        if (mounted) _showSuccessAndClose(updated);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Statut du paiement: ${updated.status}. Réessayez après le paiement.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Impossible de vérifier le paiement pour le moment.')),
        );
      }
    } finally {
      if (mounted) setState(() => _verifying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Paiement · ${widget.pack.priceFcfa} FCFA'),
        actions: [
          if (_payment != null)
            IconButton(
              icon: _verifying
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.refresh),
              onPressed: _verifying ? null : _manualVerify,
              tooltip: 'Vérifier le paiement',
            ),
        ],
      ),
      body: _initiating
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, color: AppTheme.danger, size: 48),
                        const SizedBox(height: 16),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 20),
                        ElevatedButton(onPressed: _initiateCheckout, child: const Text('Réessayer')),
                      ],
                    ),
                  ),
                )
              : _webController != null
                  ? WebViewWidget(controller: _webController!)
                  : const SizedBox.shrink(),
    );
  }
}
