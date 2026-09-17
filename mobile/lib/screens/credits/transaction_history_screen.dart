import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/credits_provider.dart';
import '../../theme/app_theme.dart';

class TransactionHistoryScreen extends StatefulWidget {
  const TransactionHistoryScreen({super.key});

  @override
  State<TransactionHistoryScreen> createState() => _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CreditsProvider>().loadHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    final credits = context.watch<CreditsProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Historique des transactions')),
      body: credits.loadingHistory
          ? const Center(child: CircularProgressIndicator())
          : credits.history.isEmpty
              ? const Center(child: Text('Aucune transaction pour le moment.'))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: credits.history.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final tx = credits.history[index];
                    final isPositive = tx.amount > 0;
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: isPositive
                            ? AppTheme.success.withValues(alpha: 0.12)
                            : AppTheme.danger.withValues(alpha: 0.12),
                        child: Icon(
                          isPositive ? Icons.add : Icons.remove,
                          color: isPositive ? AppTheme.success : AppTheme.danger,
                        ),
                      ),
                      title: Text(_typeLabel(tx.type)),
                      subtitle: Text(tx.description ?? '-'),
                      trailing: Text(
                        '${isPositive ? '+' : ''}${tx.amount}',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: isPositive ? AppTheme.success : AppTheme.danger,
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  String _typeLabel(String type) {
    switch (type) {
      case 'PURCHASE':
        return 'Achat de crédits';
      case 'SCAN':
        return 'Export de document';
      case 'REFUND':
        return 'Remboursement';
      case 'ADMIN_ADJUSTMENT':
        return 'Ajustement administrateur';
      default:
        return type;
    }
  }
}
