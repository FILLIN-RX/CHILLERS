class LiveChannel {
  final String id;
  final String name;
  final String slug;
  final String logo;
  final List<String> categories;
  final String country;
  final String language;
  final String type;
  final String streamUrl;
  final String ytVideoId;
  final bool enabled;
  final bool isOnline;

  LiveChannel({
    required this.id,
    required this.name,
    required this.slug,
    required this.logo,
    required this.categories,
    required this.country,
    required this.language,
    required this.type,
    required this.streamUrl,
    required this.ytVideoId,
    required this.enabled,
    required this.isOnline,
  });

  factory LiveChannel.fromJson(Map<String, dynamic> json) {
    return LiveChannel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['name'] ?? 'Chaîne inconnue',
      slug: json['slug'] ?? '',
      logo: json['logo'] ?? '',
      categories: (json['categories'] as List?)?.map((e) => e.toString()).toList() ?? [],
      country: json['country'] ?? '',
      language: json['language'] ?? '',
      type: json['type'] ?? 'hls',
      streamUrl: json['streamUrl'] ?? '',
      ytVideoId: json['ytVideoId'] ?? '',
      enabled: json['enabled'] ?? true,
      isOnline: json['isOnline'] ?? true,
    );
  }
}
