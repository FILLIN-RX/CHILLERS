class LiveMatch {
  final String id;
  final String status; // 'live' | 'upcoming'
  final String home;
  final String away;
  final String? homeLogo;
  final String? awayLogo;
  final String? score;
  final String? minute;
  final int? startTs;
  final String? league;

  LiveMatch({
    required this.id,
    required this.status,
    required this.home,
    required this.away,
    this.homeLogo,
    this.awayLogo,
    this.score,
    this.minute,
    this.startTs,
    this.league,
  });

  factory LiveMatch.fromJson(Map<String, dynamic> json) {
    return LiveMatch(
      id: json['id']?.toString() ?? '',
      status: json['status'] ?? 'upcoming',
      home: json['home'] ?? 'Équipe 1',
      away: json['away'] ?? 'Équipe 2',
      homeLogo: json['homeLogo'],
      awayLogo: json['awayLogo'],
      score: json['score'],
      minute: json['minute'],
      startTs: json['startTs'] is int ? json['startTs'] : null,
      league: json['league'],
    );
  }
}
