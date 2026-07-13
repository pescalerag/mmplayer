package expo.modules.nativeaudioscanner

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
        
        private var lastTitle = "MMPlayer"
        private var lastArtist = "No se está reproduciendo"
        private var lastCoverUri: String? = null
        private var lastIsPlaying = false
        
        private val executor = Executors.newSingleThreadExecutor()

        fun updateWidget(
            context: Context,
            title: String,
            artist: String,
            coverUri: String?,
            isPlaying: Boolean
        ) {
            lastTitle = title
            lastArtist = artist
            lastCoverUri = coverUri
            lastIsPlaying = isPlaying

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
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

            val playPauseIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_PLAY_PAUSE
            }
            val playPausePending = PendingIntent.getBroadcast(context, 10, playPauseIntent, flags)
            views.setOnClickPendingIntent(R.id.btn_play_pause, playPausePending)

            val nextIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_NEXT
            }
            val nextPending = PendingIntent.getBroadcast(context, 11, nextIntent, flags)
            views.setOnClickPendingIntent(R.id.btn_next, nextPending)

            val prevIntent = Intent(context, WidgetProvider::class.java).apply {
                action = ACTION_PREV
            }
            val prevPending = PendingIntent.getBroadcast(context, 12, prevIntent, flags)
            views.setOnClickPendingIntent(R.id.btn_prev, prevPending)

            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (openAppIntent != null) {
                openAppIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                val openAppPending = PendingIntent.getActivity(context, 13, openAppIntent, flags)
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
                        context.contentResolver.openInputStream(android.net.Uri.parse(cleanUri)).use { inputStream ->
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
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (widgetId in appWidgetIds) {
            executor.execute {
                try {
                    val views = RemoteViews(context.packageName, R.layout.widget_player)
                    views.setTextViewText(R.id.widget_title, lastTitle)
                    views.setTextViewText(R.id.widget_artist, lastArtist)
                    
                    val playPauseIcon = if (lastIsPlaying) R.drawable.ic_pause else R.drawable.ic_play
                    views.setImageViewResource(R.id.btn_play_pause, playPauseIcon)

                    setupButtonPendingIntents(context, views)

                    if (!lastCoverUri.isNullOrEmpty()) {
                        val bitmap = loadBitmap(context, lastCoverUri!!)
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

            try {
                val sessionToken = SessionToken(appContext, ComponentName(appContext, "com.doublesymmetry.trackplayer.service.MusicService"))
                val controllerFuture = androidx.media3.session.MediaController.Builder(appContext, sessionToken).buildAsync()

                // SOLUCIÓN 1: Usamos el MainExecutor para evitar la excepción de hilo cruzado de Media3
                controllerFuture.addListener(Runnable {
                    try {
                        val controller = controllerFuture.get()
                        when (intent.action) {
                            ACTION_PLAY_PAUSE -> {
                                if (controller.isPlaying) {
                                    controller.pause()
                                    updateWidget(appContext, lastTitle, lastArtist, lastCoverUri, false)
                                } else {
                                    controller.play()
                                    updateWidget(appContext, lastTitle, lastArtist, lastCoverUri, true)
                                }
                            }
                            ACTION_NEXT -> {
                                controller.seekToNextMediaItem()
                            }
                            ACTION_PREV -> {
                                controller.seekToPreviousMediaItem()
                            }
                        }
                        controller.release()
                    } catch (e: Exception) {
                        e.printStackTrace()
                        // SOLUCIÓN 2 (INFALIBLE): Si MediaController falla, usamos el AudioManager del sistema operativo
                        fallbackToAudioManager(appContext, intent.action)
                        
                        // Actualización optimista de UI local
                        if (intent.action == ACTION_PLAY_PAUSE) {
                            updateWidget(appContext, lastTitle, lastArtist, lastCoverUri, !lastIsPlaying)
                        }
                    } finally {
                        pendingResult.finish()
                    }
                }, androidx.core.content.ContextCompat.getMainExecutor(appContext))

            } catch (e: Exception) {
                e.printStackTrace()
                fallbackToAudioManager(appContext, intent.action)
                pendingResult.finish()
            }
        }
    }

    /**
     * Respaldo infalible: Emula una pulsación de auriculares físicos (Bluetooth/Cable) 
     * que el sistema operativo enviará directamente a React Native Track Player.
     */
    private fun fallbackToAudioManager(context: Context, action: String?) {
        try {
            val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
            val keyCode = when (action) {
                ACTION_PLAY_PAUSE -> android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
                ACTION_NEXT -> android.view.KeyEvent.KEYCODE_MEDIA_NEXT
                ACTION_PREV -> android.view.KeyEvent.KEYCODE_MEDIA_PREVIOUS
                else -> return
            }
            audioManager.dispatchMediaKeyEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, keyCode))
            audioManager.dispatchMediaKeyEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, keyCode))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
