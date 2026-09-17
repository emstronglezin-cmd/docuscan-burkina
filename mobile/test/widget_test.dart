// Test de fumée: verifie que l'application DocuScan Burkina demarre sans
// exception et affiche l'ecran de demarrage (splash) ou l'ecran de
// connexion en l'absence de session existante.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:docuscan_burkina/main.dart';
import 'package:docuscan_burkina/models/local_document.dart';
import 'package:docuscan_burkina/services/local_storage_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    Hive.init('./test_hive_data');
    if (!Hive.isAdapterRegistered(0)) {
      Hive.registerAdapter(LocalDocumentAdapter());
    }
    await Hive.openBox<LocalDocument>(LocalStorageService.boxName);
  });

  testWidgets('DocuScanApp demarre et affiche un ecran valide', (WidgetTester tester) async {
    await tester.pumpWidget(const DocuScanApp());
    await tester.pump();

    // A ce stade (bootstrap auth en cours ou termine), un Scaffold
    // doit toujours etre present: soit le splash, soit login, soit home.
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.byType(Scaffold), findsWidgets);
  });
}
