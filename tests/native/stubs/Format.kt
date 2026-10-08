package androidx.media3.common
object C { const val ENCODING_PCM_16BIT = 2 }
class Format(val metadata: Metadata? = null)
class Metadata(vararg val entries: Any) {
    fun length() = entries.size
    operator fun get(index: Int) = entries[index]
}
