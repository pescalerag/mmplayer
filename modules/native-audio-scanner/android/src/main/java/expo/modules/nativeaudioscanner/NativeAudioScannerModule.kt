package expo.modules.nativeaudioscanner

import android.content.ContentUris
import android.net.Uri
import android.provider.MediaStore
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeAudioScannerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeAudioScanner")

    AsyncFunction("getAudioFiles") { ->
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
        MediaStore.Audio.Media.YEAR
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
              "albumArtist" to albumArtist
            )
            audioList.add(fileMap)
          }
        }
      }
      
      return@AsyncFunction audioList
    }
  }
}