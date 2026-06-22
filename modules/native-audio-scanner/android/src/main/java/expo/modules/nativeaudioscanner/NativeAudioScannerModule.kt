package expo.modules.nativeaudioscanner

import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile

class NativeAudioScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeAudioScanner")

    AsyncFunction("getAudioFiles") { scanReplayGain: Boolean ->
      val shouldScanReplay = scanReplayGain
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any?>>()
      
      val audioList = mutableListOf<Map<String, Any?>>()
      val validAlbumArts = mutableMapOf<Long, String?>()
      
      val supportsAlbumArtist = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R
      val uri: Uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      val projection = mutableListOf(
        MediaStore.Audio.Media._ID,
        MediaStore.Audio.Media.DATA,
        MediaStore.Audio.Media.TITLE,
        MediaStore.Audio.Media.ARTIST,
        MediaStore.Audio.Media.ALBUM,
        MediaStore.Audio.Media.ALBUM_ID,
        MediaStore.Audio.Media.DURATION,
        MediaStore.Audio.Media.TRACK,
        MediaStore.Audio.Media.YEAR,
        MediaStore.Audio.Media.DATE_MODIFIED
      )
      if (supportsAlbumArtist) {
        projection.add(MediaStore.Audio.Media.ALBUM_ARTIST)
      }
      
      // Filter out files that are not music
      val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
      
      context.contentResolver.query(
        uri,
        projection.toTypedArray(),
        selection,
        null,
        "${MediaStore.Audio.Media.TITLE} ASC"
      )?.use { cursor ->
        val idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
        val dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
        val titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
        val artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
        val albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
        val albumIdColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
        val durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
        val trackColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
        val yearColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
        val dateModifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_MODIFIED)
        val albumArtistColumn = if (supportsAlbumArtist) cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ARTIST) else -1

        val sArtworkUri = Uri.parse("content://media/external/audio/albumart")

        while (cursor.moveToNext()) {
          val id = cursor.getLong(idColumn)
          val data = cursor.getString(dataColumn)
          val title = cursor.getString(titleColumn) ?: "Unknown Title"
          val artist = cursor.getString(artistColumn) ?: "Unknown Artist"
          val album = cursor.getString(albumColumn) ?: "Unknown Album"
          val albumId = cursor.getLong(albumIdColumn)
          val durationMs = cursor.getLong(durationColumn)
          val year = cursor.getInt(yearColumn)
          val dateModifiedSec = cursor.getLong(dateModifiedColumn)
          val albumArtist = if (supportsAlbumArtist && albumArtistColumn != -1) {
            cursor.getString(albumArtistColumn)
          } else {
            null
          }
          
          var finalCoverUrl = validAlbumArts[albumId]
          if (!validAlbumArts.containsKey(albumId)) {
              val albumArtUri = ContentUris.withAppendedId(sArtworkUri, albumId)
              try {
                  context.contentResolver.openFileDescriptor(albumArtUri, "r")?.use {
                      finalCoverUrl = albumArtUri.toString()
                  }
              } catch (e: Exception) {
                  finalCoverUrl = null
              }
              validAlbumArts[albumId] = finalCoverUrl
          }
          
          // Only add files with valid paths
          if (data != null) {
            val replayGain = if (shouldScanReplay) ReplayGainReader.readReplayGain(data) else null
            val fileMap = mapOf(
              "id" to id.toString(),
              "uri" to "file://$data",
              "filename" to data.substringAfterLast('/'),
              "title" to title,
              "artist" to artist,
              "album" to album,
              "albumId" to albumId.toString(),
              "coverUrl" to finalCoverUrl,
              "duration" to (durationMs / 1000.0), // Convert to seconds
              "trackNumber" to (cursor.getInt(trackColumn) % 1000),
              "discNumber" to if (cursor.getInt(trackColumn) >= 1000) (cursor.getInt(trackColumn) / 1000) else 1,
              "year" to if (year > 0) year else null,
              "albumArtist" to albumArtist,
              "lastModified" to (dateModifiedSec * 1000),
              "replayGain" to replayGain
            )
            audioList.add(fileMap)
          }
        }
      }
      
      return@AsyncFunction audioList
    }

    AsyncFunction("getReplayGain") { uri: String ->
      val path = if (uri.startsWith("file://")) uri.substring(7) else uri
      ReplayGainReader.readReplayGain(path)
    }

    // Reads `length` bytes from `filePath` starting at byte `offset` and returns them as a
    // Base64-encoded string. Uses RandomAccessFile for true byte-accurate seeking, which
    // expo-file-system's readAsStringAsync does NOT provide (its position/length params
    // operate on base64 character indices, not raw byte positions).
    AsyncFunction("readFileChunk") { filePath: String, offset: Double, length: Double ->
      val path = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
      val byteOffset = offset.toLong()
      val byteLength = length.toInt()

      val file = File(path)
      if (!file.exists()) throw Exception("File not found: $path")

      val remaining = (file.length() - byteOffset).coerceAtLeast(0L)
      val actualLength = minOf(byteLength.toLong(), remaining).toInt()
      if (actualLength <= 0) return@AsyncFunction ""

      val buffer = ByteArray(actualLength)
      RandomAccessFile(file, "r").use { raf ->
        raf.seek(byteOffset)
        raf.readFully(buffer)
      }

      Base64.encodeToString(buffer, Base64.NO_WRAP)
    }
  }
}