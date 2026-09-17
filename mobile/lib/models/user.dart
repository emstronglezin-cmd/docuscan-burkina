class AppUser {
  final String id;
  final String email;
  final String? fullName;
  final String? phone;
  final String role;
  final int creditBalance;
  final bool isActive;
  final DateTime createdAt;

  AppUser({
    required this.id,
    required this.email,
    this.fullName,
    this.phone,
    required this.role,
    required this.creditBalance,
    required this.isActive,
    required this.createdAt,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String?,
      phone: json['phone'] as String?,
      role: json['role'] as String? ?? 'USER',
      creditBalance: (json['creditBalance'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  AppUser copyWith({int? creditBalance}) {
    return AppUser(
      id: id,
      email: email,
      fullName: fullName,
      phone: phone,
      role: role,
      creditBalance: creditBalance ?? this.creditBalance,
      isActive: isActive,
      createdAt: createdAt,
    );
  }
}
