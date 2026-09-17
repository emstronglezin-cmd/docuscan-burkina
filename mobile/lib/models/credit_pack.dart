/// Pack de credits tel que renvoye par le backend (GET /credit-packs).
/// Les prix ne sont JAMAIS codes en dur cote client: ils viennent
/// toujours de cette structure recuperee depuis l'API.
class CreditPack {
  final String id;
  final String name;
  final int credits;
  final int priceFcfa;
  final bool isActive;
  final bool isPopular;
  final int sortOrder;

  CreditPack({
    required this.id,
    required this.name,
    required this.credits,
    required this.priceFcfa,
    required this.isActive,
    required this.isPopular,
    required this.sortOrder,
  });

  factory CreditPack.fromJson(Map<String, dynamic> json) {
    return CreditPack(
      id: json['id'] as String,
      name: json['name'] as String,
      credits: (json['credits'] as num).toInt(),
      priceFcfa: (json['priceFcfa'] as num).toInt(),
      isActive: json['isActive'] as bool? ?? true,
      isPopular: json['isPopular'] as bool? ?? false,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}
