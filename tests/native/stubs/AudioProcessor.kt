package androidx.media3.common.audio
import java.nio.ByteBuffer
interface AudioProcessor {
    class AudioFormat(val encoding: Int)
    class UnhandledAudioFormatException(format: AudioFormat) : Exception()
}
abstract class BaseAudioProcessor {
    private lateinit var output: ByteBuffer
    protected fun replaceOutputBuffer(size: Int): ByteBuffer = ByteBuffer.allocate(size).also { output = it }
    fun getOutput(): ByteBuffer = output
    protected abstract fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat
    abstract fun queueInput(inputBuffer: ByteBuffer)
}
