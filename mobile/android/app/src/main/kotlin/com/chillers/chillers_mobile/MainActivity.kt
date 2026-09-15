package com.chillers.chillers_mobile

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.AudioManager
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.MediaStore
import android.util.Rational
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

/**
 * Expose au Dart les capacités natives liées au lecteur vidéo et aux téléchargements :
 * Picture-in-Picture, luminosité d'écran, volume matériel, service de premier plan,
 * notifications, publication MediaStore, espace disque et Wi-Fi Multicast pour Cast TV.
 */
class MainActivity : FlutterFragmentActivity() {

    private var pendingPermissionResult: MethodChannel.Result? = null
    private var channel: MethodChannel? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        DownloadForegroundService.createChannels(this)

        val ch = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        channel = ch
        ch.setMethodCallHandler { call, result ->
                when (call.method) {
                    // ── Wi-Fi Multicast Lock & Cast TV ──
                    "acquireMulticastLock" -> {
                        acquireMulticastLock()
                        result.success(true)
                    }

                    "releaseMulticastLock" -> {
                        releaseMulticastLock()
                        result.success(true)
                    }

                    "openExternalCaster" -> {
                        val url = call.argument<String>("videoUrl") ?: ""
                        val title = call.argument<String>("title") ?: "Vidéo"
                        result.success(openExternalCaster(url, title))
                    }
                    "startForeground" -> {
                        val title = call.argument<String>("title") ?: "Téléchargement"
                        startDownloadService(title, -1)
                        result.success(true)
                    }

                    "updateProgress" -> {
                        val title = call.argument<String>("title") ?: "Téléchargement"
                        val progress = call.argument<Int>("progress") ?: -1
                        startDownloadService(title, progress)
                        result.success(true)
                    }

                    "stopForeground" -> {
                        stopService(Intent(this, DownloadForegroundService::class.java))
                        result.success(true)
                    }

                    "notifyCompleted" -> {
                        notifyCompleted(
                            call.argument<String>("title") ?: "Vidéo",
                            call.argument<String>("uri")
                        )
                        result.success(true)
                    }

                    "ensureNotificationPermission" -> ensureNotificationPermission(result)

                    "publishToDownloads" -> {
                        val path = call.argument<String>("path")
                        val name = call.argument<String>("displayName")
                        if (path == null || name == null) {
                            result.success(null)
                        } else {
                            result.success(publishToDownloads(path, name))
                        }
                    }

                    "openUri" -> {
                        val uri = call.argument<String>("uri")
                        result.success(if (uri == null) false else openUri(uri))
                    }

                    "deletePublished" -> {
                        val uri = call.argument<String>("uri")
                        result.success(if (uri == null) false else deletePublished(uri))
                    }

                    "getFreeSpace" -> result.success(freeSpaceBytes())

                    // ── Picture-in-Picture (PiP) ──
                    "isPipSupported" -> result.success(isPipSupported())

                    "isInPipMode" -> result.success(isInPipMode())

                    "enterPip" -> {
                        val num = call.argument<Int>("aspectRatioNumerator") ?: 16
                        val den = call.argument<Int>("aspectRatioDenominator") ?: 9
                        result.success(enterPipMode(num, den))
                    }

                    // ── Luminosité d'écran ──
                    "setBrightness" -> {
                        val brightness = call.argument<Double>("brightness") ?: -1.0
                        setScreenBrightness(brightness)
                        result.success(true)
                    }

                    "getBrightness" -> result.success(getScreenBrightness())

                    // ── Volume Sonore Matériel ──
                    "setVolume" -> {
                        val volume = call.argument<Double>("volume") ?: 0.5
                        setAudioVolume(volume)
                        result.success(true)
                    }

                    // ── Notifications Push & Alertes Locales ──
                    "showMatchAlert" -> {
                        val title = call.argument<String>("title") ?: "Coup d'envoi imminent !"
                        val body = call.argument<String>("body") ?: "Le match va commencer dans 15 minutes."
                        showCustomNotification(
                            DownloadForegroundService.CHANNEL_MATCHES,
                            title,
                            body,
                            9001
                        )
                        result.success(true)
                    }

                    "showReleaseAlert" -> {
                        val title = call.argument<String>("title") ?: "Nouveau contenu disponible"
                        val body = call.argument<String>("body") ?: "Un nouvel épisode est en ligne sur CHILLERS."
                        showCustomNotification(
                            DownloadForegroundService.CHANNEL_RELEASES,
                            title,
                            body,
                            10001
                        )
                        result.success(true)
                    }

                    else -> result.notImplemented()
                }
            }
    }

    private fun showCustomNotification(channelId: String, title: String, body: String, notifId: Int) {
        DownloadForegroundService.createChannels(this)
        val builder = DownloadForegroundService.newBuilder(this, channelId)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_stat_chillers)
            .setAutoCancel(true)
            .setContentIntent(DownloadForegroundService.contentIntent(this))

        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(notifId, builder.build())
        } catch (_: Exception) {}
    }

    override fun onPictureInPictureModeChanged(
        isInPictureInPictureMode: Boolean,
        newConfig: Configuration
    ) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        channel?.invokeMethod("onPipModeChanged", isInPictureInPictureMode)
    }

    // ── Fonctions Picture-in-Picture ──

    private fun isPipSupported(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
        } else {
            false
        }
    }

    private fun isInPipMode(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            isInPictureInPictureMode
        } else {
            false
        }
    }

    private fun enterPipMode(numerator: Int, denominator: Int): Boolean {
        if (!isPipSupported()) return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val clampedNum = numerator.coerceIn(1, 100)
                val clampedDen = denominator.coerceIn(1, 100)
                val ratio = Rational(clampedNum, clampedDen)
                val params = PictureInPictureParams.Builder()
                    .setAspectRatio(ratio)
                    .build()
                enterPictureInPictureMode(params)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                @Suppress("DEPRECATION")
                enterPictureInPictureMode()
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    // ── Gestion de la Luminosité ──

    private fun setScreenBrightness(brightness: Double) {
        runOnUiThread {
            try {
                val lp = window.attributes
                lp.screenBrightness = if (brightness < 0.0) {
                    WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE
                } else {
                    brightness.toFloat().coerceIn(0.01f, 1.0f)
                }
                window.attributes = lp
            } catch (_: Exception) {}
        }
    }

    private fun getScreenBrightness(): Double {
        return try {
            val brightness = window.attributes.screenBrightness
            if (brightness < 0f) -1.0 else brightness.toDouble()
        } catch (_: Exception) {
            -1.0
        }
    }

    // ── Gestion du Volume Audio ──

    private fun setAudioVolume(volume: Double) {
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val target = (volume.coerceIn(0.0, 1.0) * max).toInt()
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
        } catch (_: Exception) {}
    }

    private fun getAudioVolume(): Double {
        return try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            if (max > 0) current.toDouble() / max.toDouble() else 0.5
        } catch (_: Exception) {
            0.5
        }
    }

    // ── Service de premier plan ──

    private fun startDownloadService(title: String, progress: Int) {
        val intent = Intent(this, DownloadForegroundService::class.java).apply {
            putExtra(DownloadForegroundService.EXTRA_TITLE, title)
            putExtra(DownloadForegroundService.EXTRA_PROGRESS, progress)
        }
        // startForegroundService impose au service d'appeler startForeground() en
        // moins de 5 s : onStartCommand le fait immédiatement, c'est donc sûr.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    // ── Notifications ──

    private fun notifyCompleted(title: String, uri: String?) {
        DownloadForegroundService.createChannels(this)

        val builder = DownloadForegroundService.newBuilder(this, DownloadForegroundService.CHANNEL_DONE)
        builder.setContentTitle("Téléchargement terminé")
            .setContentText(title)
            .setSmallIcon(R.drawable.ic_stat_chillers)
            .setAutoCancel(true)

        // Si le fichier a été publié dans Téléchargements, le tap ouvre le lecteur
        // vidéo du système ; sinon on se contente d'ouvrir l'application.
        if (uri != null) {
            val view = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(uri), "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            builder.setContentIntent(PendingIntent.getActivity(this, 1, view, flags))
        } else {
            DownloadForegroundService.contentIntent(this)?.let { builder.setContentIntent(it) }
        }

        try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.notify(DownloadForegroundService.NOTIF_DONE_ID, builder.build())
        } catch (_: Exception) {
            // POST_NOTIFICATIONS refusée : la notification est simplement ignorée.
        }
    }

    private fun ensureNotificationPermission(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            result.success(true)
            return
        }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            result.success(true)
            return
        }
        if (pendingPermissionResult != null) {
            result.success(false)
            return
        }
        pendingPermissionResult = result
        requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            pendingPermissionResult?.success(granted)
            pendingPermissionResult = null
        }
    }

    // ── Publication dans le dossier Téléchargements public ──

    /**
     * Copie un fichier du stockage privé de l'app vers le dossier Téléchargements
     * public, afin qu'il soit visible par VLC, l'explorateur de fichiers, etc.
     *
     * @return l'URI de contenu du fichier publié (API 29+), son chemin absolu
     *         (API 24-28), ou null en cas d'échec.
     */
    private fun publishToDownloads(sourcePath: String, displayName: String): String? {
        val source = File(sourcePath)
        if (!source.exists()) return null

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4")
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_DOWNLOADS}/$PUBLIC_SUBDIR"
                )
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }

            val resolver = contentResolver
            val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
            val uri = resolver.insert(collection, values) ?: return null

            try {
                resolver.openOutputStream(uri)?.use { output ->
                    source.inputStream().use { input -> input.copyTo(output) }
                } ?: run {
                    resolver.delete(uri, null, null)
                    return null
                }

                // IS_PENDING=0 rend le fichier visible des autres applications.
                val done = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
                resolver.update(uri, done, null, null)
                uri.toString()
            } catch (_: Exception) {
                resolver.delete(uri, null, null)
                null
            }
        } else {
            @Suppress("DEPRECATION")
            val downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val dir = File(downloads, PUBLIC_SUBDIR)
            if (!dir.exists() && !dir.mkdirs()) return null
            val dest = File(dir, displayName)
            try {
                source.inputStream().use { input ->
                    dest.outputStream().use { output -> input.copyTo(output) }
                }
                dest.absolutePath
            } catch (_: Exception) {
                null
            }
        }
    }

    /** Supprime un fichier publié dans Téléchargements (URI MediaStore ou chemin absolu). */
    private fun deletePublished(uriString: String): Boolean {
        return try {
            if (uriString.startsWith("content://")) {
                contentResolver.delete(Uri.parse(uriString), null, null) > 0
            } else {
                val file = File(uriString)
                file.exists() && file.delete()
            }
        } catch (_: Exception) {
            false
        }
    }

    private fun openUri(uriString: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(uriString), "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun freeSpaceBytes(): Long {
        return try {
            StatFs(Environment.getDataDirectory().path).availableBytes
        } catch (_: Exception) {
            -1L
        }
    }

    // ── Wi-Fi Multicast Lock (Découverte DLNA / Smart TV) ──

    private fun acquireMulticastLock() {
        try {
            val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            if (multicastLock == null) {
                multicastLock = wifi?.createMulticastLock("chillers_ssdp_lock")?.apply {
                    setReferenceCounted(true)
                }
            }
            multicastLock?.acquire()
        } catch (_: Exception) {}
    }

    private fun releaseMulticastLock() {
        try {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        } catch (_: Exception) {}
    }

    private fun openExternalCaster(videoUrl: String, title: String): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(videoUrl), "video/*")
                putExtra("title", title)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, "Diffuser sur la Smart TV")
            startActivity(chooser)
            true
        } catch (_: Exception) {
            false
        }
    }

    companion object {
        private const val CHANNEL = "chillers/downloads"
        private const val REQUEST_NOTIFICATIONS = 8801
        private const val PUBLIC_SUBDIR = "CHILLERS"
    }
}
