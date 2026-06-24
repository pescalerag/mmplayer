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
      
      try {
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
          "date_modified"
        )
        if (supportsAlbumArtist) {
          projection.add("album_artist")
        }
        
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        
        context.contentResolver.query(
          uri,
          projection.toTypedArray(),
          selection,
          null,
          "${MediaStore.Audio.Media.TITLE} ASC"
        )?.use { cursor ->
          val idColumn = cursor.getColumnIndex(MediaStore.Audio.Media._ID)
          val dataColumn = cursor.getColumnIndex(MediaStore.Audio.Media.DATA)
          val titleColumn = cursor.getColumnIndex(MediaStore.Audio.Media.TITLE)
          val artistColumn = cursor.getColumnIndex(MediaStore.Audio.Media.ARTIST)
          val albumColumn = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM)
          val albumIdColumn = cursor.getColumnIndex(MediaStore.Audio.Media.ALBUM_ID)
          val durationColumn = cursor.getColumnIndex(MediaStore.Audio.Media.DURATION)
          val trackColumn = cursor.getColumnIndex(MediaStore.Audio.Media.TRACK)
          val dateModifiedColumn = cursor.getColumnIndex("date_modified")
          val albumArtistColumn = if (supportsAlbumArtist) cursor.getColumnIndex("album_artist") else -1
          val yearColumn = cursor.getColumnIndex("year")

          val sArtworkUri = Uri.parse("content://media/external/audio/albumart")

          while (cursor.moveToNext()) {
            if (idColumn < 0 || dataColumn < 0) continue

            val id = cursor.getLong(idColumn)
            val data = cursor.getString(dataColumn) ?: continue
            
            val title = if (titleColumn >= 0) cursor.getString(titleColumn) ?: "Unknown Title" else "Unknown Title"
            val artist = if (artistColumn >= 0) cursor.getString(artistColumn) ?: "Unknown Artist" else "Unknown Artist"
            val album = if (albumColumn >= 0) cursor.getString(albumColumn) ?: "Unknown Album" else "Unknown Album"
            val albumId = if (albumIdColumn >= 0) cursor.getLong(albumIdColumn) else 0L
            val durationMs = if (durationColumn >= 0) cursor.getLong(durationColumn) else 0L
            val trackVal = if (trackColumn >= 0) cursor.getInt(trackColumn) else 0
            val year = if (yearColumn >= 0) cursor.getInt(yearColumn) else 0
            val dateModifiedSec = if (dateModifiedColumn >= 0) cursor.getLong(dateModifiedColumn) else 0L
            val albumArtist = if (albumArtistColumn >= 0) cursor.getString(albumArtistColumn) else null
            
            var finalCoverUrl = validAlbumArts[albumId]
            if (!validAlbumArts.containsKey(albumId)) {
                finalCoverUrl = ContentUris.withAppendedId(sArtworkUri, albumId).toString()
                validAlbumArts[albumId] = finalCoverUrl
            }
            
            val replayGain: Double? = null
            
            val fileMap = mapOf(
              "id" to id.toString(),
              "uri" to "file://$data",
              "filename" to data.substringAfterLast('/'),
              "title" to title,
              "artist" to artist,
              "album" to album,
              "albumId" to albumId.toString(),
              "coverUrl" to finalCoverUrl,
              "duration" to (durationMs / 1000.0),
              "trackNumber" to (trackVal % 1000),
              "discNumber" to if (trackVal >= 1000) (trackVal / 1000) else 1,
              "year" to if (year > 0) year else null,
              "albumArtist" to albumArtist,
              "lastModified" to (dateModifiedSec * 1000),
              "replayGain" to replayGain
            )
            audioList.add(fileMap)
          }
        }
        
        return@AsyncFunction audioList
      } catch (e: Exception) {
        throw Exception("Error scanning MediaStore: ${e.message}", e)
      }
    }

    AsyncFunction("getReplayGain") { uri: String ->
      val path = if (uri.startsWith("file://")) uri.substring(7) else uri
      ReplayGainReader.readReplayGain(path)
    }

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