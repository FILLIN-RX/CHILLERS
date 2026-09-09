class SubscriptionPlanModel {
  final String id;
  final String name;
  final double price;
  final String currency;
  final int durationDays;
  final int maxDevices;
  final List<String> features;

  SubscriptionPlanModel({
    required this.id,
    required this.name,
    required this.price,
    this.currency = 'FCFA',
    this.durationDays = 30,
    required this.maxDevices,
    required this.features,
  });

  factory SubscriptionPlanModel.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlanModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name'] ?? json['plan'] ?? 'Plan VIP',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      currency: json['currency']?.toString() ?? 'FCFA',
      durationDays: json['durationDays'] is int
          ? json['durationDays']
          : (int.tryParse(json['durationDays']?.toString() ?? '30') ?? 30),
      maxDevices: json['maxDevices'] is int ? json['maxDevices'] : 1,
      features: (json['features'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}

