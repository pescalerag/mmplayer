package expo.modules.nativeequalizer

import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import androidx.palette.graphics.Palette
import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Visualizer
import android.util.Log
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val TAG = "NativeEqualizer"

class NativeEqualizerModule : Module() {
    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var isEnabled = false

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
            releaseEffects()
            val resolvedSessionId = if (audioSessionId == 0) {
                val extracted = getAudioSessionId(appContext)
                if (extracted != 0) extracted else audioSessionId
            } else {
                audioSessionId
            }

            try {
                if (resolvedSessionId != 0) {
                    equalizer = Equalizer(0, resolvedSessionId).apply {
                        enabled = isEnabled
                    }
                    bassBoost = BassBoost(0, resolvedSessionId).apply {
                        enabled = isEnabled
                    }
                    initSharedVisualizer(resolvedSessionId)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to initialize Equalizer/BassBoost with sessionId $resolvedSessionId: ${e.message}")
            }
        }

        AsyncFunction("setEnabled") { enabled: Boolean ->
            isEnabled = enabled
            equalizer?.enabled = enabled
            bassBoost?.enabled = enabled
        }

        AsyncFunction("setBandLevel") { band: Int, levelMb: Int ->
            val eq = equalizer ?: return@AsyncFunction
            val numBands = eq.numberOfBands.toInt()
            if (band < 0 || band >= numBands) return@AsyncFunction
            val range = eq.bandLevelRange
            val clamped = levelMb.coerceIn(range[0].toInt(), range[1].toInt())
            eq.setBandLevel(band.toShort(), clamped.toShort())
        }

        AsyncFunction("setBassBoost") { strength: Int ->
            bassBoost?.setStrength(strength.toShort())
        }

        AsyncFunction("getBandFrequencies") {
            val eq = equalizer ?: return@AsyncFunction emptyList<Double>()
            val numBands = eq.numberOfBands.toInt()
            (0 until numBands).map { i ->
                eq.getCenterFreq(i.toShort()).toDouble() / 1000.0
            }
        }

        AsyncFunction("getBandLevelRange") {
            val eq = equalizer
            if (eq == null) {
                mapOf("min" to -1500, "max" to 1500)
            } else {
                mapOf(
                    "min" to eq.bandLevelRange[0].toInt(),
                    "max" to eq.bandLevelRange[1].toInt()
                )
            }
        }

        AsyncFunction("getNumberOfBands") {
            equalizer?.numberOfBands?.toInt() ?: 0
        }

        AsyncFunction("release") {
            releaseEffects()
        }

        AsyncFunction("extractColorFromImage") { url: String ->
            var resultColor = "#8B5CF6"
            try {
                val bitmap = if (url.startsWith("content://")) {
                    val uri = Uri.parse(url)
                    appContext.reactContext?.contentResolver?.openInputStream(uri).use { inputStream ->
                        BitmapFactory.decodeStream(inputStream)
                    }
                } else {
                    val cleanPath = url.removePrefix("file://")
                    BitmapFactory.decodeFile(cleanPath)
                }

                if (bitmap != null) {
                    val palette = Palette.from(bitmap).generate()
                    val extractedColor = palette.getDominantColor(Color.parseColor("#8B5CF6"))
                        ?: palette.getVibrantColor(Color.parseColor("#8B5CF6"))
                        ?: Color.parseColor("#8B5CF6")
                    
                    resultColor = String.format("#%06X", 0xFFFFFF and extractedColor)
                }
            } catch (e: Exception) {
                Log.e("NativeEqualizer", "Error in extractColorFromImage: ${e.message}", e)
            }
            resultColor
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
            Prop("coverUrl") { view: NativeVisualizerView, coverUrl: String? ->
                view.setCoverUrl(coverUrl)
            }
        }
    }

    private fun releaseEffects() {
        try { equalizer?.release() } catch (_: Exception) {}
        try { bassBoost?.release() } catch (_: Exception) {}
        equalizer = null
        bassBoost = null
    }
}
