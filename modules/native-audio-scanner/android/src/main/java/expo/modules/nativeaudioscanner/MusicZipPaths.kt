package expo.modules.nativeaudioscanner

import java.io.IOException
import java.util.Locale

internal object MusicZipPaths {
    private val audioExtensions = setOf("mp3", "flac", "m4a", "aac", "ogg", "opus", "wav", "wma", "alac", "aiff", "aif", "mka", "mid", "midi")
    private val invalidCharacters = Regex("[\\x00-\\x1f<>:\"/\\\\|?*]")

    fun folder(displayName: String): String = clean(displayName.substringAfterLast('/').replace(Regex("(?i)\\.zip$"), ""), 100).trim('.').ifEmpty { "ZIP" }

    private fun clean(value: String, maximum: Int): String = invalidCharacters.replace(value, "_").trim().take(maximum).trim()

    /** Validate even ignored members before creating any public files. */
    fun entry(name: String): List<String> {
        val normalized = name.replace('\\', '/')
        if (normalized.startsWith('/') || Regex("^[a-zA-Z]:").containsMatchIn(normalized)) throw IOException("music_zip.unsafe_path")
        val parts = normalized.split('/').filter { it.isNotEmpty() }
        if (parts.any { it == "." || it == ".." || it.contains('\u0000') }) throw IOException("music_zip.unsafe_path")
        return parts.map { clean(it, 180).ifEmpty { throw IOException("music_zip.unsafe_path") } }
    }

    fun isAudio(parts: List<String>): Boolean = parts.isNotEmpty()
        && parts.none { it == "__MACOSX" || it.startsWith('.') }
        && parts.last().substringAfterLast('.', "").lowercase(Locale.ROOT) in audioExtensions

    fun numbered(name: String, number: Int): String {
        if (number == 1) return name
        val extension = name.substringAfterLast('.', "")
        return name.substringBeforeLast('.') + " ($number)." + extension
    }
}
