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
      
      val uri: Uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
      val projection = arrayOf(
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
      
      // Filter out files that are not music
      val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
      
      context.contentResolver.query(
        uri,
        projection,
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
        val yearColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR) // <-- AÑADIDO

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
          
          val albumArtUri = ContentUris.withAppendedId(sArtworkUri, albumId).toString()
          
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
              "coverUrl" to albumArtUri,
              "duration" to (durationMs / 1000.0), // Convert to seconds
              "trackNumber" to (cursor.getInt(trackColumn) % 1000),
              "discNumber" to if (cursor.getInt(trackColumn) >= 1000) (cursor.getInt(trackColumn) / 1000) else 1,
              "year" to if (year > 0) year else null
            )
            audioList.add(fileMap)
          }
        }
      }
      
      return@AsyncFunction audioList
    }
  }
}