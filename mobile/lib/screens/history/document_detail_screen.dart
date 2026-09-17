import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:open_filex/open_filex.dart';
import '../../models/local_document.dart';
import '../../providers/documents_provider.dart';
import '../../providers/credits_provider.dart';
import '../../services/documents_service.dart';
import '../../services/api_exception.dart';
import '../../theme/app_theme.dart';
import '../credits/credits_screen.dart';

/// Ecran central du flux "Finaliser -> Payer avec crédit -> PDF -> Partager".
///
/// - Genere le PDF localement (si pas deja fait).
/// - Verifie le solde avant d'autoriser l'export/partage.
/// - Appelle le backend pour DEBITER 1 credit (jamais plus, quel que
///   soit le nombre de pages) via une reference idempotente
///   (LocalDocument.id), ce qui protege contre le double-clic.
/// - Si credits insuffisants (409 backend), propose l'achat de credits.
/// - Une fois le credit debite, permet de partager/ouvrir/renommer/
///   supprimer le document, qui reste stocke localement.
class DocumentDetailScreen extends StatefulWidget {
  final String documentId;
  const DocumentDetailScreen({super.key, required this.documentId});

  @override
  State<DocumentDetailScreen> createState() => _DocumentDetailScreenState();
}

class _DocumentDetailScreenState extends State<DocumentDetailScreen> {
  final DocumentsService _documentsService = DocumentsService();
  bool _processing = false;

  LocalDocument? get _doc => context.read<DocumentsProvider>().getById(widget.documentId);

  Future<void> _exportAndShare() async {
    final provider = context.read<DocumentsProvider>();
    final credits = context.read<CreditsProvider>();
    var doc = provider.getById(widget.documentId);
    if (doc == null) return;

    setState(() => _processing = true);
    try {
      // 1. Verification prealable du solde (UX rapide, non definitive).
      await credits.refreshBalance();
      if (!doc.exported && credits.balance < 1) {
        setState(() => _processing = false);
        _promptInsufficientCredits();
        return;
      }

      // 2. Generation reelle du PDF local (A4, compresse, ordre des pages).
      final pdfPath = await provider.ensurePdfGenerated(doc);

      // 3. Debit serveur idempotent (si pas deja exporte).
      if (!doc.exported) {
        try {
          await _documentsService.confirmExport(
            documentReference: doc.id,
            fileName: doc.name,
            pageCount: doc.pageCount,
            fileSizeBytes: doc.fileSizeBytes,
          );
          await provider.markExported(doc.id);
          await credits.refreshBalance();
        } on ApiException catch (e) {
          setState(() => _processing = false);
          if (e.isInsufficientCredits) {
            _promptInsufficientCredits();
          } else {
            _showError(e.message);
          }
          return;
        }
      }

      doc = provider.getById(widget.documentId);
      setState(() => _processing = false);

      if (!mounted) return;
      await Share.shareXFiles([XFile(pdfPath)], text: doc?.name ?? 'Document DocuScan Burkina');
    } catch (e) {
      setState(() => _processing = false);
      _showError('Erreur lors de la génération du PDF: $e');
    }
  }

  Future<void> _openPdf() async {
    final provider = context.read<DocumentsProvider>();
    var doc = provider.getById(widget.documentId);
    if (doc == null) return;

    if (!doc.exported) {
      _promptExportFirst();
      return;
    }

    setState(() => _processing = true);
    try {
      final pdfPath = await provider.ensurePdfGenerated(doc);
      setState(() => _processing = false);
      await OpenFilex.open(pdfPath);
    } catch (e) {
      setState(() => _processing = false);
      _showError('Impossible d\'ouvrir le PDF: $e');
    }
  }

  void _promptInsufficientCredits() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Crédits insuffisants'),
        content: const Text(
          'Vous n\'avez pas assez de crédits pour exporter ce document. '
          '1 document exporté = 1 crédit, quel que soit le nombre de pages.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const CreditsScreen()));
            },
            child: const Text('Acheter des crédits'),
          ),
        ],
      ),
    );
  }

  void _promptExportFirst() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Exportez d\'abord le document pour l\'ouvrir.')),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppTheme.danger),
    );
  }

  Future<void> _rename() async {
    final doc = _doc;
    if (doc == null) return;
    final controller = TextEditingController(text: doc.name);
    final newName = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Renommer le document'),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          ElevatedButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Enregistrer')),
        ],
      ),
    );
    if (newName != null && newName.trim().isNotEmpty) {
      await context.read<DocumentsProvider>().renameDocument(doc.id, newName.trim());
      setState(() {});
    }
  }

  Future<void> _delete() async {
    final doc = _doc;
    if (doc == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Supprimer ce document ?'),
        content: const Text('Cette action est irréversible et supprime le PDF et les pages localement.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await context.read<DocumentsProvider>().deleteDocument(doc.id);
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<DocumentsProvider>();
    final doc = _doc;

    if (doc == null) {
      return const Scaffold(body: Center(child: Text('Document introuvable')));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(doc.name, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: _rename),
          IconButton(icon: const Icon(Icons.delete_outline), onPressed: _delete),
        ],
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            color: doc.exported ? AppTheme.success.withValues(alpha: 0.1) : AppTheme.accent.withValues(alpha: 0.1),
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(
                  doc.exported ? Icons.check_circle : Icons.info_outline,
                  color: doc.exported ? AppTheme.success : AppTheme.accent,
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    doc.exported
                        ? 'Document exporté (1 crédit utilisé)'
                        : 'Non exporté — nécessite 1 crédit pour exporter/partager',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: doc.pageImagePaths.length,
              itemBuilder: (context, index) {
                return ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.file(File(doc.pageImagePaths[index]), fit: BoxFit.cover),
                      Positioned(
                        bottom: 4,
                        right: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.black54,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text('${index + 1}', style: const TextStyle(color: Colors.white, fontSize: 11)),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, -2))],
        ),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _processing ? null : _openPdf,
                  icon: const Icon(Icons.open_in_new),
                  label: const Text('Ouvrir'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _processing ? null : _exportAndShare,
                  icon: _processing
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Icon(doc.exported ? Icons.share_outlined : Icons.picture_as_pdf_outlined),
                  label: Text(doc.exported ? 'Partager le PDF' : 'Exporter & Partager (1 crédit)'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
