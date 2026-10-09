import com.doublesymmetry.kotlinaudio.players.ReplayGainMath
import expo.modules.nativeaudioscanner.ReplayGainReader
import expo.modules.nativeaudioscanner.ReplayGainScanCache
import expo.modules.nativeaudioscanner.ReplayGainTags
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.file.Files
import kotlin.math.*

private var passed = 0
private fun test(name: String, body: () -> Unit) { body(); passed++; println("PASS: $name") }
private fun near(actual: Double?, expected: Double, tolerance: Double = 0.00001) {
    check(actual != null && abs(actual - expected) < tolerance) { "Expected $expected, got $actual" }
}
private fun integer(value: Int, little: Boolean = false) = ByteBuffer.allocate(4)
    .order(if (little) ByteOrder.LITTLE_ENDIAN else ByteOrder.BIG_ENDIAN).putInt(value).array()
private fun synchsafe(value: Int) = byteArrayOf((value shr 21 and 127).toByte(), (value shr 14 and 127).toByte(),
    (value shr 7 and 127).toByte(), (value and 127).toByte())
private fun comments(gain: String = "-6.0 dB", peak: String = "0.8", padding: Int = 0): ByteArray {
    val fields = listOf("COMMENT=" + "x".repeat(padding), "REPLAYGAIN_TRACK_GAIN=$gain", "REPLAYGAIN_TRACK_PEAK=$peak")
    return integer(0, true) + integer(fields.size, true) + fields.fold(byteArrayOf()) { out, field ->
        val bytes = field.toByteArray(); out + integer(bytes.size, true) + bytes
    }
}
private fun id3(version: Int, encoding: Int, peakFirst: Boolean = false): ByteArray {
    val charset = when (encoding) { 1 -> Charsets.UTF_16; 2 -> Charsets.UTF_16BE; 3 -> Charsets.UTF_8; else -> Charsets.ISO_8859_1 }
    val fields = listOf("replaygain_track_gain" to "+6.00 dB", "REPLAYGAIN_TRACK_PEAK" to "0.25")
    val payload = (if (peakFirst) fields.reversed() else fields).fold(byteArrayOf()) { out, (key, value) ->
        val body = byteArrayOf(encoding.toByte()) + key.toByteArray(charset) + ByteArray(if (encoding in 1..2) 2 else 1) + value.toByteArray(charset)
        out + "TXXX".toByteArray() + (if (version == 4) synchsafe(body.size) else integer(body.size)) + byteArrayOf(0, 0) + body
    }
    return "ID3".toByteArray() + byteArrayOf(version.toByte(), 0, 0) + synchsafe(payload.size) + payload
}
private fun oggPage(payload: ByteArray, laces: ByteArray, continued: Boolean): ByteArray {
    val header = ByteArray(27)
    "OggS".toByteArray().copyInto(header)
    header[5] = if (continued) 1 else 2
    header[14] = 1
    header[26] = laces.size.toByte()
    return header + laces + payload
}
private fun ogg(opus: Boolean): ByteArray {
    val prefix = if (opus) "OpusTags".toByteArray() else byteArrayOf(3) + "vorbis".toByteArray()
    val packet = prefix + comments(padding = 700)
    val split = 510
    val rest = packet.copyOfRange(split, packet.size)
    val laces = ByteArray(rest.size / 255 + 1) { i -> if (i < rest.size / 255) 255.toByte() else (rest.size % 255).toByte() }
    return oggPage(packet.copyOfRange(0, split), byteArrayOf(255.toByte(), 255.toByte()), false) + oggPage(rest, laces, true)
}
private fun atom(type: String, payload: ByteArray, extended: Boolean = false): ByteArray =
    (if (extended) integer(1) + type.toByteArray() + ByteBuffer.allocate(8).putLong(payload.size + 16L).array()
    else integer(payload.size + 8) + type.toByteArray()) + payload
private fun m4a(gain: String?, peak: String?, tailMoov: Boolean = false, extended: Boolean = false): ByteArray {
    val entries = listOfNotNull(gain?.let { "replaygain_track_gain" to it }, peak?.let { "REPLAYGAIN_TRACK_PEAK" to it })
    val items = entries.fold(byteArrayOf()) { output, (name, value) ->
        output + atom("----", atom("mean", integer(0) + "com.apple.iTunes".toByteArray()) +
            atom("name", integer(0) + name.toByteArray()) + atom("data", integer(1) + integer(0) + value.toByteArray()))
    }
    val moov = atom("moov", atom("udta", atom("meta", integer(0) + atom("ilst", items))), extended)
    val ftyp = atom("ftyp", "M4A ".toByteArray() + integer(0) + "isom".toByteArray())
    val audio = atom("mdat", ByteArray(2048))
    return ftyp + (if (tailMoov) audio + moov else moov + audio)
}

private fun tags(bytes: ByteArray) = Files.createTempFile("replaygain-test-", ".audio").toFile().let { file ->
    try { file.writeBytes(bytes); ReplayGainReader.readTags(file.absolutePath) } finally { file.delete() }
}
private fun pcm(samples: IntArray, multiplier: Double): IntArray {
    val input = ByteBuffer.allocate(samples.size * 2).order(ByteOrder.LITTLE_ENDIAN)
    samples.forEach { input.putShort(it.toShort()) }; input.flip()
    val output = ByteBuffer.allocate(input.remaining()).order(ByteOrder.LITTLE_ENDIAN)
    ReplayGainMath.processPcm16(input, output, multiplier); output.flip()
    return IntArray(samples.size) { output.short.toInt() }
}
fun main() {
    test("First scan reads every file and later launches reuse gain, peak and absent tags") {
        val directory = Files.createTempDirectory("replaygain-cache-").toFile()
        try {
            val tagged = directory.resolve("tagged.m4a").apply { writeBytes(m4a("-7.25", "0.9")) }
            val untagged = directory.resolve("untagged.m4a").apply { writeBytes(m4a(null, null)) }
            val persisted = mutableMapOf<String, String>()
            var reads = 0
            fun cache() = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                reads++; ReplayGainReader.readTags(it)
            })
            val firstLaunch = cache()
            near(firstLaunch.read(tagged).gain, -7.25)
            near(firstLaunch.read(tagged).peak, 0.9)
            check(firstLaunch.read(untagged) == ReplayGainTags())
            check(reads == 2)
            val nextLaunch = cache()
            repeat(10) {
                near(nextLaunch.read(tagged).peak, 0.9)
                check(nextLaunch.read(untagged) == ReplayGainTags())
            }
            check(reads == 2) { "Unchanged or untagged files were reopened" }
            val added = directory.resolve("added.m4a").apply { writeBytes(m4a("-3.0", "0.8")) }
            near(nextLaunch.read(added).gain, -3.0)
            check(reads == 3)
        } finally { directory.deleteRecursively() }
    }
    test("Changed physical dates reread both tags even when the timestamp moves backwards") {
        val file = Files.createTempFile("replaygain-cache-", ".m4a").toFile()
        try {
            val persisted = mutableMapOf<String, String>()
            var reads = 0
            val cache = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                reads++; ReplayGainReader.readTags(it)
            })
            file.writeBytes(m4a("-6.0", "0.9"))
            check(file.setLastModified(1_700_000_000_000L))
            near(cache.read(file).gain, -6.0)
            val size = file.length()
            file.writeBytes(m4a("-9.0", "0.8"))
            check(file.length() == size)
            check(file.setLastModified(1_600_000_000_000L))
            val changed = cache.read(file)
            near(changed.gain, -9.0); near(changed.peak, 0.8)
            cache.read(file)
            check(reads == 2)
        } finally { file.delete() }
    }
    test("A size change also invalidates the cache when the date is preserved, including removed tags") {
        val file = Files.createTempFile("replaygain-cache-", ".m4a").toFile()
        try {
            val persisted = mutableMapOf<String, String>()
            var reads = 0
            val cache = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                reads++; ReplayGainReader.readTags(it)
            })
            file.writeBytes(m4a("-6.0", "0.9"))
            val timestamp = file.lastModified()
            near(cache.read(file).peak, 0.9)
            file.writeBytes(m4a(null, null))
            check(file.setLastModified(timestamp))
            check(cache.read(file) == ReplayGainTags())
            cache.read(file)
            check(reads == 2)
        } finally { file.delete() }
    }
    test("An old parser version or corrupt cache entry triggers one replacement read") {
        val file = Files.createTempFile("replaygain-cache-", ".m4a").toFile()
        try {
            file.writeBytes(m4a("-6.0", "0.9"))
            val persisted = mutableMapOf<String, String>()
            var reads = 0
            val cache = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                reads++; ReplayGainReader.readTags(it)
            })
            for (value in listOf("0|${file.lastModified()}|${file.length()}|-6.0|0.9",
                "1|${file.lastModified()}|${file.length()}|NaN|0.9", "broken")) {
                persisted[file.absolutePath] = value
                near(cache.read(file).peak, 0.9)
                cache.read(file)
            }
            check(reads == 3)
        } finally { file.delete() }
    }
    test("Failed reads and concurrent edits are not saved as a completed cache entry") {
        val file = Files.createTempFile("replaygain-cache-", ".m4a").toFile()
        try {
            file.writeBytes(m4a("-6.0", "0.9"))
            val persisted = mutableMapOf<String, String>()
            val failed = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                throw java.io.IOException("read interrupted")
            })
            check(runCatching { failed.read(file) }.isFailure)
            check(persisted.isEmpty())
            val editing = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                val tags = ReplayGainReader.readTags(it)
                check(file.setLastModified(file.lastModified() + 1000))
                tags
            })
            editing.read(file)
            check(persisted.isEmpty())
        } finally { file.delete() }
    }
    test("The real reader retries an incomplete file instead of caching it as tag-free") {
        val file = Files.createTempFile("replaygain-cache-", ".m4a").toFile()
        try {
            file.writeBytes("ID3".toByteArray())
            val persisted = mutableMapOf<String, String>()
            var reads = 0
            val cache = ReplayGainScanCache(persisted::get, { key, value -> persisted[key] = value }, {
                reads++; ReplayGainReader.readTags(it)
            })
            repeat(2) { check(cache.read(file) == ReplayGainTags()) }
            check(reads == 2 && persisted.isEmpty())
        } finally { file.delete() }
    }
    for (version in 3..4) for (encoding in 0..3) for (peakFirst in listOf(false, true)) {
        test("ID3v2.$version encoding=$encoding peakFirst=$peakFirst reads both tags") {
            val result = tags(id3(version, encoding, peakFirst)); near(result.gain, 6.0); near(result.peak, 0.25)
        }
    }
    test("FLAC reads peak after gain instead of returning at the first tag") {
        val data = comments()
        val result = tags("fLaC".toByteArray() + byteArrayOf(0x84.toByte(), (data.size shr 16).toByte(), (data.size shr 8).toByte(), data.size.toByte()) + data)
        near(result.gain, -6.0); near(result.peak, 0.8)
    }
    for (opus in listOf(false, true)) test("Ogg opus=$opus reassembles comments spanning pages") {
        val result = tags(ogg(opus)); near(result.gain, -6.0); near(result.peak, 0.8)
    }
    for (tail in listOf(false, true)) for (extended in listOf(false, true)) {
        test("M4A reads freeform gain and peak, tailMoov=$tail extended=$extended") {
            val result = tags(m4a("-7.25 dB", "0.912345", tail, extended))
            near(result.gain, -7.25); near(result.peak, 0.912345)
        }
    }
    test("M4A missing tags and malformed atom sizes are safe") {
        val empty = tags(m4a(null, null)); check(empty.gain == null && empty.peak == null)
        val bad = tags(integer(Int.MAX_VALUE) + "moov".toByteArray())
        check(bad.gain == null && bad.peak == null)
    }
    test("M4A permits peak-only metadata and peaks above unity") {
        val result = tags(m4a(null, "1.25")); check(result.gain == null); near(result.peak, 1.25)
    }
    test("Truncated/invalid metadata is safely ignored") {
        for (bytes in listOf(byteArrayOf(), "ID3".toByteArray(), id3(4, 3).take(14).toByteArray(), "OggS".toByteArray())) {
            val result = tags(bytes); check(result.gain == null && result.peak == null)
        }
    }
    test("Invalid non-finite gain and non-positive peak are rejected") {
        val data = comments("NaN dB", "-1")
        val result = tags("fLaC".toByteArray() + byteArrayOf(0x84.toByte(), 0, 0, data.size.toByte()) + data)
        check(result.gain == null && result.peak == null)
    }
    test("Positive gain amplifies PCM from the first sample") {
        val gain = ReplayGainMath.multiplier(true, 20 * log10(2.0), 0.25, 0.0, -6.0)
        near(gain, 2.0)
        check(pcm(intArrayOf(1000, -1000, 4000, -4000), gain).contentEquals(intArrayOf(2000, -2000, 8000, -8000)))
    }
    test("Negative gain attenuates PCM from the first sample") {
        val gain = ReplayGainMath.multiplier(true, -20 * log10(2.0), 1.0, 0.0, -6.0)
        check(pcm(intArrayOf(1000, -1000), gain).contentEquals(intArrayOf(500, -500)))
    }
    test("Gain plus preamp is limited using the stored peak") { near(ReplayGainMath.multiplier(true, 6.0, 0.8, 6.0, -6.0), 1.25) }
    test("Peaks above full scale remain valid and reduce gain") { near(ReplayGainMath.multiplier(true, 0.0, 2.0, 0.0, -6.0), 0.5) }
    test("Missing peaks prevent unverified boosts but preserve attenuation") {
        near(ReplayGainMath.multiplier(true, 6.0, null, 0.0, -6.0), 1.0)
        near(ReplayGainMath.multiplier(true, null, null, 0.0, -6.0), 10.0.pow(-6.0 / 20))
    }
    test("Disabled normalization is bit-exact unity") {
        val samples = intArrayOf(-32768, -11000, -1, 0, 1, 11000, 32767)
        check(pcm(samples, ReplayGainMath.multiplier(false, 20.0, 2.0, 6.0, -6.0)).contentEquals(samples))
    }
    test("Final PCM saturation never wraps signed samples on bad peak tags") {
        check(pcm(intArrayOf(-30000, 30000), 2.0).contentEquals(intArrayOf(-32768, 32767)))
    }
    test("Measured sine RMS changes by the requested decibels") {
        val sine = IntArray(4800) { (5000 * sin(2 * PI * it / 48)).roundToInt() }
        for (db in listOf(-18.0, -6.0, 6.0)) {
            val output = pcm(sine, ReplayGainMath.multiplier(true, db, 0.2, 0.0, 0.0))
            val inputPower = sine.sumOf { it.toDouble() * it }
            val outputPower = output.sumOf { it.toDouble() * it }
            near(10 * log10(outputPower / inputPower), db, 0.02)
        }
    }
    test("200 consecutive track gains apply to each first sample without a unity lead-in") {
        repeat(200) { index ->
            val db = if (index % 2 == 0) 20 * log10(2.0) else -20 * log10(2.0)
            val output = pcm(IntArray(64) { 1000 }, ReplayGainMath.multiplier(true, db, 0.25, 0.0, -6.0))
            check(output.all { it == if (index % 2 == 0) 2000 else 500 })
        }
    }
    test("Actual processor clears DB fallback gain before an untagged track's first sample") {
        val context = android.content.Context()
        val processor = com.doublesymmetry.kotlinaudio.players.ReplayGainAudioProcessor(context)
        fun render(format: androidx.media3.common.Format): Int {
            processor.selectFormat(format)
            val input = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(1000)
            input.flip(); processor.queueInput(input)
            return processor.getOutput().order(ByteOrder.LITTLE_ENDIAN).short.toInt()
        }
        fun metadata(gain: String) = androidx.media3.common.Metadata(
            androidx.media3.extractor.metadata.id3.InternalFrame("mmplayer.replaygain", "gain", gain),
            androidx.media3.extractor.metadata.id3.InternalFrame("mmplayer.replaygain", "peak", ""))
        val tagged = androidx.media3.common.Format(metadata("-12.041199826559248"))
        val untagged = androidx.media3.common.Format(metadata(""))
        repeat(200) {
            check(render(tagged) == 250)
            check(render(untagged) == 1000) { "Previous gain leaked into first untagged sample" }
        }
        context.preferences.fallback = -6.0206f
        check(render(untagged) == 500)
    }
    test("Actual processor reads M4A iTunes gain and peak and resets them for a metadata-free track") {
        val processor = com.doublesymmetry.kotlinaudio.players.ReplayGainAudioProcessor(android.content.Context())
        val tagged = androidx.media3.common.Format(androidx.media3.common.Metadata(
            androidx.media3.extractor.metadata.id3.InternalFrame("com.apple.iTunes", "replaygain_track_gain", "6.020599913279624 dB"),
            androidx.media3.extractor.metadata.id3.InternalFrame("com.apple.iTunes", "replaygain_track_peak", "0.25")))
        for ((format, expected) in listOf(tagged to 2000, androidx.media3.common.Format() to 1000)) {
            processor.selectFormat(format)
            val input = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).putShort(1000)
            input.flip(); processor.queueInput(input)
            check(processor.getOutput().order(ByteOrder.LITTLE_ENDIAN).short.toInt() == expected)
        }
    }
    println("$passed native ReplayGain checks passed")
}
