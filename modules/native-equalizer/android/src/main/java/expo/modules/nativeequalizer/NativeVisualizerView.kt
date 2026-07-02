package expo.modules.nativeequalizer

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.media.audiofx.Visualizer
import android.util.Log
import android.view.Choreographer
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView
import kotlin.math.hypot
import kotlin.math.log10

private const val TAG = "NativeVisualizer"

class NativeVisualizerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

    private var active = false
    private var typeStr = "bars"

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.parseColor("#8B5CF6")
    }

    // Audio data updated at max Visualizer rate (~20Hz)
    @Volatile private var waveBytes: ByteArray? = null
    @Volatile private var fftBytes: ByteArray? = null
    private var captureListener: Visualizer.OnDataCaptureListener? = null

    // Render loop driven by Choreographer at screen refresh rate (60/90/120Hz)
    private var frameCallback: Choreographer.FrameCallback? = null
    private var isRenderLoopRunning = false

    private var smoothedMagnitudes = FloatArray(20)
    private val numBars = 20
    private val decay = 0.80f

    private var circleSmoothed = FloatArray(60)
    private val numCircleBars = 60

    init {
        setBackgroundColor(Color.TRANSPARENT)
        Log.d(TAG, "NativeVisualizerView CREATED")
    }

    fun setColor(hexOrRgba: String) {
        try {
            paint.color = resolveColor(hexOrRgba)
        } catch (e: Exception) {
            paint.color = Color.parseColor("#8B5CF6")
        }
        invalidate()
    }

    private fun resolveColor(color: String): Int {
        if (color.startsWith("rgba(")) {
            val parts = color.removePrefix("rgba(").removeSuffix(")").split(",").map { it.trim() }
            return Color.argb((parts[3].toFloat() * 255).toInt(), parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
        }
        if (color.startsWith("rgb(")) {
            val parts = color.removePrefix("rgb(").removeSuffix(")").split(",").map { it.trim() }
            return Color.rgb(parts[0].toInt(), parts[1].toInt(), parts[2].toInt())
        }
        return Color.parseColor(color)
    }

    fun setType(type: String) {
        Log.d(TAG, "setType($type)")
        typeStr = type
        invalidate()
    }

    fun setActive(value: Boolean) {
        Log.d(TAG, "setActive($value)")
        active = value
        if (value) attachToSharedVisualizer() else detachFromSharedVisualizer()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        Log.d(TAG, "onAttachedToWindow — active=$active")
        if (active) attachToSharedVisualizer()
    }

    override fun onDetachedFromWindow() {
        Log.d(TAG, "onDetachedFromWindow")
        stopRenderLoop()
        detachFromSharedVisualizer()
        super.onDetachedFromWindow()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        Log.d(TAG, "onSizeChanged: ${w}x${h}")
    }

    private fun hasAudioPermission(): Boolean {
        val ctx = context ?: return false
        return ctx.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
    }

    // --- Choreographer render loop (capped at TARGET_FPS) ---

    private val targetFps = 40
    private val frameIntervalNs = 1_000_000_000L / targetFps // 25ms en nanosegundos
    private var lastFrameTimeNs = 0L

    private fun startRenderLoop() {
        if (isRenderLoopRunning) return
        isRenderLoopRunning = true
        lastFrameTimeNs = 0L
        val cb = object : Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                if (!isRenderLoopRunning) return
                if (frameTimeNanos - lastFrameTimeNs >= frameIntervalNs) {
                    lastFrameTimeNs = frameTimeNanos
                    invalidate()
                }
                Choreographer.getInstance().postFrameCallback(this)
            }
        }
        frameCallback = cb
        Choreographer.getInstance().postFrameCallback(cb)
        Log.d(TAG, "startRenderLoop: started at ${targetFps}fps cap")
    }

    private fun stopRenderLoop() {
        isRenderLoopRunning = false
        frameCallback?.let { Choreographer.getInstance().removeFrameCallback(it) }
        frameCallback = null
        Log.d(TAG, "stopRenderLoop: render loop stopped")
    }

    // --- Visualizer attachment ---

    private fun attachToSharedVisualizer() {
        detachFromSharedVisualizer()
        if (!hasAudioPermission()) {
            Log.w(TAG, "attachToSharedVisualizer: RECORD_AUDIO permission NOT granted. Aborting.")
            return
        }

        var viz = NativeEqualizerModule.sharedVisualizer
        if (viz == null) {
            Log.d(TAG, "attachToSharedVisualizer: sharedVisualizer null, resolving session...")
            val sessionId = NativeEqualizerModule.getAudioSessionId(appContext)
            if (sessionId != 0) {
                NativeEqualizerModule.initSharedVisualizer(sessionId)
                viz = NativeEqualizerModule.sharedVisualizer
            }
        }

        if (viz == null) {
            Log.e(TAG, "attachToSharedVisualizer: sharedVisualizer unavailable")
            return
        }

        captureListener = object : Visualizer.OnDataCaptureListener {
            override fun onWaveFormDataCapture(v: Visualizer?, waveform: ByteArray?, samplingRate: Int) {
                waveBytes = waveform
            }
            override fun onFftDataCapture(v: Visualizer?, fft: ByteArray?, samplingRate: Int) {
                fftBytes = fft
            }
        }

        try {
            viz.enabled = false
            val result = viz.setDataCaptureListener(
                captureListener,
                Visualizer.getMaxCaptureRate(), // max 20Hz audio data refresh
                true,
                true
            )
            viz.enabled = true
            Log.d(TAG, "attachToSharedVisualizer: listener attached result=$result, enabled=${viz.enabled}")
        } catch (e: Exception) {
            Log.e(TAG, "attachToSharedVisualizer: EXCEPTION: ${e.message}", e)
            return
        }

        startRenderLoop()
    }

    private fun detachFromSharedVisualizer() {
        stopRenderLoop()
        try {
            val viz = NativeEqualizerModule.sharedVisualizer
            if (viz != null && captureListener != null) {
                viz.enabled = false
                viz.setDataCaptureListener(null, 0, false, false)
                Log.d(TAG, "detachFromSharedVisualizer: listener removed")
            }
        } catch (e: Exception) {
            Log.w(TAG, "detachFromSharedVisualizer: ${e.message}")
        }
        captureListener = null
        waveBytes = null
        fftBytes = null
    }

    // --- Drawing ---

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0 || h <= 0) return

        if (!hasAudioPermission()) {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 2f
            paint.color = Color.parseColor("#444444")
            canvas.drawLine(0f, h / 2, w, h / 2, paint)
            return
        }

        if (captureListener == null && active) {
            attachToSharedVisualizer()
        }

        when (typeStr) {
            "bars"     -> drawBars(canvas, w, h)
            "wave"     -> drawWave(canvas, w, h)
            "spectrum" -> drawSpectrum(canvas, w, h)
            "circle"   -> drawCircle(canvas, w, h)
        }
    }

    private fun drawCircle(canvas: Canvas, w: Float, h: Float) {
        val cx = w / 2f
        val cy = h / 2f
        val baseRadius = minOf(cx, cy) * 0.45f

        val fft = fftBytes
        if (fft == null) {
            paint.style = Paint.Style.STROKE
            paint.strokeWidth = 4f
            canvas.drawCircle(cx, cy, baseRadius, paint)
            paint.style = Paint.Style.FILL
            return
        }

        val binSize = maxOf(1, (fft.size / 2) / numCircleBars)
        for (i in 0 until numCircleBars) {
            var sum = 0f
            for (j in 0 until binSize) {
                val idx = 2 * (i * binSize + j)
                if (idx + 1 < fft.size) {
                    sum += hypot(fft[idx].toFloat(), fft[idx + 1].toFloat())
                }
            }
            val avg = sum / binSize
            val target = (log10(avg.toDouble() + 1.0) * (baseRadius * 0.9f)).toFloat().coerceAtMost(baseRadius * 1.5f)
            circleSmoothed[i] = maxOf(circleSmoothed[i] * decay, target)
        }

        val avgMag = circleSmoothed.average().toFloat()
        val coreRadius = baseRadius + (avgMag * 0.15f)
        
        val originalColor = paint.color
        val alpha = (Color.alpha(originalColor) * 0.15f).toInt()
        paint.color = Color.argb(alpha, Color.red(originalColor), Color.green(originalColor), Color.blue(originalColor))
        paint.style = Paint.Style.FILL
        canvas.drawCircle(cx, cy, coreRadius, paint)

        paint.color = originalColor
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 5f
        paint.strokeCap = Paint.Cap.ROUND

        for (i in 0 until numCircleBars) {
            val angleRad = (i * 2.0 * Math.PI / numCircleBars).toFloat()
            val cos = Math.cos(angleRad.toDouble()).toFloat()
            val sin = Math.sin(angleRad.toDouble()).toFloat()

            val xStart = cx + coreRadius * cos
            val yStart = cy + coreRadius * sin
            
            val barLen = circleSmoothed[i]
            val xEnd = cx + (coreRadius + barLen) * cos
            val yEnd = cy + (coreRadius + barLen) * sin

            canvas.drawLine(xStart, yStart, xEnd, yEnd, paint)
        }
        
        paint.style = Paint.Style.FILL
        paint.strokeCap = Paint.Cap.BUTT
    }

    private fun drawBars(canvas: Canvas, w: Float, h: Float) {
        val fft = fftBytes ?: run {
            // Draw flat minimum bars so the visualizer isn't invisible while waiting
            paint.style = Paint.Style.FILL
            val barWidth = w / numBars
            for (i in 0 until numBars) {
                smoothedMagnitudes[i] *= decay
                val barH = maxOf(smoothedMagnitudes[i], 4f)
                canvas.drawRoundRect(i * barWidth + 4f, h - barH, (i + 1) * barWidth - 4f, h, 8f, 8f, paint)
            }
            return
        }

        val barWidth = w / numBars
        val binSize = maxOf(1, (fft.size / 2) / numBars)

        for (i in 0 until numBars) {
            var sum = 0f
            for (j in 0 until binSize) {
                val idx = 2 * (i * binSize + j)
                if (idx + 1 < fft.size) sum += hypot(fft[idx].toFloat(), fft[idx + 1].toFloat())
            }
            val avg = sum / binSize
            val target = (log10(avg.toDouble() + 1.0) * (h * 0.9f)).toFloat().coerceAtMost(h)
            smoothedMagnitudes[i] = maxOf(smoothedMagnitudes[i] * decay, target)
        }

        paint.style = Paint.Style.FILL
        for (i in 0 until numBars) {
            val barH = maxOf(smoothedMagnitudes[i], 4f)
            canvas.drawRoundRect(i * barWidth + 4f, h - barH, (i + 1) * barWidth - 4f, h, 8f, 8f, paint)
        }
    }

    private fun drawWave(canvas: Canvas, w: Float, h: Float) {
        val wave = waveBytes ?: return
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 4f
        val path = Path()
        val step = maxOf(1, wave.size / 256)
        val points = minOf(256, wave.size / step)
        for (i in 0 until points) {
            val idx = minOf(i * step, wave.size - 1)
            val value = ((wave[idx].toInt() and 0xFF) - 128).toFloat() / 128f
            val x = (i.toFloat() / (points - 1)) * w
            val y = (h / 2f) + value * (h * 0.4f)
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        canvas.drawPath(path, paint)
        paint.style = Paint.Style.FILL
    }

    private fun drawSpectrum(canvas: Canvas, w: Float, h: Float) {
        val fft = fftBytes ?: return
        val points = 60
        val binSize = maxOf(1, (fft.size / 2) / points)
        val path = Path()
        path.moveTo(0f, h)
        for (i in 0 until points) {
            var sum = 0f
            for (j in 0 until binSize) {
                val idx = 2 * (i * binSize + j)
                if (idx + 1 < fft.size) sum += hypot(fft[idx].toFloat(), fft[idx + 1].toFloat())
            }
            val mag = (log10((sum / binSize).toDouble() + 1.0) * (h * 0.7f)).toFloat()
            path.lineTo(i * (w / (points - 1)), h - maxOf(mag, 3f))
        }
        path.lineTo(w, h)
        path.close()
        paint.style = Paint.Style.FILL
        canvas.drawPath(path, paint)
    }
}
