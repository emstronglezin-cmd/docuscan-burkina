import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/credit_pack.dart';
import '../../providers/credits_provider.dart';
import '../../theme/app_theme.dart';
import 'checkout_screen.dart';
import 'transaction_history_screen.dart';

/// Ecran d'achat de credits: les packs (prix, quantite) viennent
/// TOUJOURS de GET /credit-packs (gerable depuis l'admin backend),
/// jamais codes en dur ici.
class CreditsScreen extends StatefulWidget {
  const CreditsScreen({super.key});

  @override
  State<CreditsScreen> createState() => _CreditsScreenState();
}

class _CreditsScreenState extends State<CreditsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final credits = context.read<CreditsProvider>();
      credits.refreshBalance();
      credits.loadPacks();
    });
  }

  @override
  Widget build(BuildContext context) {
    final credits = context.watch<CreditsProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes crédits'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Historique des transactions',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const TransactionHistoryScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await credits.refreshBalance();
          await credits.loadPacks();
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  const Text('Solde actuel', style: TextStyle(color: Colors.white70)),
                  const SizedBox(height: 8),
                  credits.loadingBalance
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          '${credits.balance}',
                          style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800),
                        ),
                  const Text('crédit(s)', style: TextStyle(color: Colors.white70)),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text('Choisissez un pack', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (credits.loadingPacks)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (credits.packs.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Aucun pack disponible pour le moment.', style: TextStyle(color: AppTheme.textSecondary)),
              )
            else
              ...credits.packs.map((pack) => _PackCard(
                    pack: pack,
                    onBuy: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => CheckoutScreen(pack: pack)),
                      );
                    },
                  )),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                'Paiement sécurisé via Saspay (Moov Money, Orange Money, carte bancaire). '
                'Le crédit de votre compte est confirmé uniquement après validation du paiement par notre serveur.',
                style: TextStyle(color: AppTheme.textSecondary, fontSize: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PackCard extends StatelessWidget {
  final CreditPack pack;
  final VoidCallback onBuy;

  const _PackCard({required this.pack, required this.onBuy});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.bolt_rounded, color: AppTheme.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(pack.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                      if (pack.isPopular) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.accent,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text('Populaire', style: TextStyle(color: Colors.white, fontSize: 10)),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text('${pack.priceFcfa} FCFA', style: const TextStyle(color: AppTheme.textSecondary)),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: onBuy,
              style: ElevatedButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16)),
              child: const Text('Acheter'),
            ),
          ],
        ),
      ),
    );
  }
}
