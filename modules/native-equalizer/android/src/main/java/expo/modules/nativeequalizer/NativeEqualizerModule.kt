package expo.modules.nativeequalizer

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
                Log.e(TAG, "Failed to get audioSessionId via reflection: ${e.message}")
                0
            }
        }

        fun initSharedVisualizer(audioSessionId: Int) {
            if (audioSessionId == 0) return
            if (sharedVisualizer != null && currentSessionId == audioSessionId) {
                Log.d(TAG, "sharedVisualizer already exists for sessionId=$audioSessionId, skipping creation")
                try {
                    if (sharedVisualizer?.enabled == false) {
                        sharedVisualizer?.enabled = true
                    }
                } catch (_: Exception) {}
                return
            }

            releaseSharedVisualizer()
            try {
                currentSessionId = audioSessionId
                sharedVisualizer = Visualizer(audioSessionId).apply {
                    captureSize = Visualizer.getCaptureSizeRange()[1]
                    enabled = true
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

        AsyncFunction("initialize") { audioSessionId: Int ->
            releaseEffects()
            val resolvedSessionId = if (audioSessionId == 0) {
                val extracted = getAudioSessionId(appContext)
                if (extracted != 0) extracted else audioSessionId
            } else {
                audioSessionId
            }

            equalizer = Equalizer(0, resolvedSessionId).apply {
                enabled = isEnabled
            }
            bassBoost = BassBoost(0, resolvedSessionId).apply {
                enabled = isEnabled
            }
            initSharedVisualizer(resolvedSessionId)
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
        }
    }

    private fun releaseEffects() {
        try { equalizer?.release() } catch (_: Exception) {}
        try { bassBoost?.release() } catch (_: Exception) {}
        equalizer = null
        bassBoost = null
    }
}
