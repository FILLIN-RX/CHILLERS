import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'native_bridge.dart';

class MatchReminder {
  final String matchId;
  final String title;
  final String? teamHome;
  final String? teamAway;
  final String? league;
  final DateTime matchTime;
  final DateTime reminderTime;

  MatchReminder({
    required this.matchId,
    required this.title,
    this.teamHome,
    this.teamAway,
    this.league,
    required this.matchTime,
    required this.reminderTime,
  });

  Map<String, dynamic> toJson() => {
        'matchId': matchId,
        'title': title,
        'teamHome': teamHome,
        'teamAway': teamAway,
        'league': league,
        'matchTime': matchTime.toIso8601String(),
        'reminderTime': reminderTime.toIso8601String(),
      };

  factory MatchReminder.fromJson(Map<String, dynamic> json) => MatchReminder(
        matchId: json['matchId'] ?? '',
        title: json['title'] ?? '',
        teamHome: json['teamHome'],
        teamAway: json['teamAway'],
        league: json['league'],
        matchTime: DateTime.tryParse(json['matchTime'] ?? '') ?? DateTime.now(),
        reminderTime: DateTime.tryParse(json['reminderTime'] ?? '') ?? DateTime.now(),
      );
}

class NotificationService extends ChangeNotifier {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal() {
    _loadReminders();
  }

  static const String _matchStorageKey = 'chillers_match_reminders_v1';

  final Map<String, MatchReminder> _reminders = {};
  bool _matchAlertsEnabled = true;
  bool _releaseAlertsEnabled = true;

  bool get matchAlertsEnabled => _matchAlertsEnabled;
  bool get releaseAlertsEnabled => _releaseAlertsEnabled;
  List<MatchReminder> get reminders => _reminders.values.toList();

  bool isReminderActive(String matchId) => _reminders.containsKey(matchId);

  Future<void> _loadReminders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _matchAlertsEnabled = prefs.getBool('notif_match_alerts') ?? true;
      _releaseAlertsEnabled = prefs.getBool('notif_release_alerts') ?? true;

      final raw = prefs.getString(_matchStorageKey);
      if (raw != null && raw.isNotEmpty) {
        final List<dynamic> decoded = jsonDecode(raw);
        _reminders.clear();
        for (final item in decoded) {
          final r = MatchReminder.fromJson(item);
          // Nettoyer les rappels expirés de plus de 24h
          if (DateTime.now().difference(r.matchTime).inHours < 24) {
            _reminders[r.matchId] = r;
          }
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[NotificationService] Erreur chargement: $e');
    }
  }

  Future<void> _saveReminders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = jsonEncode(_reminders.values.map((r) => r.toJson()).toList());
      await prefs.setString(_matchStorageKey, raw);
    } catch (e) {
      debugPrint('[NotificationService] Erreur sauvegarde: $e');
    }
  }

  Future<void> setMatchAlertsEnabled(bool enabled) async {
    _matchAlertsEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_match_alerts', enabled);
    notifyListeners();
  }

  Future<void> setReleaseAlertsEnabled(bool enabled) async {
    _releaseAlertsEnabled = enabled;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_release_alerts', enabled);
    notifyListeners();
  }

  /// Active ou désactive un rappel 15 minutes avant le coup d'envoi d'un match
  Future<bool> toggleMatchReminder({
    required String matchId,
    required String title,
    String? teamHome,
    String? teamAway,
    String? league,
    DateTime? matchTime,
  }) async {
    await NativeBridge.instance.ensureNotificationPermission();
    NativeBridge.instance.selectionHaptic();

    if (_reminders.containsKey(matchId)) {
      _reminders.remove(matchId);
      await _saveReminders();
      notifyListeners();
      return false;
    } else {
      final mTime = matchTime ?? DateTime.now().add(const Duration(minutes: 15));
      final reminderTime = mTime.subtract(const Duration(minutes: 15));

      final reminder = MatchReminder(
        matchId: matchId,
        title: title,
        teamHome: teamHome,
        teamAway: teamAway,
        league: league,
        matchTime: mTime,
        reminderTime: reminderTime,
      );

      _reminders[matchId] = reminder;
      await _saveReminders();
      notifyListeners();

      // Envoie d'une notification de confirmation
      await NativeBridge.instance.showMatchAlert(
        title: '🔔 Alerte Match Programmée',
        body: 'Vous serez notifié 15 min avant le coup d\'envoi de $title.',
      );

      return true;
    }
  }

  /// Déclenche une alerte de nouvel épisode
  Future<void> notifyNewEpisode({
    required String seriesTitle,
    required int seasonNumber,
    required int episodeNumber,
    String? episodeTitle,
  }) async {
    if (!_releaseAlertsEnabled) return;
    await NativeBridge.instance.showReleaseAlert(
      title: '🎬 Nouvel Épisode Disponible !',
      body: '$seriesTitle : S${seasonNumber}E$episodeNumber ${episodeTitle != null ? '- $episodeTitle' : ''}',
    );
  }
}
