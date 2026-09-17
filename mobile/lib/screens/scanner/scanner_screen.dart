import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../providers/documents_provider.dart';
import '../../theme/app_theme.dart';
import '../history/document_detail_screen.dart';
import 'crop_screen.dart';

/// Ecran de numerisation multi-pages.
///
/// Flux: Camera -> traitement local (redressement/amelioration) -> ajout
/// a la liste des pages -> l'utilisateur peut reordonner, faire pivoter,
/// recadrer ou supprimer chaque page -> "Terminer" cree le document local.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final ImagePicker _picker = ImagePicker();
  bool _capturing = false;

  Future<void> _capture({required bool fromCamera}) async {
    if (_capturing) return;

    if (fromCamera) {
      final status = await Permission.camera.request();
      if (!status.isGranted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Autorisation caméra requise pour scanner.')),
          );
        }
        return;
      }
    }

    setState(() => _capturing = true);
    try {
      final XFile? file = await _picker.pickImage(
        source: fromCamera ? ImageSource.camera : ImageSource.gallery,
        imageQuality: 95,
      );
      if (file == null) return;

      if (!mounted) return;
      await context.read<DocumentsProvider>().addCapturedPage(file.path);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur lors de la capture: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _finalize() async {
    final provider = context.read<DocumentsProvider>();
    if (provider.currentPages.isEmpty) return;

    final name = await _promptForName();
    if (name == null || name.trim().isEmpty) return;

    final doc = await provider.finalizeToDocument(name.trim());
    if (!mounted) return;

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => DocumentDetailScreen(documentId: doc.id)),
    );
  }

  Future<String?> _promptForName() async {
    final controller = TextEditingController(
      text: 'Document_${DateTime.now().day}${DateTime.now().month}${DateTime.now().year}',
    );
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nom du document'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Ex: CNIB, Relevé de notes...'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Continuer'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<DocumentsProvider>();
    final pages = provider.currentPages;

    return Scaffold(
      appBar: AppBar(
        title: Text('Scanner${pages.isNotEmpty ? ' (${pages.length})' : ''}'),
        actions: [
          if (pages.isNotEmpty)
            TextButton(
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Annuler le scan ?'),
                    content: const Text('Les pages capturées seront perdues.'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Non')),
                      TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Oui')),
                    ],
                  ),
                );
                if (confirm == true) {
                  provider.clearCurrentSession();
                  if (context.mounted) Navigator.pop(context);
                }
              },
              child: const Text('Annuler', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: pages.isEmpty
          ? _EmptyState(capturing: _capturing, onCapture: _capture)
          : Column(
              children: [
                Expanded(
                  child: ReorderableGridView(
                    pages: pages,
                    onReorder: provider.reorderPages,
                    onRotate: (i) => provider.rotatePage(i),
                    onCrop: (i) async {
                      final path = pages[i];
                      final result = await Navigator.of(context).push<Map<String, double>>(
                        MaterialPageRoute(builder: (_) => CropScreen(imagePath: path)),
                      );
                      if (result != null) {
                        await provider.cropPage(
                          i,
                          left: result['left']!,
                          top: result['top']!,
                          width: result['width']!,
                          height: result['height']!,
                        );
                      }
                    },
                    onDelete: (i) => provider.removePage(i),
                  ),
                ),
                _BottomBar(
                  capturing: _capturing,
                  onAddPage: () => _capture(fromCamera: true),
                  onAddFromGallery: () => _capture(fromCamera: false),
                  onFinish: _finalize,
                ),
              ],
            ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final bool capturing;
  final Future<void> Function({required bool fromCamera}) onCapture;

  const _EmptyState({required this.capturing, required this.onCapture});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.document_scanner_outlined, size: 96, color: AppTheme.primary),
            const SizedBox(height: 24),
            const Text(
              'Photographiez votre document',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              'Placez le document bien à plat, avec un bon éclairage, puis prenez la photo.',
              style: TextStyle(color: AppTheme.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: capturing ? null : () => onCapture(fromCamera: true),
              icon: capturing
                  ? const SizedBox(
                      height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.camera_alt_outlined),
              label: const Text('Prendre une photo'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: capturing ? null : () => onCapture(fromCamera: false),
              icon: const Icon(Icons.photo_library_outlined),
              label: const Text('Choisir depuis la galerie'),
            ),
          ],
        ),
      ),
    );
  }
}

class _BottomBar extends StatelessWidget {
  final bool capturing;
  final VoidCallback onAddPage;
  final VoidCallback onAddFromGallery;
  final VoidCallback onFinish;

  const _BottomBar({
    required this.capturing,
    required this.onAddPage,
    required this.onAddFromGallery,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, -2))],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            IconButton.filledTonal(
              onPressed: capturing ? null : onAddFromGallery,
              icon: const Icon(Icons.photo_library_outlined),
            ),
            const SizedBox(width: 10),
            IconButton.filled(
              onPressed: capturing ? null : onAddPage,
              icon: const Icon(Icons.add_a_photo_outlined),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton(
                onPressed: onFinish,
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success),
                child: const Text('Terminer'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ReorderableGridView extends StatelessWidget {
  final List<String> pages;
  final void Function(int oldIndex, int newIndex) onReorder;
  final void Function(int index) onRotate;
  final void Function(int index) onCrop;
  final void Function(int index) onDelete;

  const ReorderableGridView({
    super.key,
    required this.pages,
    required this.onReorder,
    required this.onRotate,
    required this.onCrop,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: pages.length,
      onReorder: onReorder,
      itemBuilder: (context, index) {
        final path = pages[index];
        return Card(
          key: ValueKey(path),
          margin: const EdgeInsets.only(bottom: 12),
          clipBehavior: Clip.antiAlias,
          child: Row(
            children: [
              SizedBox(
                width: 90,
                height: 110,
                child: Image.file(File(path), fit: BoxFit.cover),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text('Page ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.crop_outlined),
                onPressed: () => onCrop(index),
                tooltip: 'Recadrer',
              ),
              IconButton(
                icon: const Icon(Icons.rotate_right_outlined),
                onPressed: () => onRotate(index),
                tooltip: 'Pivoter',
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: AppTheme.danger),
                onPressed: () => onDelete(index),
                tooltip: 'Supprimer',
              ),
              ReorderableDragStartListener(
                index: index,
                child: const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: Icon(Icons.drag_handle, color: AppTheme.textSecondary),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
