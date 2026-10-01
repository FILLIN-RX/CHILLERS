import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:audioplayers/audioplayers.dart';

class FeedbackService {
  static final FeedbackService _instance = FeedbackService._internal();
  static final AudioPlayer _audioPlayer = AudioPlayer();

  factory FeedbackService() {
    return _instance;
  }

  FeedbackService._internal();

  // Haptic: Medium intensity (Medium)
  static Future<void> hapticMedium() async {
    try {
      await HapticFeedback.mediumImpact();
    } catch (e) {
      debugPrint('Haptic Medium error: $e');
    }
  }

  // Haptic: Light intensity (Light)
  static Future<void> hapticLight() async {
    try {
      await HapticFeedback.lightImpact();
    } catch (e) {
      debugPrint('Haptic Light error: $e');
    }
  }

  // Haptic: Heavy intensity (Heavy)
  static Future<void> hapticHeavy() async {
    try {
      await HapticFeedback.heavyImpact();
    } catch (e) {
      debugPrint('Haptic Heavy error: $e');
    }
  }

  // Play success sound
  static Future<void> _playSuccessSound() async {
    try {
      await _audioPlayer.play(AssetSource('sounds/success.mp3'));
    } catch (e) {
      debugPrint('Success sound error: $e');
    }
  }

  // Play add sound
  static Future<void> _playAddSound() async {
    try {
      await _audioPlayer.play(AssetSource('sounds/add.mp3'));
    } catch (e) {
      debugPrint('Add sound error: $e');
    }
  }

  // Haptic + Sound combined (feedback for like action)
  static Future<void> feedbackLike() async {
    await hapticMedium();
    await _playSuccessSound();
  }

  // Feedback for playlist action
  static Future<void> feedbackPlaylist() async {
    await hapticMedium();
    await _playAddSound();
  }

  // Feedback for scroll/visibility
  static Future<void> feedbackScroll() async {
    await hapticLight();
  }
}
