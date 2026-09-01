package expo.modules.nativeaudioscanner

import android.app.ActivityManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import java.net.URL
import java.util.concurrent.Executors

class WidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_UPDATE_STATE = "com.pescalerag.mmplayer.ACTION_UPDATE_STATE"
        const val ACTION_PLAY_PAUSE = "com.pescalerag.mmplayer.ACTION_PLAY_PAUSE"
        const val ACTION_NEXT = "com.pescalerag.mmplayer.ACTION_NEXT"
        const val ACTION_PREV = "com.pescalerag.mmplayer.ACTION_PREV"

        private val executor = Executors.newSingleThreadExecutor()

        private fun getPrefs(context: Context) =
            context.getSharedPreferences("mmplayer_widget_prefs", Context.MODE_PRIVATE)

        fun isMusicServiceRunning(context: Context): Boolean {
            return try {
                val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                @Suppress("DEPRECATION")
                val services = manager.getRunningServices(100)
                services.any { it.service.className == "com.doublesymmetry.trackplayer.service.MusicService" }
            } catch (e: Exception) {
                false
            }
        }

        fun updateWidget(
            context: Context,
            title: String,
            artist: String,
            coverUri: String?,
            isPlaying: Boolean
        ) {
            val prefs = getPrefs(context)
            prefs.edit()
                .putString("title", title)
                .putString("artist", artist)
                .putString("coverUri", coverUri)
                .putBoolean("isPlaying", isPlaying)
                .apply()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, WidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)

            if (allWidgetIds.isEmpty()) return

            for (widgetId in allWidgetIds) {
                executor.execute {
                    try {
                        val views = RemoteViews(context.packageName, R.layout.widget_player)
                        views.setTextViewText(R.id.widget_title, title)
                        views.setTextViewText(R.id.widget_artist, artist)

                        val playPauseIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                        views.setImageViewResource(R.id.btn_play_pause, playPauseIcon)

                        setupButtonPendingIntents(context, views)

                        if (!coverUri.isNullOrEmpty()) {
                            val bitmap = loadBitmap(context, coverUri)
                            if (bitmap != null) {
                                val roundedBitmap = getRoundedCornerBitmap(bitmap, 20f)
                                views.setImageViewBitmap(R.id.widget_cover, roundedBitmap)

                                views.setImageViewBitmap(R.id.widget_bg_image, bitmap)
                                views.setViewVisibility(R.id.widget_bg_image, View.VISIBLE)
                                views.setViewVisibility(R.id.widget_bg_overlay, View.VISIBLE)
                            } else {
                                views.setImageViewResource(R.id.widget_cover, R.drawable.ic_default_cover)
                                views.setViewVisibility(R.id.widget_bg_image, View.GONE)
                                views.setViewVisibility(R.id.widget_bg_overlay, View.GONE)
                            }
                        } else {
                            views.setImageViewResource(R.id.widget_cover, R.drawable.ic_default_cover)
                            views.setViewVisibility(R.id.widget_bg_image, View.GONE)
                            views.setViewVisibility(R.id.widget_bg_overlay, View.GONE)
                        }

                        appWidgetManager.updateAppWidget(widgetId, views)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        private fun setupButtonPendingIntents(context: Context, views: RemoteViews) {
            val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

            // Play / Pause -> Broadcast al Provider
            val playPauseIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_PLAY_PAUSE
            }
            val playPausePending = PendingIntent.getBroadcast(context, 10, playPauseIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.btn_play_pause, playPausePending)

            // Next -> Broadcast al Provider
            val nextIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_NEXT
            }
            val nextPending = PendingIntent.getBroadcast(context, 11, nextIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.btn_next, nextPending)

            // Previous -> Broadcast al Provider
            val prevIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_PREV
            }
            val prevPending = PendingIntent.getBroadcast(context, 12, prevIntent, pendingFlags)
            views.setOnClickPendingIntent(R.id.btn_prev, prevPending)

            // Clic en carátula / título / artista -> Abre la App normalmente
            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            if (openAppIntent != null) {
                val openAppPending = PendingIntent.getActivity(context, 13, openAppIntent, pendingFlags)
                views.setOnClickPendingIntent(R.id.widget_cover, openAppPending)
                views.setOnClickPendingIntent(R.id.widget_title, openAppPending)
                views.setOnClickPendingIntent(R.id.widget_artist, openAppPending)
            }
        }

        private fun loadBitmap(context: Context, uriString: String): Bitmap? {
            return try {
                if (uriString.startsWith("http://") || uriString.startsWith("https://")) {
                    val url = URL(uriString)
                    val connection = url.openConnection()
                    connection.connectTimeout = 3000
                    connection.readTimeout = 3000
                    connection.doInput = true
                    connection.getInputStream().use { inputStream ->
                        BitmapFactory.decodeStream(inputStream)
                    }
                } else {
                    val cleanUri = if (uriString.startsWith("file://")) uriString.substring(7) else uriString
                    if (cleanUri.startsWith("content://")) {
                        context.contentResolver.openInputStream(Uri.parse(cleanUri)).use { inputStream ->
                            BitmapFactory.decodeStream(inputStream)
                        }
                    } else {
                        BitmapFactory.decodeFile(cleanUri)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }

        private fun getRoundedCornerBitmap(bitmap: Bitmap, pixels: Float): Bitmap {
            val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(output)
            val color = -0xbdbdbe
            val paint = Paint()
            val rect = Rect(0, 0, bitmap.width, bitmap.height)
            val rectF = RectF(rect)

            val density = bitmap.width.toFloat() / 56f
            val roundPx = pixels * density

            paint.isAntiAlias = true
            canvas.drawARGB(0, 0, 0, 0)
            paint.color = color
            canvas.drawRoundRect(rectF, roundPx, roundPx, paint)
            paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
            canvas.drawBitmap(bitmap, rect, rect, paint)
            return output
        }

        fun launchAppWithAction(context: Context, action: String) {
            try {
                val deepLinkUri = Uri.parse("mmplayer://widget?action=$action")
                val intent = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
                    setPackage(context.packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                context.startActivity(intent)
            } catch (e: Exception) {
                e.printStackTrace()
                try {
                    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                    if (launchIntent != null) {
                        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        context.startActivity(launchIntent)
                    }
                } catch (err: Exception) {
                    err.printStackTrace()
                }
            }
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val prefs = getPrefs(context)
        val title = prefs.getString("title", "MMPlayer") ?: "MMPlayer"
        val artist = prefs.getString("artist", "No se está reproduciendo") ?: "No se está reproduciendo"
        val coverUri = prefs.getString("coverUri", null)
        val isPlaying = prefs.getBoolean("isPlaying", false)

        for (widgetId in appWidgetIds) {
            executor.execute {
                try {
                    val views = RemoteViews(context.packageName, R.layout.widget_player)
                    views.setTextViewText(R.id.widget_title, title)
                    views.setTextViewText(R.id.widget_artist, artist)

                    val playPauseIcon = if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
                    views.setImageViewResource(R.id.btn_play_pause, playPauseIcon)

                    setupButtonPendingIntents(context, views)

                    if (!coverUri.isNullOrEmpty()) {
                        val bitmap = loadBitmap(context, coverUri)
                        if (bitmap != null) {
                            val roundedBitmap = getRoundedCornerBitmap(bitmap, 20f)
                            views.setImageViewBitmap(R.id.widget_cover, roundedBitmap)

                            views.setImageViewBitmap(R.id.widget_bg_image, bitmap)
                            views.setViewVisibility(R.id.widget_bg_image, View.VISIBLE)
                            views.setViewVisibility(R.id.widget_bg_overlay, View.VISIBLE)
                        } else {
                            views.setImageViewResource(R.id.widget_cover, R.drawable.ic_default_cover)
                            views.setViewVisibility(R.id.widget_bg_image, View.GONE)
                            views.setViewVisibility(R.id.widget_bg_overlay, View.GONE)
                        }
                    } else {
                        views.setImageViewResource(R.id.widget_cover, R.drawable.ic_default_cover)
                        views.setViewVisibility(R.id.widget_bg_image, View.GONE)
                        views.setViewVisibility(R.id.widget_bg_overlay, View.GONE)
                    }

                    appWidgetManager.updateAppWidget(widgetId, views)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_UPDATE_STATE) {
            val title = intent.getStringExtra("title") ?: "MMPlayer"
            val artist = intent.getStringExtra("artist") ?: "No se está reproduciendo"
            val coverUri = intent.getStringExtra("coverUri")
            val isPlaying = intent.getBooleanExtra("isPlaying", false)
            updateWidget(context, title, artist, coverUri, isPlaying)
        } else if (intent.action == ACTION_PLAY_PAUSE || intent.action == ACTION_NEXT || intent.action == ACTION_PREV) {
            val pendingResult = goAsync()
            val appContext = context.applicationContext

            val prefs = getPrefs(appContext)
            val title = prefs.getString("title", "MMPlayer") ?: "MMPlayer"
            val artist = prefs.getString("artist", "No se está reproduciendo") ?: "No se está reproduciendo"
            val coverUri = prefs.getString("coverUri", null)

            val actionName = when (intent.action) {
                ACTION_PLAY_PAUSE -> "play"
                ACTION_NEXT -> "next"
                ACTION_PREV -> "prev"
                else -> "open"
            }

            if (!isMusicServiceRunning(appContext)) {
                // Si la app/servicio NO está en ejecución:
                // 1. Mostrar como pausado en el widget
                updateWidget(appContext, title, artist, coverUri, false)
                // 2. Abrir la app ejecutando la acción correspondiente de inmediato
                launchAppWithAction(appContext, actionName)
                pendingResult.finish()
                return
            }

            try {
                val sessionToken = SessionToken(appContext, ComponentName(appContext, "com.doublesymmetry.trackplayer.service.MusicService"))
                val controllerFuture = MediaController.Builder(appContext, sessionToken).buildAsync()

                controllerFuture.addListener(Runnable {
                    try {
                        val controller = controllerFuture.get()
                        if (controller != null && controller.isConnected) {
                            when (intent.action) {
                                ACTION_PLAY_PAUSE -> {
                                    if (controller.isPlaying) {
                                        controller.pause()
                                        updateWidget(appContext, title, artist, coverUri, false)
                                    } else {
                                        controller.play()
                                        updateWidget(appContext, title, artist, coverUri, true)
                                    }
                                }
                                ACTION_NEXT -> controller.seekToNextMediaItem()
                                ACTION_PREV -> controller.seekToPreviousMediaItem()
                            }
                            controller.release()
                        } else {
                            updateWidget(appContext, title, artist, coverUri, false)
                            launchAppWithAction(appContext, actionName)
                        }
                    } catch (e: Exception) {
                        updateWidget(appContext, title, artist, coverUri, false)
                        launchAppWithAction(appContext, actionName)
                    } finally {
                        pendingResult.finish()
                    }
                }, androidx.core.content.ContextCompat.getMainExecutor(appContext))

            } catch (e: Exception) {
                updateWidget(appContext, title, artist, coverUri, false)
                launchAppWithAction(appContext, actionName)
                pendingResult.finish()
            }
        }
    }
}
