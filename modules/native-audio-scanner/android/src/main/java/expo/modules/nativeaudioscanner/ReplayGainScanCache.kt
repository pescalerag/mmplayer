package expo.modules.nativeaudioscanner

import java.io.File

/** Cache tag reads, including absent tags, against the physical file rather than stale MediaStore dates. */
class ReplayGainScanCache(
    private val get: (String) -> String?,
    private val put: (String, String) -> Unit,
    private val reader: (String) -> ReplayGainTags = ReplayGainReader::readTags
) {
    companion object {
        // Bump when tag parsing changes. Existing entries will be reread once.
        private const val VERSION = "1"
    }

    fun read(file: File): ReplayGainTags {
        val path = file.absolutePath
        val modified = file.lastModified()
        val size = file.length()
        val cacheable = modified > 0 && size > 0 && file.isFile && file.canRead()
        if (cacheable) {
            val fields = get(path)?.split('|')
            if (fields?.size == 5 && fields[0] == VERSION &&
                fields[1].toLongOrNull() == modified && fields[2].toLongOrNull() == size) {
                val gain = fields[3].toDoubleOrNull()?.takeIf { it.isFinite() }
                val peak = fields[4].toDoubleOrNull()?.takeIf { it.isFinite() && it > 0 }
                if ((fields[3] == "null" || gain != null) && (fields[4] == "null" || peak != null)) {
                    return ReplayGainTags(gain, peak)
                }
            }
        }

        val tags = reader(path)
        // An interrupted read or a concurrent file edit must be retried next time.
        if (cacheable && tags.readSucceeded && file.lastModified() == modified && file.length() == size) {
            put(path, "$VERSION|$modified|$size|${tags.gain}|${tags.peak}")
        }
        return tags
    }
}
