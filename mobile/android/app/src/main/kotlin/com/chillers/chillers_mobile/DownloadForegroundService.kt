package com.chillers.chillers_mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Service de premier plan qui empêche Android de tuer le process pendant un
 * téléchargement.
 *
 * Il ne contient AUCUNE logique de téléchargement : sur Android, l'isolate Dart
 * continue de s'exécuter tant que le process vit. Ce service se contente donc de
 * maintenir le process éveillé (app en arrière-plan, écran éteint) et d'afficher
 * la progression. Toute la logique reste dans DownloadService côté Dart.
 */
class DownloadForegroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Téléchargement"
        val progress = intent?.getIntExtra(EXTRA_PROGRESS, -1) ?: -1

        val notification = buildOngoingNotification(this, title, progress)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ONGOING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIF_ONGOING_ID, notification)
        }

        // START_NOT_STICKY : relancer le service sans l'app n'a pas de sens, c'est
        // l'isolate Dart qui pilote le transfert et il ne serait pas relancé.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ONGOING = "chillers_downloads"
        const val CHANNEL_DONE = "chillers_downloads_done"
        const val CHANNEL_MATCHES = "chillers_matches"
        const val CHANNEL_RELEASES = "chillers_releases"
        const val NOTIF_ONGOING_ID = 8801
        const val NOTIF_DONE_ID = 8802
        const val EXTRA_TITLE = "title"
        const val EXTRA_PROGRESS = "progress"

        fun createChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val manager = context.getSystemService(NotificationManager::class.java) ?: return

            if (manager.getNotificationChannel(CHANNEL_ONGOING) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ONGOING,
                        "Téléchargements en cours",
                        NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "Progression des téléchargements CHILLERS"
                        setShowBadge(false)
                    }
                )
            }

            if (manager.getNotificationChannel(CHANNEL_DONE) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_DONE,
                        "Téléchargements terminés",
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "Notification de fin de téléchargement"
                    }
                )
            }

            if (manager.getNotificationChannel(CHANNEL_MATCHES) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_MATCHES,
                        "Matchs en direct & Alertes",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Alertes avant les coups d'envoi et temps forts"
                        enableVibration(true)
                        setShowBadge(true)
                    }
                )
            }

            if (manager.getNotificationChannel(CHANNEL_RELEASES) == null) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_RELEASES,
                        "Nouveaux Épisodes & Sorties",
                        NotificationManager.IMPORTANCE_DEFAULT
                    ).apply {
                        description = "Sorties de nouveaux épisodes et ajouts de films"
                        setShowBadge(true)
                    }
                )
            }
        }

        fun contentIntent(context: Context): PendingIntent? {
            val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: return null
            launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            return PendingIntent.getActivity(context, 0, launch, flags)
        }

        fun newBuilder(context: Context, channelId: String): Notification.Builder {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(context, channelId)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(context)
            }
        }

        fun buildOngoingNotification(context: Context, title: String, progress: Int): Notification {
            val builder = newBuilder(context, CHANNEL_ONGOING)

            builder.setContentTitle("CHILLERS")
                .setContentText(if (progress in 0..100) "$title — $progress %" else title)
                .setSmallIcon(R.drawable.ic_stat_chillers)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentIntent(context))

            if (progress in 0..100) {
                builder.setProgress(100, progress, false)
            } else {
                builder.setProgress(0, 0, true)
            }

            return builder.build()
        }
    }
}
