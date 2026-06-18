package expo.modules.nativeaudioscanner

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

object ReplayGainReader {
    fun readReplayGain(filePath: String): Double? {
        val file = File(filePath)
        if (!file.exists()) return null
        
        try {
            RandomAccessFile(file, "r").use { raf ->
                // Check format by reading magic bytes
                val magic = ByteArray(4)
                raf.readFully(magic)
                
                if (magic[0] == 'I'.toByte() && magic[1] == 'D'.toByte() && magic[2] == '3'.toByte()) {
                    // MP3 ID3v2
                    return readMp3ReplayGain(raf)
                } else if (magic[0] == 'f'.toByte() && magic[1] == 'L'.toByte() && magic[2] == 'a'.toByte() && magic[3] == 'C'.toByte()) {
                    // FLAC
                    return readFlacReplayGain(raf)
                } else if (magic[0] == 'O'.toByte() && magic[1] == 'g'.toByte() && magic[2] == 'g'.toByte() && magic[3] == 'S'.toByte()) {
                    // OGG Container (Opus / Vorbis)
                    return readOggReplayGain(raf)
                }
            }
        } catch (e: Exception) {
            // Log or ignore
        }
        return null
    }

    private fun readMp3ReplayGain(raf: RandomAccessFile): Double? {
        // ID3 header is 10 bytes: "ID3" (3) + version (2) + flags (1) + size (4)
        // We already read 4 bytes ("ID3" + version major)
        raf.seek(3)
        val majorVersion = raf.read()
        val minorVersion = raf.read()
        val flags = raf.read()
        
        val sizeBytes = ByteArray(4)
        raf.readFully(sizeBytes)
        
        // Size is synchsafe (4 bytes, 7 bits per byte)
        val id3Size = ((sizeBytes[0].toInt() and 0x7F) shl 21) or
                      ((sizeBytes[1].toInt() and 0x7F) shl 14) or
                      ((sizeBytes[2].toInt() and 0x7F) shl 7) or
                      (sizeBytes[3].toInt() and 0x7F)
                      
        var position = 10
        val endPosition = 10 + id3Size
        
        // Only support ID3v2.3 and ID3v2.4 for TXXX
        if (majorVersion != 3 && majorVersion != 4) return null
        
        while (position < endPosition) {
            // Frame header: 10 bytes (ID: 4, Size: 4, Flags: 2)
            if (position + 10 > endPosition) break
            raf.seek(position.toLong())
            
            val frameIdBytes = ByteArray(4)
            raf.readFully(frameIdBytes)
            val frameId = String(frameIdBytes, Charsets.US_ASCII)
            
            val frameSizeBytes = ByteArray(4)
            raf.readFully(frameSizeBytes)
            
            val frameSize = if (majorVersion == 4) {
                // ID3v2.4 uses synchsafe integers for frame size
                ((frameSizeBytes[0].toInt() and 0x7F) shl 21) or
                ((frameSizeBytes[1].toInt() and 0x7F) shl 14) or
                ((frameSizeBytes[2].toInt() and 0x7F) shl 7) or
                (frameSizeBytes[3].toInt() and 0x7F)
            } else {
                // ID3v2.3 uses regular 32-bit int
                ((frameSizeBytes[0].toInt() and 0xFF) shl 24) or
                ((frameSizeBytes[1].toInt() and 0xFF) shl 16) or
                ((frameSizeBytes[2].toInt() and 0xFF) shl 8) or
                (frameSizeBytes[3].toInt() and 0xFF)
            }
            
            val flags1 = raf.read()
            val flags2 = raf.read()
            
            position += 10
            if (frameSize <= 0 || position + frameSize > endPosition) break
            
            if (frameId == "TXXX") {
                // Read TXXX body
                val body = ByteArray(frameSize)
                raf.readFully(body)
                
                val gain = parseTxxxReplayGain(body)
                if (gain != null) return gain
            }
            
            position += frameSize
        }
        return null
    }

    private fun parseTxxxReplayGain(body: ByteArray): Double? {
        if (body.isEmpty()) return null
        val encoding = body[0].toInt()
        
        // Find the description string (terminated by null)
        val descriptionEnd = findNullTerminator(body, 1, encoding)
        if (descriptionEnd == -1) return null
        
        val descBytes = body.copyOfRange(1, descriptionEnd)
        val description = decodeString(descBytes, encoding)
        
        if (description.equals("replaygain_track_gain", ignoreCase = true)) {
            val valueStart = descriptionEnd + (if (encoding == 1 || encoding == 2) 2 else 1)
            if (valueStart < body.size) {
                val valueBytes = body.copyOfRange(valueStart, body.size)
                val valueStr = decodeString(valueBytes, encoding).trim()
                return parseGainString(valueStr)
            }
        }
        return null
    }

    private fun findNullTerminator(body: ByteArray, start: Int, encoding: Int): Int {
        var i = start
        if (encoding == 1 || encoding == 2) {
            // UTF-16 (2 bytes null terminator)
            while (i < body.size - 1) {
                if (body[i] == 0.toByte() && body[i+1] == 0.toByte()) {
                    return i
                }
                i += 2
            }
        } else {
            // Latin-1 / UTF-8 (1 byte null terminator)
            while (i < body.size) {
                if (body[i] == 0.toByte()) {
                    return i
                }
                i++
            }
        }
        return -1
    }

    private fun decodeString(bytes: ByteArray, encoding: Int): String {
        return when (encoding) {
            1 -> {
                // UTF-16 with BOM
                String(bytes, Charsets.UTF_16)
            }
            2 -> {
                // UTF-16BE without BOM
                String(bytes, Charsets.UTF_16BE)
            }
            3 -> {
                // UTF-8
                String(bytes, Charsets.UTF_8)
            }
            else -> {
                // Latin-1 (ISO-8859-1)
                String(bytes, Charsets.ISO_8859_1)
            }
        }
    }

    private fun readFlacReplayGain(raf: RandomAccessFile): Double? {
        // We already read 4 bytes ("fLaC"). Now we parse metadata blocks.
        raf.seek(4)
        
        var isLastBlock = false
        while (!isLastBlock) {
            val header = raf.read()
            if (header == -1) break
            
            isLastBlock = (header and 0x80) != 0
            val blockType = header and 0x7F
            
            // Read 24-bit length
            val length = (raf.read() shl 16) or (raf.read() shl 8) or raf.read()
            
            val startPos = raf.filePointer
            
            if (blockType == 4) {
                // VORBIS_COMMENT block
                val blockBytes = ByteArray(length)
                raf.readFully(blockBytes)
                
                val gain = parseVorbisCommentReplayGain(blockBytes)
                if (gain != null) return gain
            } else {
                // Skip block
                raf.seek(startPos + length)
            }
        }
        return null
    }

    private fun parseVorbisCommentReplayGain(bytes: ByteArray): Double? {
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        if (bytes.size < 4) return null
        
        // 1. Vendor string length
        val vendorLength = buffer.int
        if (bytes.size < 4 + vendorLength + 4) return null
        
        // Skip vendor string
        buffer.position(buffer.position() + vendorLength)
        
        // 2. User comment list length
        val userCommentListLength = buffer.int
        
        for (i in 0 until userCommentListLength) {
            if (buffer.remaining() < 4) break
            val commentLength = buffer.int
            if (buffer.remaining() < commentLength) break
            
            val commentBytes = ByteArray(commentLength)
            buffer.get(commentBytes)
            val comment = String(commentBytes, Charsets.UTF_8)
            
            val parts = comment.split('=', limit = 2)
            if (parts.size == 2) {
                val key = parts[0].trim()
                val value = parts[1].trim()
                if (key.equals("REPLAYGAIN_TRACK_GAIN", ignoreCase = true)) {
                    return parseGainString(value)
                }
            }
        }
        return null
    }

    private fun readOggReplayGain(raf: RandomAccessFile): Double? {
        raf.seek(0)
        
        // Search for the Vorbis comments in the first few pages.
        // We read up to 64KB, which usually contains headers for both Opus and Vorbis.
        val maxHeaderSearch = 65536
        val fileLength = raf.length()
        val searchLimit = Math.min(fileLength, maxHeaderSearch.toLong()).toInt()
        
        val buffer = ByteArray(searchLimit)
        raf.readFully(buffer)
        
        // Search for OpusTags first
        val opusTagsIndex = indexOf(buffer, "OpusTags".toByteArray(Charsets.US_ASCII))
        if (opusTagsIndex != -1) {
            // Opus comment header starts with "OpusTags" (8 bytes)
            // Followed directly by the Vorbis comment structure
            val vorbisCommentStart = opusTagsIndex + 8
            val vorbisCommentBytes = buffer.copyOfRange(vorbisCommentStart, buffer.size)
            return parseVorbisCommentReplayGain(vorbisCommentBytes)
        }
        
        // Search for vorbis comment block which starts with byte 0x03 followed by "vorbis"
        val vorbisPattern = byteArrayOf(0x03, 'v'.toByte(), 'o'.toByte(), 'r'.toByte(), 'b'.toByte(), 'i'.toByte(), 's'.toByte())
        val vorbisIndex = indexOf(buffer, vorbisPattern)
        if (vorbisIndex != -1) {
            // Vorbis comment header starts with 0x03 + "vorbis" (7 bytes)
            // Followed by Vorbis comment structure
            val vorbisCommentStart = vorbisIndex + 7
            val vorbisCommentBytes = buffer.copyOfRange(vorbisCommentStart, buffer.size)
            return parseVorbisCommentReplayGain(vorbisCommentBytes)
        }
        
        return null
    }

    private fun indexOf(outer: ByteArray, target: ByteArray): Int {
        for (i in 0..outer.size - target.size) {
            var found = true
            for (j in target.indices) {
                if (outer[i + j] != target[j]) {
                    found = false
                    break
                }
            }
            if (found) return i
        }
        return -1
    }

    private fun parseGainString(value: String): Double? {
        val cleaned = value.replace("dB", "", ignoreCase = true).trim()
        return cleaned.toDoubleOrNull()
    }
}
