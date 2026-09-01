package expo.modules.nativeaudioscanner

import android.content.Context
import android.content.Intent
import android.content.ContentUris
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import android.media.MediaScannerConnection
import android.app.Activity
import android.app.RecoverableSecurityException
import android.os.Build
import android.os.Environment
import android.os.StatFs
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.images.AndroidArtwork
import expo.modules.kotlin.Promise

class NativeAudioScannerModule : Module() {
  private val REQUEST_CODE_WRITE = 1928

  private var castWakeLock: PowerManager.WakeLock? = null
  private var castWifiLock: WifiManager.WifiLock? = null

  @Volatile
  private var isBatchCancelled = false

  private var pendingPromise: Promise? = null
  private var pendingFilePath: String? = null
  private var pendingTitle: String? = null
  private var pendingArtist: String? = null
  private var pendingAlbum: String? = null
  private var pendingYear: Int? = null
  private var pendingTrackNumber: Int? = null
  private var pendingGenre: String? = null
  private var pendingCoverArtPath: String? = null
  private var pendingAlbumArtist: String? = null
  private var pendingDiscNumber: Int? = null
  private var pendingBatchList: List<Map<String, Any?>>? = null
  private var pendingBatchIndex: Int = 0

  private fun clearPending() {
    pendingPromise = null
    pendingFilePath = null
    pendingTitle = null
    pendingArtist = null
    pendingAlbum = null
    pendingYear = null
    pendingTrackNumber = null
    pendingGenre = null
    pendingCoverArtPath = null
    pendingAlbumArtist = null
    pendingDiscNumber = null
    pendingBatchList = null
    pendingBatchIndex = 0
  }

  private fun getUriForPath(path: String): Uri? {
    val context = appContext.reactContext ?: return null
    val cleanPath = if (path.startsWith("file://")) path.substring(7) else path
    val projection = arrayOf(MediaStore.Audio.Media._ID)
    val selection = "${MediaStore.Audio.Media.DATA} = ?"
    val selectionArgs = arrayOf(cleanPath)
    val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    
    context.contentResolver.query(uri, projection, selection, selectionArgs, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val idColumn = cursor.getColumnIndex(MediaStore.Audio.Media._ID)
        if (idColumn >= 0) {
            val id = cursor.getLong(idColumn)
            return ContentUris.withAppendedId(uri, id)
        }
      }
    }
    return null
  }

  private fun tryWriteMetadata(
    filePath: String,
    title: String?,
    artist: String?,
    album: String?,
    year: Int?,
    trackNumber: Int?,
    genre: String?,
    coverArtPath: String?,
    albumArtist: String? = null,
    discNumber: Int? = null
  ): Boolean {
    val path = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
    val file = File(path)
    if (!file.exists()) throw Exception("Archivo no encontrado: $path")

    val context = appContext.reactContext ?: throw Exception("React context no disponible")
    
    // Copy to temporary file in cache to edit safely
    val extension = file.extension
    val tempFile = File(context.cacheDir, "temp_tag_edit_${System.currentTimeMillis()}.$extension")
    if (tempFile.exists()) tempFile.delete()
    file.copyTo(tempFile, overwrite = true)

    try {
      val audioFile = AudioFileIO.read(tempFile)
      var tag = audioFile.tag
      if (tag == null) {
        tag = audioFile.createDefaultTag()
        audioFile.tag = tag
      }

      if (title != null) tag.setField(FieldKey.TITLE, title)
      if (artist != null) tag.setField(FieldKey.ARTIST, artist)
      if (album != null) tag.setField(FieldKey.ALBUM, album)
      if (year != null) tag.setField(FieldKey.YEAR, year.toString())
      if (trackNumber != null) tag.setField(FieldKey.TRACK, trackNumber.toString())
      if (genre != null) tag.setField(FieldKey.GENRE, genre)
      if (albumArtist != null) {
        if (albumArtist.isEmpty()) {
          tag.deleteField(FieldKey.ALBUM_ARTIST)
        } else {
          tag.setField(FieldKey.ALBUM_ARTIST, albumArtist)
        }
      }
      if (discNumber != null) {
        if (discNumber == 0) {
          tag.deleteField(FieldKey.DISC_NO)
        } else {
          tag.setField(FieldKey.DISC_NO, discNumber.toString())
        }
      }

      if (coverArtPath != null) {
        if (coverArtPath.isEmpty()) {
          tag.deleteArtworkField()
        } else {
          val cleanCoverPath = if (coverArtPath.startsWith("file://")) coverArtPath.substring(7) else coverArtPath
          val coverFile = File(cleanCoverPath)
          if (coverFile.exists()) {
            val ext = coverFile.extension.lowercase()
            val mimeType = if (ext == "png") "image/png" else "image/jpeg"
            
            if (tag is org.jaudiotagger.tag.flac.FlacTag) {
              val options = android.graphics.BitmapFactory.Options().apply {
                inJustDecodeBounds = true
              }
              android.graphics.BitmapFactory.decodeFile(coverFile.absolutePath, options)
              val width = if (options.outWidth > 0) options.outWidth else 0
              val height = if (options.outHeight > 0) options.outHeight else 0
              val finalMimeType = options.outMimeType ?: mimeType
              
              val artworkField = org.jaudiotagger.audio.flac.metadatablock.MetadataBlockDataPicture(
                coverFile.readBytes(),
                3, // pictureType (Front Cover)
                finalMimeType,
                "", // description
                width,
                height,
                24, // depth
                0   // colorCount
              )
              tag.deleteArtworkField()
              tag.setField(artworkField)
            } else {
              val artwork = AndroidArtwork()
              artwork.binaryData = coverFile.readBytes()
              artwork.mimeType = mimeType
              artwork.pictureType = 3
              tag.deleteArtworkField()
              tag.setField(artwork)
            }
          }
        }
      }

      audioFile.commit()

      // Copy back to original file path (using ContentResolver first if available)
      val mediaUri = getUriForPath(file.absolutePath)
      if (mediaUri != null) {
        val outputStream = context.contentResolver.openOutputStream(mediaUri, "rwt")
          ?: throw java.io.IOException("Failed to open output stream for MediaStore URI: $mediaUri")
        outputStream.use { out ->
          tempFile.inputStream().use { input ->
            input.copyTo(out)
          }
        }
      } else {
        java.io.FileOutputStream(file).use { out ->
          tempFile.inputStream().use { input ->
            input.copyTo(out)
          }
        }
      }
      tempFile.delete()

      return true
    } catch (e: Exception) {
      if (tempFile.exists()) tempFile.delete()
      throw e
    }
  }

  private fun executeBatchWrite(promise: Promise) {
    val batchList = pendingBatchList
    if (batchList == null) {
      promise.resolve(true)
      clearPending()
      return
    }

    val context = appContext.reactContext
    if (context == null) {
      promise.reject("ERR_CONTEXT", "React context is null", null)
      clearPending()
      return
    }

    for (i in pendingBatchIndex until batchList.size) {
      if (isBatchCancelled) {
        clearPending()
        promise.reject("ERR_CANCELLED", "Batch write was cancelled by user", null)
        return
      }

      val item = batchList[i]
      val filePath = item["filePath"] as? String ?: continue
      @Suppress("UNCHECKED_CAST")
      val metadata = item["metadata"] as? Map<String, Any?> ?: continue

      val title = metadata["title"] as? String
      val artist = metadata["artist"] as? String
      val album = metadata["album"] as? String
      val year = (metadata["year"] as? Number)?.toInt()
      val trackNumber = (metadata["trackNumber"] as? Number)?.toInt()
      val genre = metadata["genre"] as? String
      val coverArtPath = metadata["coverArtPath"] as? String
      val albumArtist = metadata["albumArtist"] as? String
      val discNumber = (metadata["discNumber"] as? Number)?.toInt()

      try {
        tryWriteMetadata(
          filePath,
          title,
          artist,
          album,
          year,
          trackNumber,
          genre,
          coverArtPath,
          albumArtist,
          discNumber
        )
      } catch (e: SecurityException) {
        pendingBatchIndex = i
        pendingPromise = promise
        handleSecurityException(e, filePath, title, artist, album, year, trackNumber, genre, coverArtPath, albumArtist, discNumber, promise)
        return
      } catch (e: java.io.IOException) {
        val cause = e.cause
        if (cause is SecurityException) {
          pendingBatchIndex = i
          pendingPromise = promise
          handleSecurityException(cause, filePath, title, artist, album, year, trackNumber, genre, coverArtPath, albumArtist, discNumber, promise)
          return
        } else {
          promise.reject("ERR_WRITE_FAILED", "IOException writing batch at index $i: ${e.message}", e)
          clearPending()
          return
        }
      } catch (e: Exception) {
        promise.reject("ERR_WRITE_FAILED", "Failed writing batch at index $i: ${e.message}", e)
        clearPending()
        return
      }
    }

    promise.resolve(true)
    clearPending()
  }

  private fun handleSecurityException(
    e: SecurityException,
    filePath: String,
    title: String?,
    artist: String?,
    album: String?,
    year: Int?,
    trackNumber: Int?,
    genre: String?,
    coverArtPath: String?,
    albumArtist: String?,
    discNumber: Int?,
    promise: Promise
  ) {
    val context = appContext.reactContext ?: run {
      promise.reject("ERR_CONTEXT", "React context is null", e)
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val recoverableSecurityException = e as? RecoverableSecurityException

      val urisToRequest = mutableListOf<Uri>()
      val batchList = pendingBatchList
      if (batchList != null) {
        for (idx in pendingBatchIndex until batchList.size) {
          val item = batchList[idx]
          val path = item["filePath"] as? String ?: continue
          val uri = getUriForPath(path)
          if (uri != null) {
            urisToRequest.add(uri)
          }
        }
      } else {
        val uri = getUriForPath(filePath)
        if (uri != null) {
          urisToRequest.add(uri)
        }
      }

      if (urisToRequest.isNotEmpty()) {
        val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          MediaStore.createWriteRequest(context.contentResolver, urisToRequest)
        } else if (recoverableSecurityException != null) {
          recoverableSecurityException.userAction.actionIntent
        } else {
          null
        }

        if (pendingIntent != null) {
          pendingPromise = promise
          pendingFilePath = filePath
          pendingTitle = title
          pendingArtist = artist
          pendingAlbum = album
          pendingYear = year
          pendingTrackNumber = trackNumber
          pendingGenre = genre
          pendingCoverArtPath = coverArtPath
          pendingAlbumArtist = albumArtist
          pendingDiscNumber = discNumber

          val currentActivity = appContext.currentActivity
          if (currentActivity != null) {
            currentActivity.startIntentSenderForResult(
              pendingIntent.intentSender,
              REQUEST_CODE_WRITE,
              null, 0, 0, 0
            )
          } else {
            promise.reject("ERR_NO_ACTIVITY", "No active activity to request permission", null)
          }
        } else {
          promise.reject("ERR_PERMISSION_FAILED", "Failed to create write request: ${e.message}", e)
        }
      } else {
        promise.reject("ERR_URI_NOT_FOUND", "Could not find MediaStore URI for $filePath: ${e.message}", e)
      }
    } else {
      promise.reject("ERR_WRITE_FAILED", "Security exception writing tags: ${e.message}", e)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NativeAudioScanner")

    AsyncFunction("updateWidget") { title: String, artist: String, coverUri: String?, isPlaying: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction
      
      // Update 4x1 widget
      val intent4x1 = Intent("com.pescalerag.mmplayer.ACTION_UPDATE_STATE").apply {
          setClassName(context.packageName, "expo.modules.nativeaudioscanner.WidgetProvider")
          putExtra("title", title)
          putExtra("artist", artist)
          putExtra("coverUri", coverUri)
          putExtra("isPlaying", isPlaying)
      }
      context.sendBroadcast(intent4x1)

      // Update 2x2 widget
      val intent2x2 = Intent("com.pescalerag.mmplayer.ACTION_UPDATE_STATE").apply {
          setClassName(context.packageName, "expo.modules.nativeaudioscanner.WidgetProviderSmall")
          putExtra("title", title)
          putExtra("artist", artist)
          putExtra("coverUri", coverUri)
          putExtra("isPlaying", isPlaying)
      }
      context.sendBroadcast(intent2x2)
    }

    AsyncFunction("getStorageStats") {
      try {
        val path = Environment.getDataDirectory().path
        val stat = StatFs(path)
        val blockSize = stat.blockSizeLong
        val totalBlocks = stat.blockCountLong
        val availableBlocks = stat.availableBlocksLong

        val totalBytes = totalBlocks * blockSize
        val freeBytes = availableBlocks * blockSize
        val usedBytes = totalBytes - freeBytes

        mapOf(
          "totalBytes" to totalBytes,
          "freeBytes" to freeBytes,
          "usedBytes" to usedBytes
        )
      } catch (e: Exception) {
        mapOf(
          "totalBytes" to 0L,
          "freeBytes" to 0L,
          "usedBytes" to 0L
        )
      }
    }

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

    AsyncFunction("readMetadata") { filePath: String ->
      val path = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
      val file = File(path)
      if (!file.exists()) throw Exception("Archivo no encontrado: $path")

      try {
        val audioFile = AudioFileIO.read(file)
        val tag = audioFile.tag
        val title = tag?.getFirst(FieldKey.TITLE) ?: ""
        val artist = tag?.getFirst(FieldKey.ARTIST) ?: ""
        val album = tag?.getFirst(FieldKey.ALBUM) ?: ""
        val year = tag?.getFirst(FieldKey.YEAR) ?: ""
        val track = tag?.getFirst(FieldKey.TRACK) ?: ""
        val genre = tag?.getFirst(FieldKey.GENRE) ?: ""
        val albumArtist = tag?.getFirst(FieldKey.ALBUM_ARTIST) ?: ""
        val discNumber = tag?.getFirst(FieldKey.DISC_NO) ?: ""

        mapOf(
          "title" to title,
          "artist" to artist,
          "album" to album,
          "year" to year,
          "trackNumber" to track,
          "genre" to genre,
          "albumArtist" to albumArtist,
          "discNumber" to discNumber
        )
      } catch (e: Exception) {
        mapOf(
          "title" to "",
          "artist" to "",
          "album" to "",
          "year" to "",
          "trackNumber" to "",
          "genre" to "",
          "albumArtist" to "",
          "discNumber" to ""
        )
      }
    }

    AsyncFunction("updateMetadata") { filePath: String, metadata: Map<String, Any?>, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_CONTEXT", "React context is null", null)
        return@AsyncFunction
      }

      val title = metadata["title"] as? String
      val artist = metadata["artist"] as? String
      val album = metadata["album"] as? String
      val year = (metadata["year"] as? Number)?.toInt()
      val trackNumber = (metadata["trackNumber"] as? Number)?.toInt()
      val genre = metadata["genre"] as? String
      val coverArtPath = metadata["coverArtPath"] as? String
      val albumArtist = metadata["albumArtist"] as? String
      val discNumber = (metadata["discNumber"] as? Number)?.toInt()

      try {
        val success = tryWriteMetadata(filePath, title, artist, album, year, trackNumber, genre, coverArtPath, albumArtist, discNumber)
        promise.resolve(success)
      } catch (e: SecurityException) {
        handleSecurityException(e, filePath, title, artist, album, year, trackNumber, genre, coverArtPath, albumArtist, discNumber, promise)
      } catch (e: java.io.IOException) {
        val cause = e.cause
        if (cause is SecurityException) {
          handleSecurityException(cause, filePath, title, artist, album, year, trackNumber, genre, coverArtPath, albumArtist, discNumber, promise)
        } else {
          val sw = java.io.StringWriter()
          e.printStackTrace(java.io.PrintWriter(sw))
          promise.reject("ERR_WRITE_FAILED", "IOException: ${e.javaClass.name} - ${e.message}\n$sw", e)
        }
      } catch (e: Exception) {
        val sw = java.io.StringWriter()
        e.printStackTrace(java.io.PrintWriter(sw))
        promise.reject("ERR_WRITE_FAILED", "Failed to write tags: ${e.javaClass.name} - ${e.message}\n$sw", e)
      }
    }

    AsyncFunction("updateMetadataBatch") { metadataListJson: String, promise: Promise ->
      try {
        val jsonArray = org.json.JSONArray(metadataListJson)
        val list = mutableListOf<Map<String, Any?>>()
        for (i in 0 until jsonArray.length()) {
          val itemObj = jsonArray.getJSONObject(i)
          val filePath = itemObj.getString("filePath")
          val metadataObj = itemObj.getJSONObject("metadata")
          
          val metadataMap = mutableMapOf<String, Any?>()
          val keys = metadataObj.keys()
          while (keys.hasNext()) {
            val key = keys.next()
            if (metadataObj.isNull(key)) {
              metadataMap[key] = null
            } else {
              val value = metadataObj.get(key)
              metadataMap[key] = value
            }
          }
          
          list.add(mapOf(
            "filePath" to filePath,
            "metadata" to metadataMap
          ))
        }
        pendingBatchList = list
        pendingBatchIndex = 0
        executeBatchWrite(promise)
      } catch (e: Exception) {
        promise.reject("ERR_JSON_PARSE", "Failed to parse batch JSON: ${e.message}", e)
      }
    }

    AsyncFunction("cancelUpdateMetadataBatch") {
      isBatchCancelled = true
    }

    AsyncFunction("scanMultipleFiles") { filePaths: List<String>, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_CONTEXT", "React context is null", null)
        return@AsyncFunction
      }

      val cleanPaths = filePaths.map { path ->
        if (path.startsWith("file://")) path.substring(7) else path
      }.toTypedArray()

      try {
        MediaScannerConnection.scanFile(context, cleanPaths, null) { _, _ -> }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("ERR_SCAN_FAILED", "Failed to scan files: ${e.message}", e)
      }
    }

    AsyncFunction("requestWritePermission") { filePaths: List<String>, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_CONTEXT", "React context is null", null)
        return@AsyncFunction
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val uris = filePaths.mapNotNull { getUriForPath(it) }
        if (uris.isNotEmpty()) {
          pendingPromise = promise
          pendingFilePath = null
          pendingTitle = null
          pendingArtist = null
          pendingAlbum = null
          pendingYear = null
          pendingTrackNumber = null
          pendingGenre = null
          pendingCoverArtPath = null
          pendingAlbumArtist = null
          pendingDiscNumber = null
          pendingBatchList = null
          pendingBatchIndex = 0

          val pendingIntent = MediaStore.createWriteRequest(context.contentResolver, uris)
          val currentActivity = appContext.currentActivity
          if (currentActivity != null) {
            currentActivity.startIntentSenderForResult(
              pendingIntent.intentSender,
              REQUEST_CODE_WRITE,
              null, 0, 0, 0
            )
          } else {
            promise.reject("ERR_NO_ACTIVITY", "No active activity to request permission", null)
          }
        } else {
          promise.resolve(true)
        }
      } else {
        promise.resolve(true)
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == REQUEST_CODE_WRITE) {
        val promise = pendingPromise
        val filePath = pendingFilePath
        if (promise == null) {
          clearPending()
          return@OnActivityResult
        }

        if (filePath == null) {
          if (payload.resultCode == Activity.RESULT_OK) {
            promise.resolve(true)
          } else {
            promise.reject("ERR_PERMISSION_DENIED", "Write permission was denied by user", null)
          }
          clearPending()
          return@OnActivityResult
        }

        if (payload.resultCode == Activity.RESULT_OK) {
          try {
            val success = tryWriteMetadata(
              filePath,
              pendingTitle,
              pendingArtist,
              pendingAlbum,
              pendingYear,
              pendingTrackNumber,
              pendingGenre,
              pendingCoverArtPath,
              pendingAlbumArtist,
              pendingDiscNumber
            )
            val batchList = pendingBatchList
            if (batchList != null) {
              pendingBatchIndex++
              executeBatchWrite(promise)
            } else {
              promise.resolve(success)
              clearPending()
            }
          } catch (e: Exception) {
            promise.reject("ERR_WRITE_FAILED_AFTER_PERM", "Failed to write tags after getting permission: ${e.message}", e)
            clearPending()
          }
        } else {
          promise.reject("ERR_PERMISSION_DENIED", "Write permission was denied by user", null)
          clearPending()
        }
      }
    }

    AsyncFunction("acquireCastWakeLock") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        if (castWakeLock == null) {
          val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
          castWakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MMPlayer:LocalCastWakeLock").apply {
            setReferenceCounted(false)
          }
        }
        if (castWakeLock?.isHeld != true) {
          castWakeLock?.acquire(24 * 60 * 60 * 1000L) // Safe max 24 hours
        }

        if (castWifiLock == null) {
          val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
          castWifiLock = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "MMPlayer:LocalCastWifiLock")
          } else {
            @Suppress("DEPRECATION")
            wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MMPlayer:LocalCastWifiLock")
          }.apply {
            setReferenceCounted(false)
          }
        }
        if (castWifiLock?.isHeld != true) {
          castWifiLock?.acquire()
        }
        Log.d("NativeAudioScanner", "LocalCast WakeLock & WifiLock acquired successfully")
        true
      } catch (e: Exception) {
        Log.e("NativeAudioScanner", "Error acquiring Cast locks: ${e.message}", e)
        false
      }
    }

    AsyncFunction("releaseCastWakeLock") {
      try {
        if (castWakeLock?.isHeld == true) {
          castWakeLock?.release()
        }
        if (castWifiLock?.isHeld == true) {
          castWifiLock?.release()
        }
        Log.d("NativeAudioScanner", "LocalCast WakeLock & WifiLock released successfully")
        true
      } catch (e: Exception) {
        Log.e("NativeAudioScanner", "Error releasing Cast locks: ${e.message}", e)
        false
      }
    }

    AsyncFunction("isBatteryOptimizationIgnored") {
      val context = appContext.reactContext ?: return@AsyncFunction true
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
          powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
          true
        }
      } catch (e: Exception) {
        Log.e("NativeAudioScanner", "Error checking battery optimization: ${e.message}", e)
        true
      }
    }

    AsyncFunction("requestIgnoreBatteryOptimizations") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
          if (!powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
              data = Uri.parse("package:${context.packageName}")
            }
            activity.startActivity(intent)
            true
          } else {
            true
          }
        } else {
          true
        }
      } catch (e: Exception) {
        Log.w("NativeAudioScanner", "Direct request battery optimization failed, opening general battery settings: ${e.message}")
        try {
          val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
          activity.startActivity(intent)
          true
        } catch (err: Exception) {
          try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
              data = Uri.parse("package:${context.packageName}")
            }
            activity.startActivity(intent)
            true
          } catch (fallbackErr: Exception) {
            Log.e("NativeAudioScanner", "All battery optimization intent fallbacks failed", fallbackErr)
            false
          }
        }
      }
    }
  }
}