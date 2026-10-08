package expo.modules.nativeaudioscanner

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.Locale

data class ReplayGainTags(var gain: Double? = null, var peak: Double? = null) {
    fun accept(key: String, value: String) {
        val number = value.trim().replace(Regex("(?i)\\s*dB$"), "").trim().trimEnd('\u0000')
            .toDoubleOrNull()?.takeIf { it.isFinite() } ?: return
        when (key.trim().uppercase(Locale.ROOT)) {
            "REPLAYGAIN_TRACK_GAIN" -> gain = number
            "REPLAYGAIN_TRACK_PEAK" -> if (number > 0) peak = number
            "REPLAYGAIN_ALBUM_GAIN" -> if (gain == null) gain = number
            "REPLAYGAIN_ALBUM_PEAK" -> if (peak == null && number > 0) peak = number
        }
    }
}

/** Reads stored tags; it does not estimate loudness or peaks from decoded audio. */
object ReplayGainReader {
    private const val MAX_METADATA = 32 * 1024 * 1024
    fun readReplayGain(filePath: String): Double? = readTags(filePath).gain

    fun readTags(filePath: String): ReplayGainTags {
        val tags = ReplayGainTags()
        try {
            RandomAccessFile(File(filePath), "r").use { file ->
                val magic = ByteArray(4)
                file.readFully(magic)
                when {
                    String(magic, 0, 3, Charsets.US_ASCII) == "ID3" -> readId3(file, tags)
                    String(magic, Charsets.US_ASCII) == "fLaC" -> readFlac(file, tags)
                    String(magic, Charsets.US_ASCII) == "OggS" -> readOgg(file, tags)
                    else -> readMp4(file, 0, file.length(), tags, 0)
                }
            }
        } catch (_: Exception) { /* Missing or malformed metadata is optional. */ }
        return tags
    }

    // iTunes freeform atoms: moov/udta/meta/ilst/----/{mean,name,data}.
    // Walk bounded atom ranges, skipping mdat so large audio payloads are never read.
    private fun readMp4(file: RandomAccessFile, start: Long, end: Long, tags: ReplayGainTags, depth: Int) {
        if (depth > 8) return
        var position = start
        while (position <= end - 8) {
            file.seek(position)
            var size = file.readInt().toLong() and 0xffffffffL
            val type = ByteArray(4).also(file::readFully).toString(Charsets.ISO_8859_1)
            var headerSize = 8L
            if (size == 1L) {
                if (position > end - 16) return
                size = file.readLong()
                headerSize = 16L
            } else if (size == 0L) size = end - position
            if (size < headerSize || size > end - position) return
            val body = position + headerSize
            val atomEnd = position + size
            when (type) {
                "moov", "udta", "ilst" -> readMp4(file, body, atomEnd, tags, depth + 1)
                "meta" -> if (atomEnd - body >= 4) readMp4(file, body + 4, atomEnd, tags, depth + 1)
                "----" -> readMp4Freeform(file, body, atomEnd, tags)
            }
            position = atomEnd
        }
    }

    private fun readMp4Freeform(file: RandomAccessFile, start: Long, end: Long, tags: ReplayGainTags) {
        var position = start
        var domain: String? = null
        var name: String? = null
        var value: String? = null
        while (position <= end - 8) {
            file.seek(position)
            val size = file.readInt().toLong() and 0xffffffffL
            val type = ByteArray(4).also(file::readFully).toString(Charsets.ISO_8859_1)
            if (size < 8 || size > end - position) return
            val skip = if (type == "data") 8 else 4 // data type + locale, or full-box flags
            val length = size - 8 - skip
            if (type in listOf("mean", "name", "data") && length in 0..MAX_METADATA.toLong()) {
                file.seek(position + 8 + skip)
                val text = ByteArray(length.toInt()).also(file::readFully).toString(Charsets.UTF_8).trimEnd('\u0000')
                when (type) { "mean" -> domain = text; "name" -> name = text; "data" -> value = text }
            }
            position += size
        }
        if (domain == "com.apple.iTunes" && name != null && value != null) tags.accept(name, value)
    }

    private fun synchsafe(bytes: ByteArray, offset: Int): Int =
        ((bytes[offset].toInt() and 127) shl 21) or ((bytes[offset + 1].toInt() and 127) shl 14) or
            ((bytes[offset + 2].toInt() and 127) shl 7) or (bytes[offset + 3].toInt() and 127)

    private fun deUnsync(bytes: ByteArray): ByteArray {
        val output = ByteArrayOutputStream()
        var i = 0
        while (i < bytes.size) {
            val value = bytes[i++]
            output.write(value.toInt())
            if (value == 0xff.toByte() && i < bytes.size && bytes[i] == 0.toByte()) i++
        }
        return output.toByteArray()
    }

    private fun readId3(file: RandomAccessFile, tags: ReplayGainTags) {
        file.seek(0)
        val header = ByteArray(10).also(file::readFully)
        val version = header[3].toInt()
        if (version != 3 && version != 4) return
        val size = synchsafe(header, 6)
        if (size !in 1..MAX_METADATA || size > file.length() - 10) return
        var bytes = ByteArray(size).also(file::readFully)
        if (version == 3 && header[5].toInt() and 128 != 0) bytes = deUnsync(bytes)
        val data = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)
        if (header[5].toInt() and 64 != 0) {
            val extendedSize = if (version == 4) synchsafe(bytes, 0) else data.getInt(0) + 4
            if (extendedSize !in 4..bytes.size) return
            data.position(extendedSize)
        }
        while (data.remaining() >= 10) {
            val id = ByteArray(4).also(data::get).toString(Charsets.US_ASCII)
            val length = if (version == 4) synchsafe(bytes, data.position()).also { data.position(data.position() + 4) } else data.int
            data.get() // status flags
            val flags = data.get().toInt() and 255
            if (length <= 0 || length > data.remaining()) break
            if (id != "TXXX" || (version == 3 && flags and 0xe0 != 0) || (version == 4 && flags and 0x4d != 0)) {
                data.position(data.position() + length)
                continue
            }
            var body = ByteArray(length).also(data::get)
            if (version == 4 && (flags and 2 != 0 || header[5].toInt() and 128 != 0)) body = deUnsync(body)
            val encoding = body[0].toInt()
            val wide = encoding == 1 || encoding == 2
            var end = 1
            while (end < body.size && !(body[end] == 0.toByte() && (!wide || end + 1 < body.size && body[end + 1] == 0.toByte()))) end += if (wide) 2 else 1
            val start = end + if (wide) 2 else 1
            if (start >= body.size) continue
            val charset = when (encoding) { 1 -> Charsets.UTF_16; 2 -> Charsets.UTF_16BE; 3 -> Charsets.UTF_8; else -> Charsets.ISO_8859_1 }
            tags.accept(String(body, 1, end - 1, charset), String(body, start, body.size - start, charset).trimEnd('\u0000'))
        }
    }

    private fun readFlac(file: RandomAccessFile, tags: ReplayGainTags) {
        file.seek(4)
        while (file.filePointer + 4 <= file.length()) {
            val header = file.readUnsignedByte()
            val length = (file.readUnsignedByte() shl 16) or (file.readUnsignedByte() shl 8) or file.readUnsignedByte()
            if (length > file.length() - file.filePointer) return
            if (header and 127 == 4) readComments(ByteArray(length).also(file::readFully), tags)
            else file.seek(file.filePointer + length)
            if (header and 128 != 0) return
        }
    }

    private fun readComments(bytes: ByteArray, tags: ReplayGainTags) {
        val data = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        if (data.remaining() < 4) return
        val vendorSize = data.int
        if (vendorSize < 0 || vendorSize > data.remaining() - 4) return
        data.position(data.position() + vendorSize)
        val count = data.int
        if (count < 0) return
        repeat(count.coerceAtMost(bytes.size / 4)) {
            if (data.remaining() < 4) return
            val size = data.int
            if (size < 0 || size > data.remaining()) return
            val comment = ByteArray(size).also(data::get).toString(Charsets.UTF_8)
            val separator = comment.indexOf('=')
            if (separator > 0) tags.accept(comment.substring(0, separator), comment.substring(separator + 1))
        }
    }

    private fun readOgg(file: RandomAccessFile, tags: ReplayGainTags) {
        file.seek(0)
        val packet = ByteArrayOutputStream()
        var serial: Int? = null
        while (file.filePointer < minOf(file.length(), MAX_METADATA.toLong())) {
            val header = ByteArray(27).also(file::readFully)
            if (String(header, 0, 4, Charsets.US_ASCII) != "OggS") return
            val pageSerial = ByteBuffer.wrap(header, 14, 4).order(ByteOrder.LITTLE_ENDIAN).int
            if (serial == null) serial = pageSerial
            val lacing = ByteArray(header[26].toInt() and 255).also(file::readFully)
            for (lace in lacing) {
                val segment = ByteArray(lace.toInt() and 255).also(file::readFully)
                if (pageSerial != serial) continue
                packet.write(segment)
                if (packet.size() > MAX_METADATA) return
                if (segment.size < 255) {
                    val bytes = packet.toByteArray()
                    val prefix = bytes.take(8).toByteArray().toString(Charsets.US_ASCII)
                    val offset = when { prefix == "OpusTags" -> 8; prefix.startsWith("\u0003vorbis") -> 7; else -> 0 }
                    if (offset > 0) { readComments(bytes.copyOfRange(offset, bytes.size), tags); return }
                    packet.reset()
                }
            }
        }
    }
}
