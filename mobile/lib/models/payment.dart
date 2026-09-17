class SaspayPaymentModel {
  final String id;
  final int creditsRequested;
  final int amountFcfa;
  final String method; // SOFTPAY / CHECKOUT
  final String status; // PENDING / SUCCESS / FAILED / CANCELLED
  final String? checkoutUrl;
  final DateTime createdAt;

  SaspayPaymentModel({
    required this.id,
    required this.creditsRequested,
    required this.amountFcfa,
    required this.method,
    required this.status,
    this.checkoutUrl,
    required this.createdAt,
  });

  factory SaspayPaymentModel.fromJson(Map<String, dynamic> json) {
    return SaspayPaymentModel(
      id: json['id'] as String,
      creditsRequested: (json['creditsRequested'] as num?)?.toInt() ?? 0,
      amountFcfa: (json['amountFcfa'] as num?)?.toInt() ?? 0,
      method: json['method'] as String? ?? 'CHECKOUT',
      status: json['status'] as String? ?? 'PENDING',
      checkoutUrl: json['checkoutUrl'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
