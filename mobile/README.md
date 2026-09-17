# DocuScan Burkina — Application mobile (Flutter)

Application Flutter/Android pour numériser des documents (dossiers de
bourse, CNIB, relevés/certificats) en PDF propre et les partager, avec
un système de crédits (1 document exporté = 1 crédit = 50 FCFA) payé
via Saspay (mobile money Moov/Orange Burkina Faso, carte bancaire).

Cette app partage le **même backend** (NestJS + PostgreSQL, voir
`../backend`) et donc le même compte utilisateur / solde de crédits /
historique de transactions que la PWA (`../web`).

## Fonctionnalités implémentées (réelles, pas de simulation)

- **Authentification** email + mot de passe (JWT access/refresh) contre
  le vrai backend (`/api/v1/auth/*`).
- **Scanner multi-pages** : capture photo (caméra ou galerie),
  traitement local (redressement EXIF, amélioration contraste/luminosité,
  compression), recadrage manuel, rotation, réorganisation (drag & drop),
  suppression de page.
- **Génération PDF réelle** (package `pdf`), format A4, une page par
  image, dans l'ordre choisi. Le PDF est généré et stocké **localement**
  sur l'appareil — jamais envoyé au serveur pour sa création.
- **Historique local** des documents (Hive) : nom, date, nombre de pages,
  miniature, taille, actions (ouvrir / partager / renommer / supprimer).
  Les documents restent sur l'appareil (confidentialité).
- **Système de crédits réel** : solde et historique récupérés depuis le
  backend (`/api/v1/credits/*`), jamais calculés localement.
- **Export/débit idempotent** : avant de partager un PDF, l'app appelle
  `/api/v1/documents/export` avec une référence unique (l'UUID local du
  document) — rejouer cet appel (double-clic, erreur réseau + retry) ne
  débite jamais deux fois grâce à l'idempotence côté serveur.
- **Achat de crédits réel via Saspay** : les packs (nom, crédits, prix)
  viennent de `/api/v1/credit-packs` (gérés depuis l'admin backend,
  jamais codés en dur ici). Le paiement se fait dans une WebView pointant
  sur la vraie session de checkout Saspay créée par le backend. Le crédit
  n'est appliqué qu'après confirmation serveur (webhook signé OU
  vérification active `/payments/:id/verify`) — jamais décidé par le
  client seul.
- **Partage natif** du PDF (WhatsApp, Gmail, Drive, Bluetooth, etc.) via
  `share_plus`.
- **Aucune clé secrète** (Saspay, JWT secret...) n'existe côté client :
  uniquement les tokens JWT courts/longs émis par le backend.

## Limitation connue (documentée, pas simulée)

La détection automatique des 4 coins d'un document (correction de
perspective complète) n'est **pas implémentée** dans cette version.
L'utilisateur peut recadrer manuellement (rectangle ajustable) et faire
pivoter chaque page, ce qui couvre le cas d'usage principal (documents
photographiés à plat). L'auto-détection de contour est une amélioration
future.

## Configuration

Voir `.env.example` — la configuration se fait via `--dart-define`
(Flutter ne lit pas de fichier `.env`).

```bash
flutter pub get

# Développement (contre backend local)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000

# Build APK release (contre backend déployé)
flutter build apk --release \
  --dart-define=API_BASE_URL=https://docuscan-burkina-api.onrender.com
```

## Signature Android (release)

Le keystore de release (`android/release-key.jks`, `android/key.properties`)
n'est **jamais commité** (voir `.gitignore`). Générez le vôtre :

```bash
keytool -genkey -v -keystore android/release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias release
```

Puis créez `android/key.properties` :
```
storePassword=VOTRE_MOT_DE_PASSE
keyPassword=VOTRE_MOT_DE_PASSE
keyAlias=release
storeFile=../release-key.jks
```

Le `android/app/build.gradle.kts` utilise automatiquement ce fichier
s'il existe, sinon retombe sur la signature debug.

## Architecture du code

```
lib/
  config/            # AppConfig (URL backend)
  theme/              # Thème visuel (cohérent avec la PWA)
  models/             # User, CreditPack, CreditTransaction, Payment, LocalDocument (Hive)
  services/           # ApiClient, AuthService, CreditsService, DocumentsService,
                       # PaymentsService, ImageProcessingService, PdfService,
                       # LocalStorageService, TokenStorage
  providers/          # AuthProvider, CreditsProvider, DocumentsProvider (state management)
  screens/
    auth/             # Login, Register
    home/             # Accueil (solde + CTA scanner + documents récents)
    scanner/          # Capture multi-pages, recadrage, rotation
    history/          # Liste des documents, détail (export/partage)
    credits/          # Achat de crédits (packs, checkout Saspay, historique)
    profile/          # Profil utilisateur, déconnexion
```

## Package Android

`com.docuscanburkina.scanner` — cohérent entre
`android/app/build.gradle.kts` (namespace + applicationId),
`AndroidManifest.xml` et `MainActivity.kt`.

## Statut

- ✅ Scanner multi-pages, PDF local, partage natif — fonctionnels et testés
- ✅ Auth, crédits, export idempotent — connectés au vrai backend NestJS
- ✅ Achat de crédits via vraie session Saspay (checkout hébergé)
- ✅ APK release signé généré et vérifié (`apksigner verify`)
- ⏳ Détection automatique de contour (perspective) — non implémentée
- ⏳ Paiement softpay (push direct) — endpoint backend prêt, écran dédié
  non construit (le checkout hébergé couvre le flux principal)
