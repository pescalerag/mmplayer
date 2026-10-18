package expo.modules.nativeaudioscanner

import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.zip.CRC32
import java.util.zip.ZipEntry

internal object MusicZipCopy {
    fun copyChecked(input: InputStream, output: OutputStream, entry: ZipEntry) {
        val crc = CRC32()
        var bytes = 0L
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            bytes += count
            if (bytes > entry.size) throw IOException("music_zip.invalid_archive")
            crc.update(buffer, 0, count); output.write(buffer, 0, count)
        }
        if (bytes != entry.size || crc.value != entry.crc) throw IOException("music_zip.invalid_archive")
    }
}
