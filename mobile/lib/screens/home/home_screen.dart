import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/credits_provider.dart';
import '../../providers/documents_provider.dart';
import '../../theme/app_theme.dart';
import '../scanner/scanner_screen.dart';
import '../history/document_detail_screen.dart';
import '../credits/credits_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CreditsProvider>().refreshBalance();
      context.read<DocumentsProvider>().loadDocuments();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final credits = context.watch<CreditsProvider>();
    final documents = context.watch<DocumentsProvider>();
    final recentDocs = documents.documents.take(3).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('DocuScan Burkina'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await context.read<CreditsProvider>().refreshBalance();
          context.read<DocumentsProvider>().loadDocuments();
        },
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Bonjour${auth.user?.fullName != null ? ', ${auth.user!.fullName!.split(' ').first}' : ''} 👋',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 20),
            _BalanceCard(
              balance: credits.balance,
              loading: credits.loadingBalance,
              onBuyCredits: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const CreditsScreen()),
                );
              },
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ScannerScreen()),
                  );
                },
                icon: const Icon(Icons.document_scanner_outlined),
                label: const Text('Scanner un document'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  minimumSize: const Size.fromHeight(58),
                ),
              ),
            ),
            const SizedBox(height: 28),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Documents récents', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 12),
            if (recentDocs.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.insert_drive_file_outlined, size: 40, color: AppTheme.textSecondary),
                    SizedBox(height: 12),
                    Text('Aucun document pour le moment', style: TextStyle(color: AppTheme.textSecondary)),
                  ],
                ),
              )
            else
              ...recentDocs.map((doc) => Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: ListTile(
                      leading: const CircleAvatar(
                        backgroundColor: AppTheme.background,
                        child: Icon(Icons.description_outlined, color: AppTheme.primary),
                      ),
                      title: Text(doc.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${doc.pageCount} page(s) · ${_formatDate(doc.createdAt)}'),
                      trailing: doc.exported
                          ? const Icon(Icons.check_circle, color: AppTheme.success, size: 20)
                          : const Icon(Icons.pending_outlined, color: AppTheme.textSecondary, size: 20),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
                        );
                      },
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}

class _BalanceCard extends StatelessWidget {
  final int balance;
  final bool loading;
  final VoidCallback onBuyCredits;

  const _BalanceCard({required this.balance, required this.loading, required this.onBuyCredits});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppTheme.primary, AppTheme.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Votre solde', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 6),
                loading
                    ? const SizedBox(
                        height: 28,
                        width: 28,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(
                        '$balance crédit${balance > 1 ? 's' : ''}',
                        style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800),
                      ),
                const SizedBox(height: 2),
                const Text('1 document exporté = 1 crédit', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: onBuyCredits,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.primary,
              minimumSize: const Size(0, 44),
              padding: const EdgeInsets.symmetric(horizontal: 18),
            ),
            child: const Text('Acheter'),
          ),
        ],
      ),
    );
  }
}
