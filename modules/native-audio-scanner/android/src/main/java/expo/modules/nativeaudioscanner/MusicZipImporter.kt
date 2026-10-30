package expo.modules.nativeaudioscanner

import android.Manifest
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.provider.MediaStore
import android.provider.OpenableColumns
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.zip.ZipFile
import java.util.Locale

internal class MusicZipImporter(private val context: Context) {
    private data class Existing(val uri: Uri, val size: Long)
    private data class Created(val uri: Uri?, val file: File?, val relativePath: String, val name: String)
    private val resolver = context.contentResolver
    private val modern = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    private val collection: Uri get() = if (modern) MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Audio.Media.EXTERNAL_CONTENT_URI

    fun openedFileInfo(value: String): Map<String, String> {
        val uri = Uri.parse(value)
        var name = uri.lastPathSegment.orEmpty()
        if (uri.scheme == "content") {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) name = cursor.getString(0) ?: name
            }
        }
        return mapOf("name" to name, "mimeType" to (resolver.getType(uri) ?: ""))
    }

    fun importZip(value: String, suppliedName: String, progress: (Int, Int, String) -> Unit): Map<String, Any> {
        if (!modern && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) throw IOException("music_zip.permission_denied")
        if (Environment.getExternalStorageState() != Environment.MEDIA_MOUNTED) throw IOException("music_zip.storage_unavailable")
        val uri = Uri.parse(value)
        val name = suppliedName.ifBlank { openedFileInfo(value)["name"].orEmpty() }
        val folder = MusicZipPaths.folder(name)
        val cached = File.createTempFile("music-import-", ".zip", context.cacheDir)
        val created = mutableListOf<Created>()
        try {
            open(uri).use { input -> cached.outputStream().use { input.copyTo(it, 64 * 1024) } }
            var imported = 0
            var skipped = 0
            ZipFile(cached).use { archive ->
                val audio = archive.entries().asSequence().map { entry -> entry to MusicZipPaths.entry(entry.name) }
                    .filter { (entry, path) -> !entry.isDirectory && MusicZipPaths.isAudio(path) && entry.size != 0L }.toList()
                if (audio.isEmpty()) throw IOException("music_zip.no_audio")
                val directories = mutableMapOf<String, MutableMap<String, Existing>>()
                val required = audio.fold(0L) { total, (entry, path) ->
                    if (entry.size < 0) throw IOException("music_zip.invalid_archive")
                    val relative = (listOf(Environment.DIRECTORY_MUSIC, folder) + path.dropLast(1)).joinToString("/", postfix = "/")
                    val existing = directories.getOrPut(relative) { existingFiles(relative) }[path.last().lowercase(Locale.ROOT)]
                    if (existing?.size == entry.size) total else Math.addExact(total, entry.size)
                }
                if (required > StatFs(Environment.getExternalStorageDirectory().absolutePath).availableBytes) throw IOException("music_zip.not_enough_space")
                for ((index, item) in audio.withIndex()) {
                    val (entry, path) = item
                    val relative = (listOf(Environment.DIRECTORY_MUSIC, folder) + path.dropLast(1)).joinToString("/", postfix = "/")
                    val existing = directories.getOrPut(relative) { existingFiles(relative) }
                    var destination = path.last()
                    var number = 1
                    var sourceHash: ByteArray? = null
                    var duplicate = false
                    while (existing.containsKey(destination.lowercase(Locale.ROOT))) {
                        val other = existing.getValue(destination.lowercase(Locale.ROOT))
                        if (other.size == entry.size) {
                            if (sourceHash == null) sourceHash = archive.getInputStream(entry).use { digest(it) }
                            val otherHash = runCatching { open(other.uri).use { digest(it) } }.getOrNull()
                            if (otherHash != null && sourceHash.contentEquals(otherHash)) { duplicate = true; break }
                        }
                        destination = MusicZipPaths.numbered(path.last(), ++number)
                    }
                    if (duplicate) skipped++ else {
                        if (entry.size > StatFs(Environment.getExternalStorageDirectory().absolutePath).availableBytes) throw IOException("music_zip.not_enough_space")
                        val target = create(relative, destination)
                        created.add(target)
                        val output = target.uri?.let { resolver.openOutputStream(it, "w") } ?: target.file?.outputStream()
                            ?: throw IOException("music_zip.import_error")
                        output.use { out -> archive.getInputStream(entry).use { input -> MusicZipCopy.copyChecked(input, out, entry) } }
                        existing[destination.lowercase(Locale.ROOT)] = Existing(target.uri ?: Uri.fromFile(target.file), entry.size)
                        imported++
                    }
                    progress(index + 1, audio.size, folder)
                }
                // Publish only once all entries passed CRC validation. Failures
                // remove our new files and never modify any pre-existing music.
                for (target in created) if (modern) {
                    resolver.update(target.uri!!, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
                }
            }
            scan(created)
            return mapOf("folder" to "Music/$folder", "imported" to imported, "skipped" to skipped)
        } catch (error: Exception) {
            for (target in created) runCatching {
                if (target.uri != null) resolver.delete(target.uri, null, null) else target.file?.delete()
            }
            throw error
        } finally { cached.delete() }
    }

    private fun open(uri: Uri): InputStream = when (uri.scheme) {
        "file" -> File(uri.path ?: throw IOException("music_zip.invalid_archive")).inputStream()
        "content" -> resolver.openInputStream(uri) ?: throw IOException("music_zip.invalid_archive")
        else -> throw IOException("music_zip.invalid_archive")
    }

    private fun digest(input: InputStream): ByteArray {
        val hash = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        while (true) { val count = input.read(buffer); if (count < 0) break; hash.update(buffer, 0, count) }
        return hash.digest()
    }

    private fun existingFiles(relative: String): MutableMap<String, Existing> {
        if (!modern) {
            val directory = File(Environment.getExternalStorageDirectory(), relative)
            return directory.listFiles()?.filter { it.isFile }?.associate { it.name.lowercase(Locale.ROOT) to Existing(Uri.fromFile(it), it.length()) }?.toMutableMap() ?: mutableMapOf()
        }
        val result = mutableMapOf<String, Existing>()
        // Apps without library permission can still insert their own MediaStore
        // files. The provider handles a conflicting unseen filename safely.
        runCatching {
            resolver.query(collection, arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE),
                "${MediaStore.MediaColumns.RELATIVE_PATH} = ?", arrayOf(relative), null)?.use { cursor ->
                while (cursor.moveToNext()) result[cursor.getString(1).lowercase(Locale.ROOT)] = Existing(ContentUris.withAppendedId(collection, cursor.getLong(0)), cursor.getLong(2))
            }
        }
        return result
    }

    private fun create(relative: String, name: String): Created {
        if (modern) {
            val extension = name.substringAfterLast('.').lowercase()
            val mime = when (extension) {
                "flac" -> "audio/flac"
                "m4a", "alac" -> "audio/mp4"
                "ogg" -> "audio/ogg"
                "opus" -> "audio/opus"
                "wav" -> "audio/wav"
                "aac" -> "audio/aac"
                "aif", "aiff" -> "audio/x-aiff"
                "mid", "midi" -> "audio/midi"
                "wma" -> "audio/x-ms-wma"
                "mka" -> "audio/x-matroska"
                else -> "audio/mpeg"
            }
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                put(MediaStore.MediaColumns.RELATIVE_PATH, relative)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
                put(MediaStore.Audio.Media.IS_MUSIC, 1)
            }
            return Created(resolver.insert(collection, values) ?: throw IOException("music_zip.import_error"), null, relative, name)
        }
        val root = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC).canonicalFile
        val target = File(Environment.getExternalStorageDirectory(), relative + name).canonicalFile
        if (!target.path.startsWith(root.path + File.separator)) throw IOException("music_zip.unsafe_path")
        if (!target.parentFile!!.isDirectory && !target.parentFile!!.mkdirs()) throw IOException("music_zip.import_error")
        // Never use overwrite=true, even if another app creates the file while
        // the ZIP is being imported.
        if (!target.createNewFile()) throw IOException("music_zip.file_conflict")
        return Created(null, target, relative, name)
    }

    private fun scan(created: List<Created>) {
        val paths = created.mapNotNull { target ->
            target.file?.absolutePath ?: runCatching {
                resolver.query(target.uri!!, arrayOf(MediaStore.MediaColumns.DATA), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0) else null
                }
            }.getOrNull()
        }
        if (paths.isEmpty()) return
        val done = CountDownLatch(paths.size)
        MediaScannerConnection.scanFile(context, paths.toTypedArray(), null) { _, _ -> done.countDown() }
        done.await(30, TimeUnit.SECONDS)
    }
}
