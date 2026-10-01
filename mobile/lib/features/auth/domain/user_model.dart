class UserModel {
  final String id;
  final String email;
  final String? username;
  final String role;
  final String? avatarUrl;
  final List<dynamic> favorites;
  final List<dynamic> watchHistory;
  final List<dynamic> watchLater;
  final UserSubscription? subscription;

  UserModel({
    required this.id,
    required this.email,
    this.username,
    required this.role,
    this.avatarUrl,
    this.favorites = const [],
    this.watchHistory = const [],
    this.watchLater = const [],
    this.subscription,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      email: json['email'] ?? '',
      username: json['username'],
      role: json['role'] ?? 'user',
      avatarUrl: json['avatarUrl'],
      favorites: json['favorites'] is List ? json['favorites'] : [],
      watchHistory: json['watchHistory'] is List ? json['watchHistory'] : [],
      watchLater: json['watchLater'] is List ? json['watchLater'] : [],
      subscription: json['subscription'] != null
          ? UserSubscription.fromJson(json['subscription'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'username': username,
      'role': role,
      'avatarUrl': avatarUrl,
      'favorites': favorites,
      'watchHistory': watchHistory,
      'watchLater': watchLater,
      'subscription': subscription?.toJson(),
    };
  }
}

class UserSubscription {
  final String plan;
  final String status;
  final DateTime? expiresAt;
  final Map<String, dynamic>? features;

  UserSubscription({
    required this.plan,
    required this.status,
    this.expiresAt,
    this.features,
  });

  factory UserSubscription.fromJson(Map<String, dynamic> json) {
    return UserSubscription(
      plan: json['plan'] ?? 'free',
      status: json['status'] ?? 'inactive',
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'].toString())
          : null,
      features: json['features'] is Map<String, dynamic> ? json['features'] : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'plan': plan,
      'status': status,
      'expiresAt': expiresAt?.toIso8601String(),
      'features': features,
    };
  }

  bool get isPremium => plan != 'free' && status == 'active';
}
