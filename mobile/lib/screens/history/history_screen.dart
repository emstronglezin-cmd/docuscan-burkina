import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/documents_provider.dart';
import '../../theme/app_theme.dart';
import 'document_detail_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DocumentsProvider>().loadDocuments();
    });
  }

  @override
  Widget build(BuildContext context) {
    final documents = context.watch<DocumentsProvider>().documents;

    return Scaffold(
      appBar: AppBar(title: const Text('Mes documents')),
      body: documents.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.folder_open_outlined, size: 72, color: AppTheme.textSecondary),
                    SizedBox(height: 16),
                    Text('Aucun document numérisé', style: TextStyle(color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: documents.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final doc = documents[index];
                final thumb = doc.pageImagePaths.isNotEmpty ? doc.pageImagePaths.first : null;
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    contentPadding: const EdgeInsets.all(10),
                    leading: SizedBox(
                      width: 52,
                      height: 68,
                      child: thumb != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.file(File(thumb), fit: BoxFit.cover),
                            )
                          : const Icon(Icons.description_outlined, color: AppTheme.primary),
                    ),
                    title: Text(doc.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      '${doc.pageCount} page(s) · ${_formatSize(doc.fileSizeBytes)} · ${_formatDate(doc.createdAt)}',
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: doc.exported
                        ? const Icon(Icons.check_circle, color: AppTheme.success)
                        : const Icon(Icons.pending_outlined, color: AppTheme.textSecondary),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
                      );
                    },
                  ),
                );
              },
            ),
    );
  }

  String _formatSize(int? bytes) {
    if (bytes == null || bytes == 0) return '--';
    final kb = bytes / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(0)} Ko';
    return '${(kb / 1024).toStringAsFixed(1)} Mo';
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }
}
