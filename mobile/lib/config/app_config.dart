/// Configuration globale de l'application DocuScan Burkina.
///
/// IMPORTANT: `apiBaseUrl` pointe vers le VRAI backend NestJS déployé
/// (ou tournant dans le sandbox de développement). Il ne s'agit jamais
/// d'une simulation locale : toutes les requêtes credits/paiements/
/// auth passent réellement par ce serveur.
///
/// Pour la production, remplacez cette URL par celle du backend déployé
/// sur Render, ex: https://docuscan-burkina-api.onrender.com
class AppConfig {
  AppConfig._();

  /// URL de base de l'API backend (sans slash final), incluant le préfixe
  /// de version (/api/v1 est ajouté automatiquement par ApiClient).
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://3000-ide3desx5xnta5yuxjasu-b32ec7bb.sandbox.novita.ai',
  );

  static const String appName = 'DocuScan Burkina';

  /// Prix affiché par crédit à titre indicatif uniquement.
  /// Les vrais prix viennent TOUJOURS de GET /credit-packs (jamais figés ici).
  static const int indicativeFcfaPerCredit = 50;
}
