package expo.modules.nativeequalizer

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeEqualizerModule : Module() {
    private var equalizer: Equalizer? = null
    private var bassBoost: BassBoost? = null
    private var isEnabled = false

    override fun definition() = ModuleDefinition {
        Name("NativeEqualizer")

        AsyncFunction("initialize") { audioSessionId: Int ->
            releaseEffects()
            equalizer = Equalizer(0, audioSessionId).apply {
                enabled = isEnabled
            }
            bassBoost = BassBoost(0, audioSessionId).apply {
                enabled = isEnabled
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
    }

    private fun releaseEffects() {
        try { equalizer?.release() } catch (_: Exception) {}
        try { bassBoost?.release() } catch (_: Exception) {}
        equalizer = null
        bassBoost = null
    }
}
