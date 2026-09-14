# DocuScan Burkina

Application de numérisation de documents pour étudiants et particuliers au Burkina Faso (dossiers de bourse, CNIB, certificats...). Scanner un document → PDF propre → partager. **1 document exporté = 1 crédit = 50 FCFA.**

## Structure du monorepo

```
/backend   Backend NestJS + PostgreSQL (API, crédits, Saspay, admin) — PRÊT POUR RENDER
/web       PWA React + Vite + Tailwind (scanner, PDF, crédits)        — PRÊT POUR VERCEL
/admin     (réservé — l'administration est actuellement exposée via l'API /api/v1/admin/*,
            consommable par un futur frontend dédié ou directement en HTTP/Postman)
/mobile    -> voir /home/user/flutter_app (projet Flutter séparé, socle créé, APK non requis cette session)
```

## État d'avancement (session courante)

### ✅ Backend NestJS (`/backend`) — Terminé et testé en conditions réelles
- Auth JWT (access + refresh, bcrypt), RBAC (USER/ADMIN/SUPERADMIN)
- **Système de crédits transactionnel atomique** : verrouillage pessimiste SQL,
  idempotence par référence unique (empêche double crédit/débit/webhook),
  refus de solde négatif — **validé par tests manuels réels** (double-clic export,
  double webhook Saspay, solde insuffisant → 409).
- Packs de crédits configurables en base (jamais codés en dur), CRUD admin.
- **Intégration Saspay réelle** (pas de simulation) : softpay, checkout hébergé,
  vérification active (`/verify`), **webhook avec vérification de signature
  HMAC-SHA256 + tolérance d'horodatage de 5 min**, conforme à
  https://docs.saspay.me — testé avec signatures valides/invalides/expirées.
- Journal d'export de documents (métadonnées uniquement, jamais le fichier —
  confidentialité par design).
- Dashboard admin (utilisateurs, revenus, paiements, ajustements tracés).
- Migrations SQL versionnées (TypeORM), `.env.example`, `render.yaml`.
- Sécurité : Helmet, CORS configurable, rate limiting (Throttler), validation
  stricte des DTO, aucune clé secrète exposée au frontend.

### ✅ PWA (`/web`) — Fonctionnelle, build de production validé
- React + Vite + Tailwind + vite-plugin-pwa (installable, manifest, service worker).
- Auth (login/register), Accueil (solde, derniers documents), Scanner multi-pages
  (caméra native via `<input capture="environment">` + import galerie),
  traitement d'image local (Canvas : rotation, amélioration contraste/luminosité,
  redimensionnement pour perf mobile), génération PDF **réelle** locale (jsPDF,
  A4, une page par image, orientation auto), export avec débit de crédit
  idempotent, Partage (Web Share API) / Ouvrir / Enregistrer, achat de crédits
  (redirection Saspay checkout hébergé), stockage local des documents (IndexedDB).
- `vercel.json` (SPA rewrites), `.env.example` (VITE_API_BASE_URL).

### 🔶 Mobile Flutter (`/home/user/flutter_app`)
- Projet Flutter créé (structure de base). **Non prioritaire cette session**
  (APK non requis) — le développement complet du scanner natif, multi-pages,
  génération PDF locale (`pdf`/`syncfusion`), partage (`share_plus`) et
  intégration API reste à faire en suivant exactement la même logique métier
  que la PWA (mêmes endpoints, même règle 1 document = 1 crédit).

### ⏳ Reste à faire (non réalisé par manque de budget dans cette session)
1. **Détection automatique des 4 coins + correction de perspective complète**
   (actuellement : rotation + amélioration contraste, pas de détection de
   contours automatique — limitation documentée dans `web/src/lib/image.ts`).
2. Interface d'administration web dédiée (actuellement l'admin consomme l'API
   `/api/v1/admin/*` directement — un frontend React dédié reste à construire).
3. Application mobile Flutter complète (scanner, PDF, partage, écrans).
4. Tests automatisés (Jest) pour `CreditsService` et `SaspayWebhookController`
   (la logique a été validée manuellement en conditions réelles avec succès,
   mais aucune suite Jest n'a encore été écrite).
5. Compte Saspay réel : `SASPAY_API_KEY` et `SASPAY_WEBHOOK_SECRET` doivent
   être obtenus depuis https://app.saspay.me (KYC marchand requis) puis
   renseignés en production — voir `.env.example`.

## Démarrage rapide (développement local)

### Backend
```bash
cd backend
cp .env.example .env   # renseigner DB_*, JWT_*, SASPAY_* (sk_test_...)
npm install
npm run migration:run
npm run start:dev       # http://localhost:3000/api/v1
```

### PWA
```bash
cd web
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev              # http://localhost:5173
```

## Déploiement production

- **Backend → Render** : `backend/render.yaml` (base PostgreSQL managée incluse).
  Renseigner les secrets (`JWT_*`, `SASPAY_*`, `ADMIN_BOOTSTRAP_*`) dans le
  dashboard Render (jamais dans le repo Git).
- **PWA → Vercel** : importer `/web`, variable d'env `VITE_API_BASE_URL`
  pointant vers l'URL Render du backend.

## Sécurité — principes appliqués

- Le frontend ne décide jamais d'un crédit ou d'un paiement réussi : seul le
  backend, après vérification Saspay (webhook signé OU appel `/verify`),
  déclenche `CreditsService.creditForPurchase` (transaction atomique + idempotente).
- Chaque paiement Saspay est identifié par sa référence unique (`saspayReference`,
  contrainte SQL UNIQUE) : un webhook livré deux fois ne peut pas créditer deux fois.
- Le contenu des documents (photos, PDF) ne quitte jamais l'appareil de
  l'utilisateur : seules des métadonnées (nom, nb pages, taille) sont envoyées
  au backend, uniquement pour débiter le crédit correspondant.

## Documentation API Saspay utilisée

Toute l'intégration respecte strictement https://docs.saspay.me (base URL
`https://api.saspay.me/api/v1`, endpoints `/payments/softpay/`,
`/checkout-sessions/`, `/payments/{id}/verify/`, webhooks avec signature
`X-Webhook-Signature` / `X-Webhook-Timestamp`). Aucun endpoint inventé.
