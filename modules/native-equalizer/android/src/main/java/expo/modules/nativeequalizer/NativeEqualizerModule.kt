package expo.modules.nativeequalizer

import android.graphics.BitmapFactory
import android.net.Uri
import androidx.palette.graphics.Palette
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Visualizer
import android.util.Log
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "NativeEqualizer"

class NativeEqualizerModule : Module() {
    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var isEnabled = false
    private var effectsSessionId = 0
    private val bandLevels = mutableMapOf<Int, Int>()
    private var bassStrength = 0

    private fun ensureEffects(requestedSessionId: Int = 0): Boolean {
        val sessionId = if (requestedSessionId > 0) requestedSessionId else getAudioSessionId(appContext)
        if (sessionId <= 0) {
            releaseEffects()
            return false
        }
        if (effectsSessionId == sessionId && equalizer?.hasControl() == true &&
            (bassBoost == null || bassBoost?.hasControl() == true)) return true
        releaseEffects()
        try {
            val eq = Equalizer(0, sessionId)
            equalizer = eq
            // Some devices support EQ but have no separate BassBoost engine.
            bassBoost = try { BassBoost(0, sessionId) } catch (error: Exception) {
                Log.w(TAG, "BassBoost unavailable for session $sessionId", error)
                null
            }
            val range = eq.bandLevelRange
            bandLevels.forEach { (band, level) ->
                if (band in 0 until eq.numberOfBands.toInt()) {
                    eq.setBandLevel(band.toShort(), level.coerceIn(range[0].toInt(), range[1].toInt()).toShort())
                }
            }
            bassBoost?.setStrength(bassStrength.toShort())
            eq.enabled = isEnabled
            bassBoost?.enabled = isEnabled
            effectsSessionId = sessionId
            return true
        } catch (error: Exception) {
            releaseEffects()
            Log.e(TAG, "Failed to attach audio effects to session $sessionId", error)
            throw error
        }
    }

    companion object {
        var sharedVisualizer: Visualizer? = null
            private set
        private var currentSessionId = -1

        fun getField(clazz: Class<*>, name: String): java.lang.reflect.Field {
            var current: Class<*>? = clazz
            while (current != null) {
                try {
                    return current.getDeclaredField(name).apply { isAccessible = true }
                } catch (_: NoSuchFieldException) {}
                current = current.superclass
            }
            throw NoSuchFieldException("Field '$name' not found in ${clazz.name} hierarchy")
        }

        fun getAudioSessionId(appContext: AppContext): Int {
            // Strategy 1: Direct static invocation from MusicService (fast, reliable, new architecture safe)
            try {
                val musicServiceClass = Class.forName("com.doublesymmetry.trackplayer.service.MusicService")
                val method = musicServiceClass.getMethod("getCurrentAudioSessionId")
                val sessionId = method.invoke(null) as? Int ?: 0
                if (sessionId != 0) {
                    return sessionId
                }
            } catch (t: Throwable) {
                Log.d(TAG, "MusicService.getCurrentAudioSessionId failed: ${t.message}")
            }

            // Strategy 2: MusicService.instance static field
            try {
                val musicServiceClass = Class.forName("com.doublesymmetry.trackplayer.service.MusicService")
                val instanceField = musicServiceClass.getDeclaredField("instance").apply { isAccessible = true }
                val serviceInstance = instanceField.get(null)
                if (serviceInstance != null) {
                    val playerField = serviceInstance.javaClass.getDeclaredField("player").apply { isAccessible = true }
                    val queuedAudioPlayer = playerField.get(serviceInstance)
                    if (queuedAudioPlayer != null) {
                        var currentClass: Class<*>? = queuedAudioPlayer.javaClass
                        while (currentClass != null) {
                            try {
                                val exoField = currentClass.getDeclaredField("exoPlayer").apply { isAccessible = true }
                                val exo = exoField.get(queuedAudioPlayer)
                                if (exo != null) {
                                    val sessionMethod = exo.javaClass.getMethod("getAudioSessionId")
                                    val id = sessionMethod.invoke(exo) as? Int ?: 0
                                    if (id != 0) return id
                                }
                                break
                            } catch (_: NoSuchFieldException) {
                                currentClass = currentClass.superclass
                            }
                        }
                    }
                }
            } catch (t: Throwable) {
                Log.d(TAG, "MusicService.instance reflection failed: ${t.message}")
            }

            // Strategy 3: Legacy ReactContext reflection (if not Bridgeless)
            return try {
                val reactContext = appContext.reactContext ?: return 0
                val trackPlayerClass = Class.forName("com.doublesymmetry.trackplayer.module.MusicModule")
                val getNativeModuleMethod = reactContext.javaClass.getMethod("getNativeModule", Class::class.java)
                val musicModule = getNativeModuleMethod.invoke(reactContext, trackPlayerClass) ?: return 0
                val musicService = getField(trackPlayerClass, "musicService").get(musicModule) ?: return 0
                val queuedAudioPlayer = getField(musicService.javaClass, "player").get(musicService) ?: return 0
                val exoPlayer = try {
                    getField(queuedAudioPlayer.javaClass, "exoPlayer").get(queuedAudioPlayer)
                } catch (_: Exception) {
                    val method = queuedAudioPlayer.javaClass.getMethod("getExoPlayer")
                    method.invoke(queuedAudioPlayer)
                } ?: return 0

                val audioSessionIdMethod = exoPlayer.javaClass.getMethod("getAudioSessionId")
                audioSessionIdMethod.invoke(exoPlayer) as? Int ?: 0
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get audioSessionId via legacy reflection: ${e.message}")
                0
            }
        }

        fun initSharedVisualizer(audioSessionId: Int) {
            if (audioSessionId == 0) return
            if (sharedVisualizer != null && currentSessionId == audioSessionId) {
                return
            }

            releaseSharedVisualizer()
            try {
                currentSessionId = audioSessionId
                sharedVisualizer = Visualizer(audioSessionId).apply {
                    captureSize = Visualizer.getCaptureSizeRange()[1]
                    Log.d(TAG, "sharedVisualizer created successfully for sessionId=$audioSessionId")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to create sharedVisualizer for sessionId=$audioSessionId: ${e.message}")
                sharedVisualizer = null
                currentSessionId = -1
            }
        }

        fun releaseSharedVisualizer() {
            try {
                sharedVisualizer?.let {
                    it.enabled = false
                    it.release()
                    Log.d(TAG, "sharedVisualizer released successfully")
                }
            } catch (_: Exception) {}
            sharedVisualizer = null
            currentSessionId = -1
        }
    }

    override fun definition() = ModuleDefinition {
        Name("NativeEqualizer")

        AsyncFunction("setReplayGainSettings") { enabled: Boolean, preamp: Double, fallback: Double ->
            require(preamp.isFinite() && fallback.isFinite()) { "Invalid ReplayGain settings" }
            val context = appContext.reactContext ?: throw IllegalStateException("React context unavailable")
            // Persist before resolving, including before the player's first decoded buffer.
            check(context.getSharedPreferences("mmplayer_replay_gain", android.content.Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", enabled).putFloat("preamp", preamp.toFloat())
                .putFloat("fallback", fallback.toFloat()).commit()) { "Could not persist ReplayGain settings" }
        }

        AsyncFunction("initialize") { audioSessionId: Int ->
            ensureEffects(audioSessionId)
            Unit
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setEnabled") { enabled: Boolean ->
            isEnabled = enabled
            ensureEffects()
            equalizer?.enabled = enabled
            bassBoost?.enabled = enabled
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setBandLevel") { band: Int, levelMb: Int ->
            bandLevels[band] = levelMb
            ensureEffects()
            val eq = equalizer ?: return@AsyncFunction
            val numBands = eq.numberOfBands.toInt()
            if (band < 0 || band >= numBands) return@AsyncFunction
            val range = eq.bandLevelRange
            val clamped = levelMb.coerceIn(range[0].toInt(), range[1].toInt())
            eq.setBandLevel(band.toShort(), clamped.toShort())
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("setBassBoost") { strength: Int ->
            bassStrength = strength.coerceIn(0, 1000)
            ensureEffects()
            bassBoost?.setStrength(bassStrength.toShort())
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getBandFrequencies") {
            if (!ensureEffects()) return@AsyncFunction emptyList<Double>()
            val eq = equalizer ?: return@AsyncFunction emptyList<Double>()
            val numBands = eq.numberOfBands.toInt()
            (0 until numBands).map { i ->
                eq.getCenterFreq(i.toShort()).toDouble() / 1000.0
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getBandLevelRange") {
            ensureEffects()
            val eq = equalizer
            if (eq == null) {
                mapOf("min" to -1500, "max" to 1500)
            } else {
                mapOf(
                    "min" to eq.bandLevelRange[0].toInt(),
                    "max" to eq.bandLevelRange[1].toInt()
                )
            }
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("getNumberOfBands") {
            if (ensureEffects()) equalizer?.numberOfBands?.toInt() ?: 0 else 0
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("release") {
            releaseEffects()
        }.runOnQueue(Queues.MAIN)

        AsyncFunction("extractColorFromImage") { url: String ->
            try {
                val uri = Uri.parse(url)
                // Read dimensions first, then decode a small bitmap for Palette.
                // Full-resolution album artwork can consume tens of MB otherwise.
                fun decode(options: BitmapFactory.Options): android.graphics.Bitmap? {
                    return if (uri.scheme == "content") {
                        appContext.reactContext?.contentResolver?.openInputStream(uri).use { stream ->
                            if (stream == null) null else BitmapFactory.decodeStream(stream, null, options)
                        }
                    } else {
                        val path = if (uri.scheme == "file") uri.path else url
                        BitmapFactory.decodeFile(path, options)
                    }
                }
                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                decode(bounds)
                val options = BitmapFactory.Options()
                while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 256) {
                    options.inSampleSize *= 2
                }
                val bitmap = decode(options)
                if (bitmap == null) null else {
                    try {
                        val color = Palette.from(bitmap).generate().dominantSwatch?.rgb
                        color?.let { String.format("#%06X", 0xFFFFFF and it) }
                    } finally {
                        bitmap.recycle()
                    }
                }
            } catch (e: Exception) {
                Log.e("NativeEqualizer", "Error in extractColorFromImage: ${e.message}", e)
                null
            }
        }

        View(NativeVisualizerView::class) {
            Prop("color") { view: NativeVisualizerView, color: String ->
                view.setColor(color)
            }
            Prop("type") { view: NativeVisualizerView, type: String ->
                view.setType(type)
            }
            Prop("active") { view: NativeVisualizerView, active: Boolean ->
                view.setActive(active)
            }
            Prop("coverColor") { view: NativeVisualizerView, coverColor: String? ->
                view.setCoverColor(coverColor)
            }
        }
    }

    private fun releaseEffects() {
        try { equalizer?.release() } catch (_: Exception) {}
        try { bassBoost?.release() } catch (_: Exception) {}
        equalizer = null
        bassBoost = null
        effectsSessionId = 0
    }
}
