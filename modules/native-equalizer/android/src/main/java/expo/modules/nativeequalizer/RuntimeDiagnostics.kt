package expo.modules.nativeequalizer

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.graphics.Color
import androidx.palette.graphics.Palette
import org.json.JSONObject
import java.io.File
import android.os.Handler
import android.os.HandlerThread
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Release diagnostics: read-only reflection checks and isolated scratch resources. */
internal object RuntimeDiagnostics {
    private var installed = false
    private const val PREFS = "mmplayer_runtime_errors"

    @Synchronized fun install(context: Context) {
        if (installed) return
        installed = true
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, error ->
            try {
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putString("lastCrash", "${System.currentTimeMillis()} ${thread.name}\n${error.stackTraceToString().take(24000)}").commit()
            } catch (_: Exception) { }
            previous?.uncaughtException(thread, error)
        }
    }

    fun errors(context: Context): String {
        val previous = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("lastCrash", "") ?: ""
        // Android exposes only this application's logs; never clear the system log.
        val process = ProcessBuilder("logcat", "-d", "-t", "200", "--pid=${android.os.Process.myPid()}", "*:E")
            .redirectErrorStream(true).start()
        return try {
            process.inputStream.bufferedReader().use { previous + "\n" + it.readText().takeLast(40000) }
        } finally { process.destroy() }
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("lastCrash").apply()
    }

    fun run(context: Context): List<Map<String, Any>> {
        val results = mutableListOf<Map<String, Any>>()
        fun test(name: String, block: () -> Unit) {
            val start = System.currentTimeMillis()
            try {
                block()
                results.add(mapOf("name" to name, "status" to "pass", "detail" to "OK", "durationMs" to System.currentTimeMillis() - start))
            } catch (error: Throwable) {
                results.add(mapOf("name" to name, "status" to "fail", "detail" to error.stackTraceToString().take(8000), "durationMs" to System.currentTimeMillis() - start))
            }
        }
        val serviceName = "com.doublesymmetry.trackplayer.service.MusicService"
        val bridgeName = "com.doublesymmetry.trackplayer.service.AndroidAutoBridge"
        val signatures = listOf(
            Triple(serviceName, "setTransportPlaying", arrayOf(Boolean::class.javaPrimitiveType!!, Double::class.javaPrimitiveType!!, Int::class.javaPrimitiveType!!)),
            Triple(serviceName, "configureTimestamps", arrayOf(String::class.java)),
            Triple(serviceName, "markTimestampSeek", arrayOf(Boolean::class.javaPrimitiveType!!, Double::class.javaPrimitiveType!!)),
            Triple(serviceName, "finishTimestampSeek", emptyArray()),
            Triple(serviceName, "crossfadePlaybackSnapshot", emptyArray()),
            Triple(serviceName, "applyCrossfadePolicy", emptyArray()),
            Triple(serviceName, "invalidateAndroidAuto", emptyArray()),
            Triple(serviceName, "updateAndroidAutoState", arrayOf(String::class.java)),
            Triple(bridgeName, "setListener", arrayOf(java.util.function.Consumer::class.java)),
            Triple(bridgeName, "complete", arrayOf(String::class.java, String::class.java)),
            Triple(bridgeName, "isPending", arrayOf(String::class.java)),
        )
        for ((className, method, types) in signatures) test("R8 reflection: $method") {
            check(java.lang.reflect.Modifier.isStatic(Class.forName(className).getMethod(method, *types).modifiers))
        }
        test("Native transport fade: play, pause and rapid resume (isolated)") {
            val thread = HandlerThread("MMPlayerFadeDiagnostic").apply { start() }
            val handler = Handler(thread.looper)
            var volume = 0.8f
            var playing = false
            var controller: Any? = null
            val type = Class.forName("com.doublesymmetry.trackplayer.service.TransportFadeController")
            fun onLooper(delay: Long = 0, block: () -> Unit) {
                val latch = CountDownLatch(1)
                val failure = AtomicReference<Throwable?>(null)
                handler.postDelayed({
                    try { block() } catch (error: Throwable) { failure.set(error) } finally { latch.countDown() }
                }, delay)
                check(latch.await(3, TimeUnit.SECONDS)) { "Fade test timed out" }
                failure.get()?.let { throw it }
            }
            try {
                onLooper {
                    controller = type.getConstructor(Handler::class.java, Function0::class.java, Function1::class.java,
                        Function0::class.java, Function0::class.java, Function0::class.java).newInstance(handler,
                        { volume }, { value: Float -> volume = value }, { playing }, { playing = true }, { playing = false })
                    type.getMethod("setPlaying", Boolean::class.javaPrimitiveType, Float::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                        .invoke(controller, true, 0.8f, 100)
                    check(playing && volume == 0f) { "Play did not start immediately at zero volume" }
                }
                onLooper(180) { check(playing && kotlin.math.abs(volume - 0.8f) < 0.01f) { "Fade-in did not reach target" } }
                onLooper {
                    type.getMethod("setPlaying", Boolean::class.javaPrimitiveType, Float::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                        .invoke(controller, false, 0.8f, 100)
                }
                onLooper(180) { check(!playing && volume == 0f) { "Fade-out did not pause at zero volume" } }
                onLooper {
                    val set = type.getMethod("setPlaying", Boolean::class.javaPrimitiveType, Float::class.javaPrimitiveType, Int::class.javaPrimitiveType)
                    set.invoke(controller, true, 0.8f, 100)
                    set.invoke(controller, false, 0.8f, 100)
                    set.invoke(controller, true, 0.8f, 100)
                }
                onLooper(180) { check(playing && kotlin.math.abs(volume - 0.8f) < 0.01f) { "Rapid resume was lost" } }
            } finally {
                try { onLooper { controller?.let { type.getMethod("cancel", Boolean::class.javaPrimitiveType).invoke(it, false) } } }
                finally { thread.quitSafely() }
            }
        }
        test("SQLite: transaction, join and aggregation") {
            SQLiteDatabase.create(null).use { db ->
                db.execSQL("CREATE TABLE ratings (id TEXT PRIMARY KEY, rating REAL)")
                db.execSQL("INSERT INTO ratings VALUES ('one', 4), ('two', 5)")
                db.rawQuery("SELECT AVG(a.rating) FROM ratings a JOIN ratings b ON a.id = b.id", null).use { cursor ->
                    check(cursor.moveToFirst() && cursor.getDouble(0) == 4.5)
                }
            }
        }
        test("Palette: native artwork colour extraction") {
            val bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
            try {
                // Palette's default filter deliberately rejects near-red hues
                // between 10 and 37 degrees at moderate saturation. Use blue
                // here so a legitimately filtered swatch is not an R8 failure.
                bitmap.eraseColor(Color.rgb(40, 100, 200))
                val color = Palette.from(bitmap).generate().getDominantColor(Color.BLACK)
                check(Color.blue(color) > Color.red(color) && Color.blue(color) > 100) {
                    "Expected a blue swatch; Palette returned #${Integer.toHexString(color)}"
                }
            } finally { bitmap.recycle() }
        }
        test("Palette: default filter excludes near-red swatches") {
            val bitmap = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
            try {
                bitmap.eraseColor(Color.rgb(200, 80, 40))
                check(Palette.from(bitmap).generate().dominantSwatch == null) {
                    "Expected the default near-red filter to discard the orange sample"
                }
            } finally { bitmap.recycle() }
        }
        test("Native JSON and private resource storage") {
            val file = File.createTempFile("diagnostics-", ".json", context.cacheDir)
            try {
                file.writeText(JSONObject().put("color", "#fa8072").put("rating", 4.5).toString())
                val decoded = JSONObject(file.readText())
                check(decoded.getString("color") == "#fa8072" && decoded.getDouble("rating") == 4.5)
            } finally { file.delete() }
        }
        return results
    }
}
