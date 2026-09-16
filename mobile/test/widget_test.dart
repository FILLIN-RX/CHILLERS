import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:chillers_mobile/models/media_item.dart';
import 'package:chillers_mobile/features/offline_transfer/offline_transfer.dart';

void main() {
  testWidgets('ShareOfflineButton renders correctly', (WidgetTester tester) async {
    final media = MediaItem(
      id: 'test-123',
      title: 'Inception',
      type: 'movie',
      streamUrl: '/path/to/local/movie.mp4',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ShareOfflineButton(media: media),
        ),
      ),
    );

    expect(find.text('Partager Hors Ligne'), findsOneWidget);
    expect(find.byIcon(Icons.wifi_tethering_rounded), findsOneWidget);
  });

  testWidgets('TransferProgressWidget displays progress and metrics', (WidgetTester tester) async {
    final progress = TransferProgress(
      sessionId: 'sess-abc',
      state: TransferState.transferring,
      progress: 0.75,
      transferredBytes: 750000000,
      totalBytes: 1000000000,
      currentSpeed: 25000000, // 25 MB/s
      estimatedTimeRemaining: const Duration(seconds: 10),
      statusMessage: 'Envoi des données...',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TransferProgressWidget(
            progress: progress,
          ),
        ),
      ),
    );

    expect(find.textContaining('75%'), findsOneWidget);
    expect(find.text('Envoi des données...'), findsOneWidget);
    expect(find.textContaining('23.8 MB/s'), findsOneWidget);
  });
}
