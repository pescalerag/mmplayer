package expo.modules.nativeaudioscanner

import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.zip.CRC32
import java.util.zip.ZipEntry

class MusicZipTest {
    @Test fun folderUsesZipNameAndKeepsUnicode() {
        assertEquals("Álbum 01", MusicZipPaths.folder("Álbum 01.ZIP"))
        assertEquals("ZIP", MusicZipPaths.folder("...zip"))
        assertFalse(MusicZipPaths.folder("bad:name?.zip").contains(':'))
    }

    @Test fun preservesSubfoldersAndSelectsOnlyAudio() {
        assertEquals(listOf("Disc 1", "01. Song.FLAC"), MusicZipPaths.entry("Disc 1\\01. Song.FLAC"))
        assertTrue(MusicZipPaths.isAudio(MusicZipPaths.entry("Disc 1/01. Song.FLAC")))
        for (name in listOf("cover.jpg", "notes.txt", "video.mp4", "nested.zip", "__MACOSX/._song.mp3", ".hidden/song.mp3")) {
            assertFalse(name, MusicZipPaths.isAudio(MusicZipPaths.entry(name)))
        }
        assertEquals("Song (2).mp3", MusicZipPaths.numbered("Song.mp3", 2))
    }

    @Test fun rejectsTraversalAbsolutePathsAndControlCharacters() {
        for (name in listOf("../song.mp3", "disc/../../song.mp3", "/song.mp3", "C:\\song.mp3", "disc/./song.mp3", "song\u0000.mp3")) {
            try { MusicZipPaths.entry(name); fail(name) } catch (_: IOException) { }
        }
    }

    private fun entry(bytes: ByteArray) = ZipEntry("song.flac").apply {
        size = bytes.size.toLong()
        crc = CRC32().apply { update(bytes) }.value
    }

    @Test fun copiesLargeEntriesThroughBoundedBuffersAndChecksCrc() {
        val bytes = ByteArray(2 * 1024 * 1024 + 17) { (it % 251).toByte() }
        val source = object : ByteArrayInputStream(bytes) {
            override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
                assertTrue(length <= 64 * 1024)
                return super.read(buffer, offset, length)
            }
        }
        val output = ByteArrayOutputStream()
        MusicZipCopy.copyChecked(source, output, entry(bytes))
        assertArrayEquals(bytes, output.toByteArray())
    }

    @Test fun rejectsWrongCrcAndTruncatedOrOversizedStreams() {
        val bytes = "music".toByteArray()
        val invalid = listOf(entry(bytes).apply { crc += 1 }, entry(bytes).apply { size += 1 }, entry(bytes).apply { size -= 1 })
        for (metadata in invalid) {
            try { MusicZipCopy.copyChecked(ByteArrayInputStream(bytes), ByteArrayOutputStream(), metadata); fail() }
            catch (_: IOException) { }
        }
    }
}
