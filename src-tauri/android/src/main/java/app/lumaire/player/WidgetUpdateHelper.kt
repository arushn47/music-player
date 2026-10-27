package app.lumaire.player

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import java.io.File
import java.io.InputStream
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors

data class NativeLyricLine(val timeMs: Long, val text: String)

data class ExtractedColors(
    val bgGradientStart: Int,
    val bgGradientEnd: Int,
    val strokeColor: Int,
    val primaryTextColor: Int,
    val secondaryTextColor: Int,
    val accentColor: Int
)

/**
 * Thread-safe mediator coordinating native Android home-screen widgets,
 * adaptive sizing, dynamic color extraction from album artwork,
 * battery-efficient progress bar sync, and live lyrics.
 */
object WidgetUpdateHelper {
    const val ACTION_PLAY_PAUSE = "app.lumaire.player.ACTION_WIDGET_PLAY_PAUSE"
    const val ACTION_PREV = "app.lumaire.player.ACTION_WIDGET_PREV"
    const val ACTION_NEXT = "app.lumaire.player.ACTION_WIDGET_NEXT"

    private const val PREFS_NAME = "lumaire_widget_prefs"
    private const val KEY_THEME_MODE = "theme_mode"
    private const val KEY_ACCENT_COLOR = "accent_color"

    @Volatile var title: String = "Not Playing"
    @Volatile var artist: String = "Lumaire"
    @Volatile var artworkUri: String? = null
    @Volatile var artworkBitmap: Bitmap? = null
    @Volatile var isPlaying: Boolean = false
    @Volatile var currentPositionMs: Long = 0L
    @Volatile var durationMs: Long = 0L
    @Volatile var pendingAction: String? = null

    @Volatile var themeMode: String = "dark"
    @Volatile var accentColor: String = "#A78BFA"
    private var prefsLoaded = false

    @Volatile var activeTrackId: String? = null
    val lyricLines = CopyOnWriteArrayList<NativeLyricLine>()
    @Volatile var prevLyricText: String = ""
    @Volatile var currentLyricText: String = "Not playing"
    @Volatile var nextLyricText: String = "Play music in Lumaire"
    @Volatile var next2LyricText: String = ""

    private var cachedExtractedColors: ExtractedColors? = null
    private var cachedArtSource: Bitmap? = null

    private var playerRef: WeakReference<ExoPlayer>? = null
    private var contextRef: WeakReference<Context>? = null
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private val ioExecutor by lazy { Executors.newSingleThreadExecutor() }

    private val lyricTickRunnable = Runnable {
        val ctx = contextRef?.get() ?: return@Runnable
        evaluateLyrics(ctx)
    }

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(playing: Boolean) {
            isPlaying = playing
            val ctx = contextRef?.get() ?: return
            updateNowPlayingWidgets(ctx)
            evaluateLyrics(ctx)
        }

        override fun onPlaybackStateChanged(state: Int) {
            val player = playerRef?.get() ?: return
            currentPositionMs = player.currentPosition.coerceAtLeast(0L)
            durationMs = player.duration.coerceAtLeast(0L)
            val ctx = contextRef?.get() ?: return
            updateNowPlayingWidgets(ctx)
            evaluateLyrics(ctx)
        }

        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            val metadata = mediaItem?.mediaMetadata
            val newTitle = metadata?.title?.toString()
            val newArtist = metadata?.artist?.toString()
            val newArt = metadata?.artworkUri?.toString()
            val mediaId = mediaItem?.mediaId
            if (mediaId != null && mediaId != activeTrackId) {
                activeTrackId = mediaId
                lyricLines.clear()
                prevLyricText = ""
                currentLyricText = "•••"
                nextLyricText = ""
                next2LyricText = ""
            }
            val ctx = contextRef?.get() ?: return
            updateTrackInfo(ctx, newTitle, newArtist, newArt)
        }

        override fun onPositionDiscontinuity(
            oldPosition: Player.PositionInfo,
            newPosition: Player.PositionInfo,
            reason: Int
        ) {
            currentPositionMs = newPosition.positionMs
            val ctx = contextRef?.get() ?: return
            evaluateLyrics(ctx)
        }
    }

    private fun ensurePrefsLoaded(context: Context) {
        if (prefsLoaded) return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        themeMode = prefs.getString(KEY_THEME_MODE, "dark") ?: "dark"
        accentColor = prefs.getString(KEY_ACCENT_COLOR, "#A78BFA") ?: "#A78BFA"
        prefsLoaded = true
    }

    fun setTheme(context: Context, mode: String, accent: String) {
        themeMode = mode
        accentColor = accent
        cachedExtractedColors = null
        prefsLoaded = true
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_THEME_MODE, mode).putString(KEY_ACCENT_COLOR, accent).apply()
        updateNowPlayingWidgets(context)
        updateLyricsWidgets(context)
    }

    fun attachPlayer(context: Context, player: ExoPlayer) {
        contextRef = WeakReference(context.applicationContext)
        playerRef = WeakReference(player)
        ensurePrefsLoaded(context)
        player.addListener(playerListener)
        isPlaying = player.isPlaying
        currentPositionMs = player.currentPosition.coerceAtLeast(0L)
        durationMs = player.duration.coerceAtLeast(0L)
        updateNowPlayingWidgets(context)
        evaluateLyrics(context)
    }

    fun detachPlayer() {
        mainHandler.removeCallbacks(lyricTickRunnable)
        playerRef?.get()?.removeListener(playerListener)
        playerRef = null
    }

    fun togglePlayPause(context: Context) {
        val player = playerRef?.get()
        if (player != null) {
            if (player.isPlaying) {
                player.pause()
                isPlaying = false
            } else {
                if (player.playbackState == Player.STATE_IDLE) {
                    player.prepare()
                }
                player.play()
                isPlaying = true
            }
        } else {
            isPlaying = !isPlaying
        }
        updateNowPlayingWidgets(context)
        evaluateLyrics(context)
    }

    fun skipNext(context: Context) {
        val player = playerRef?.get()
        if (player != null && player.hasNextMediaItem()) {
            player.seekToNextMediaItem()
        } else {
            pendingAction = "next"
        }
        updateNowPlayingWidgets(context)
    }

    fun skipPrevious(context: Context) {
        val player = playerRef?.get()
        if (player != null && player.currentPosition > 3000L) {
            player.seekTo(0L)
        } else if (player != null && player.hasPreviousMediaItem()) {
            player.seekToPreviousMediaItem()
        } else {
            pendingAction = "prev"
        }
        updateNowPlayingWidgets(context)
    }

    fun consumePendingAction(): String? {
        val action = pendingAction
        pendingAction = null
        return action
    }

    fun updateTrackInfo(context: Context, newTitle: String?, newArtist: String?, newArtworkUri: String?) {
        title = if (newTitle.isNullOrBlank()) "Not Playing" else newTitle
        artist = if (newArtist.isNullOrBlank()) "Lumaire" else newArtist
        val oldArt = artworkUri
        artworkUri = newArtworkUri

        if (newArtworkUri != oldArt) {
            artworkBitmap = null
            cachedExtractedColors = null
            if (!newArtworkUri.isNullOrBlank()) {
                loadArtworkAsync(context, newArtworkUri)
            }
        }
        updateNowPlayingWidgets(context)
        evaluateLyrics(context)
    }

    fun setLyrics(context: Context, trackId: String, lines: List<NativeLyricLine>) {
        activeTrackId = trackId
        lyricLines.clear()
        lyricLines.addAll(lines.sortedBy { it.timeMs })
        evaluateLyrics(context)
    }

    private fun evaluateLyrics(context: Context) {
        val player = playerRef?.get()
        val pos = player?.currentPosition ?: currentPositionMs

        if (lyricLines.isEmpty()) {
            mainHandler.removeCallbacks(lyricTickRunnable)
            prevLyricText = ""
            next2LyricText = ""
            if (title == "Not Playing" || (!isPlaying && pos == 0L)) {
                currentLyricText = "Not playing"
                nextLyricText = "Play music in Lumaire"
            } else {
                currentLyricText = "No lyrics available"
                nextLyricText = ""
            }
            updateLyricsWidgets(context)
            return
        }

        var nextTargetMs: Long? = null
        if (pos < lyricLines[0].timeMs) {
            prevLyricText = ""
            currentLyricText = "•••"
            nextLyricText = lyricLines[0].text
            next2LyricText = if (lyricLines.size > 1) lyricLines[1].text else ""
            nextTargetMs = lyricLines[0].timeMs
        } else {
            var activeIdx = 0
            for (i in lyricLines.indices) {
                if (lyricLines[i].timeMs <= pos) {
                    activeIdx = i
                } else {
                    break
                }
            }
            prevLyricText = if (activeIdx > 0) lyricLines[activeIdx - 1].text else ""
            currentLyricText = lyricLines[activeIdx].text
            if (activeIdx + 1 < lyricLines.size) {
                nextLyricText = lyricLines[activeIdx + 1].text
                nextTargetMs = lyricLines[activeIdx + 1].timeMs
            } else {
                nextLyricText = ""
                nextTargetMs = null
            }
            next2LyricText = if (activeIdx + 2 < lyricLines.size) lyricLines[activeIdx + 2].text else ""
        }

        updateLyricsWidgets(context)

        mainHandler.removeCallbacks(lyricTickRunnable)
        if (isPlaying && nextTargetMs != null) {
            val delay = (nextTargetMs - pos).coerceIn(50L, 120000L)
            mainHandler.postDelayed(lyricTickRunnable, delay)
        }
    }

    private fun loadArtworkAsync(context: Context, uriString: String) {
        ioExecutor.execute {
            try {
                val bitmap = if (uriString.startsWith("https://", ignoreCase = true) || uriString.startsWith("http://", ignoreCase = true)) {
                    val url = URL(uriString)
                    val conn = (url.openConnection() as HttpURLConnection).apply {
                        connectTimeout = 4000
                        readTimeout = 4000
                        instanceFollowRedirects = true
                    }
                    conn.inputStream.use { input -> decodeSampledBitmap(input, 256, 256) }
                } else {
                    val path = if (uriString.startsWith("file://", ignoreCase = true)) {
                        Uri.parse(uriString).path ?: uriString.removePrefix("file://")
                    } else uriString
                    val file = File(path)
                    if (file.exists()) {
                        file.inputStream().use { input -> decodeSampledBitmap(input, 256, 256) }
                    } else null
                }

                if (bitmap != null) {
                    val rounded = getRoundedCornerBitmap(bitmap, 12f, context)
                    artworkBitmap = rounded
                    cachedExtractedColors = null
                    mainHandler.post {
                        updateNowPlayingWidgets(context)
                        updateLyricsWidgets(context)
                    }
                }
            } catch (_: Exception) {
                artworkBitmap = null
            }
        }
    }

    private fun decodeSampledBitmap(inputStream: InputStream, reqWidth: Int, reqHeight: Int): Bitmap? {
        val bytes = inputStream.readBytes()
        if (bytes.isEmpty() || bytes.size > 5 * 1024 * 1024) return null
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

        var inSampleSize = 1
        if (options.outHeight > reqHeight || options.outWidth > reqWidth) {
            val halfHeight = options.outHeight / 2
            val halfWidth = options.outWidth / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }

        val decodeOptions = BitmapFactory.Options().apply {
            this.inSampleSize = inSampleSize
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions)
    }

    private fun getRoundedCornerBitmap(bitmap: Bitmap, cornerRadiusDp: Float, context: Context): Bitmap {
        val density = context.resources.displayMetrics.density
        val radiusPx = cornerRadiusDp * density
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val shader = BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        paint.shader = shader
        val rect = RectF(0f, 0f, bitmap.width.toFloat(), bitmap.height.toFloat())
        canvas.drawRoundRect(rect, radiusPx, radiusPx, paint)
        return output
    }

    fun colorRgb(r: Int, g: Int, b: Int): Int =
        (0xFF shl 24) or ((r.coerceIn(0, 255) and 0xFF) shl 16) or ((g.coerceIn(0, 255) and 0xFF) shl 8) or (b.coerceIn(0, 255) and 0xFF)

    fun colorRed(color: Int): Int = (color shr 16) and 0xFF
    fun colorGreen(color: Int): Int = (color shr 8) and 0xFF
    fun colorBlue(color: Int): Int = color and 0xFF

    fun parseHexColor(hex: String?, defaultColor: Int): Int {
        if (hex.isNullOrBlank()) return defaultColor
        val clean = hex.trim().removePrefix("#")
        return try {
            when (clean.length) {
                6 -> {
                    val r = clean.substring(0, 2).toInt(16)
                    val g = clean.substring(2, 4).toInt(16)
                    val b = clean.substring(4, 6).toInt(16)
                    colorRgb(r, g, b)
                }
                8 -> {
                    val a = clean.substring(0, 2).toInt(16)
                    val r = clean.substring(2, 4).toInt(16)
                    val g = clean.substring(4, 6).toInt(16)
                    val b = clean.substring(6, 8).toInt(16)
                    ((a and 0xFF) shl 24) or ((r and 0xFF) shl 16) or ((g and 0xFF) shl 8) or (b and 0xFF)
                }
                else -> defaultColor
            }
        } catch (_: Exception) {
            defaultColor
        }
    }

    fun blendColors(foreground: Int, background: Int, bgWeight: Float): Int {
        val fgWeight = (1f - bgWeight).coerceIn(0f, 1f)
        val r = (colorRed(foreground) * fgWeight + colorRed(background) * bgWeight).toInt().coerceIn(0, 255)
        val g = (colorGreen(foreground) * fgWeight + colorGreen(background) * bgWeight).toInt().coerceIn(0, 255)
        val b = (colorBlue(foreground) * fgWeight + colorBlue(background) * bgWeight).toInt().coerceIn(0, 255)
        return colorRgb(r, g, b)
    }

    fun getAccessibleAccentColor(accentHex: String, isLight: Boolean): Int {
        val defaultAccent = if (isLight) colorRgb(124, 58, 237) else colorRgb(167, 139, 250)
        val accentInt = parseHexColor(accentHex, defaultAccent)

        val r = colorRed(accentInt)
        val g = colorGreen(accentInt)
        val b = colorBlue(accentInt)
        val lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0

        return if (isLight) {
            if (lum > 0.38) {
                val factor = (0.38 / lum).toFloat().coerceIn(0.25f, 0.90f)
                colorRgb(
                    (r * factor).toInt().coerceIn(0, 255),
                    (g * factor).toInt().coerceIn(0, 255),
                    (b * factor).toInt().coerceIn(0, 255)
                )
            } else {
                accentInt
            }
        } else {
            if (lum < 0.22) {
                val factor = 0.5f
                colorRgb(
                    (r + (255 - r) * factor).toInt().coerceIn(0, 255),
                    (g + (255 - g) * factor).toInt().coerceIn(0, 255),
                    (b + (255 - b) * factor).toInt().coerceIn(0, 255)
                )
            } else {
                accentInt
            }
        }
    }

    /**
     * Extracts muted tones from album artwork and blends them with Lumaire's dark/lavender
     * foundation to produce a cohesive, high-contrast palette.
     */
    fun extractColors(bitmap: Bitmap?, isLight: Boolean, customAccentHex: String?): ExtractedColors {
        if (bitmap == null) {
            return if (isLight) {
                ExtractedColors(
                    bgGradientStart = parseHexColor("#FAF8FF", colorRgb(250, 248, 255)),
                    bgGradientEnd = parseHexColor("#F1EDFD", colorRgb(241, 237, 253)),
                    strokeColor = parseHexColor("#E2DCF8", colorRgb(226, 220, 248)),
                    primaryTextColor = parseHexColor("#18181B", colorRgb(24, 24, 27)),
                    secondaryTextColor = parseHexColor("#6D28D9", colorRgb(109, 40, 217)),
                    accentColor = parseHexColor("#7C3AED", colorRgb(124, 58, 237))
                )
            } else {
                ExtractedColors(
                    bgGradientStart = parseHexColor("#181622", colorRgb(24, 22, 34)),
                    bgGradientEnd = parseHexColor("#100F17", colorRgb(16, 15, 23)),
                    strokeColor = parseHexColor("#2C263D", colorRgb(44, 38, 61)),
                    primaryTextColor = colorRgb(255, 255, 255),
                    secondaryTextColor = parseHexColor("#C4B5FD", colorRgb(196, 181, 253)),
                    accentColor = parseHexColor("#A78BFA", colorRgb(167, 139, 250))
                )
            }
        }

        var sumR = 0L
        var sumG = 0L
        var sumB = 0L
        var sampleCount = 0L

        val stepX = (bitmap.width / 16).coerceAtLeast(1)
        val stepY = (bitmap.height / 16).coerceAtLeast(1)

        for (x in 0 until bitmap.width step stepX) {
            for (y in 0 until bitmap.height step stepY) {
                val pixel = bitmap.getPixel(x, y)
                val r = colorRed(pixel)
                val g = colorGreen(pixel)
                val b = colorBlue(pixel)
                val lum = 0.299 * r + 0.587 * g + 0.114 * b
                if (lum in 22.0..235.0) {
                    sumR += r
                    sumG += g
                    sumB += b
                    sampleCount++
                }
            }
        }

        val avgR = if (sampleCount > 0) (sumR / sampleCount).toInt() else 167
        val avgG = if (sampleCount > 0) (sumG / sampleCount).toInt() else 139
        val avgB = if (sampleCount > 0) (sumB / sampleCount).toInt() else 250
        val sampledRgb = colorRgb(avgR, avgG, avgB)

        return if (isLight) {
            val bgStart = blendColors(sampledRgb, parseHexColor("#FAF8FF", colorRgb(250, 248, 255)), 0.84f)
            val bgEnd = blendColors(sampledRgb, parseHexColor("#EDE9FE", colorRgb(237, 233, 254)), 0.78f)
            val stroke = blendColors(sampledRgb, parseHexColor("#DDD6FE", colorRgb(221, 214, 254)), 0.60f)
            val accent = getAccessibleAccentColor(
                String.format("#%02X%02X%02X", avgR, avgG, avgB),
                isLight = true
            )
            ExtractedColors(
                bgGradientStart = bgStart,
                bgGradientEnd = bgEnd,
                strokeColor = stroke,
                primaryTextColor = parseHexColor("#18181B", colorRgb(24, 24, 27)),
                secondaryTextColor = accent,
                accentColor = accent
            )
        } else {
            // Dark base: Lumaire #14131D
            val bgStart = blendColors(sampledRgb, parseHexColor("#181625", colorRgb(24, 22, 37)), 0.80f)
            val bgEnd = blendColors(sampledRgb, parseHexColor("#0E0D16", colorRgb(14, 13, 22)), 0.84f)
            val stroke = blendColors(sampledRgb, parseHexColor("#2E2744", colorRgb(46, 39, 68)), 0.65f)
            val accent = getAccessibleAccentColor(
                String.format("#%02X%02X%02X", avgR, avgG, avgB),
                isLight = false
            )
            ExtractedColors(
                bgGradientStart = bgStart,
                bgGradientEnd = bgEnd,
                strokeColor = stroke,
                primaryTextColor = colorRgb(255, 255, 255),
                secondaryTextColor = accent,
                accentColor = accent
            )
        }
    }

    private fun getOrComputeColors(isLight: Boolean): ExtractedColors {
        val art = artworkBitmap
        if (cachedExtractedColors != null && cachedArtSource === art) {
            return cachedExtractedColors!!
        }
        val computed = extractColors(art, isLight, accentColor)
        cachedExtractedColors = computed
        cachedArtSource = art
        return computed
    }

    private fun createWidgetBackgroundBitmap(
        widthDp: Int,
        heightDp: Int,
        density: Float,
        colors: ExtractedColors
    ): Bitmap {
        val renderWidth = ((widthDp.coerceAtLeast(100)) * density).toInt().coerceIn(160, 480)
        val renderHeight = ((heightDp.coerceAtLeast(50)) * density).toInt().coerceIn(60, 360)
        val bitmap = Bitmap.createBitmap(renderWidth, renderHeight, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val cornerRadiusPx = 24f * density
        val gradient = LinearGradient(
            0f, 0f, renderWidth.toFloat(), renderHeight.toFloat(),
            colors.bgGradientStart, colors.bgGradientEnd,
            Shader.TileMode.CLAMP
        )
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = gradient
            style = Paint.Style.FILL
        }
        val rect = RectF(0f, 0f, renderWidth.toFloat(), renderHeight.toFloat())
        canvas.drawRoundRect(rect, cornerRadiusPx, cornerRadiusPx, bgPaint)

        val strokeWidthPx = 1.2f * density
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = colors.strokeColor
            style = Paint.Style.STROKE
            strokeWidth = strokeWidthPx
        }
        val insetRect = RectF(
            strokeWidthPx / 2f,
            strokeWidthPx / 2f,
            renderWidth - strokeWidthPx / 2f,
            renderHeight - strokeWidthPx / 2f
        )
        canvas.drawRoundRect(insetRect, cornerRadiusPx, cornerRadiusPx, strokePaint)

        return bitmap
    }

    /**
     * Renders prominent circular play/pause button with optical center adjustment.
     */
    fun getPlayPauseBitmap(context: Context, isPlaying: Boolean, accentColorInt: Int): Bitmap {
        val density = context.resources.displayMetrics.density
        val sizePx = (46 * density).toInt()
        val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accentColorInt
            style = Paint.Style.FILL
        }
        val radius = sizePx / 2f
        canvas.drawCircle(radius, radius, radius, bgPaint)

        val r = Color.red(accentColorInt)
        val g = Color.green(accentColorInt)
        val b = Color.blue(accentColorInt)
        val darkness = 1 - (0.299 * r + 0.587 * g + 0.114 * b) / 255
        val iconColor = if (darkness >= 0.45) Color.WHITE else Color.parseColor("#18181B")

        val iconDrawable = ContextCompat.getDrawable(
            context,
            if (isPlaying) R.drawable.ic_widget_pause else R.drawable.ic_widget_play
        )?.mutate()

        if (iconDrawable != null) {
            iconDrawable.setTint(iconColor)
            val iconSize = (22 * density).toInt()
            val baseOffset = (sizePx - iconSize) / 2
            val xShift = if (!isPlaying) (1.2f * density).toInt() else 0
            iconDrawable.setBounds(
                baseOffset + xShift,
                baseOffset,
                baseOffset + xShift + iconSize,
                baseOffset + iconSize
            )
            iconDrawable.draw(canvas)
        }

        return bitmap
    }

    fun formatTime(ms: Long): String {
        val totalSeconds = (ms / 1000).coerceAtLeast(0L)
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return if (minutes >= 60) {
            val hours = minutes / 60
            val remMin = minutes % 60
            String.format("%d:%02d:%02d", hours, remMin, seconds)
        } else {
            String.format("%d:%02d", minutes, seconds)
        }
    }

    /**
     * Battery-efficient progress tick called from PlaybackService clock handler.
     * Uses partiallyUpdateAppWidget to avoid re-inflating views or recreating bitmaps.
     */
    fun onProgressTick(context: Context) {
        val player = playerRef?.get()
        if (player != null) {
            currentPositionMs = player.currentPosition.coerceAtLeast(0L)
            durationMs = player.duration.coerceAtLeast(0L)
        }
        updateProgressOnly(context)
    }

    private fun updateProgressOnly(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
        val componentName = ComponentName(context, NowPlayingWidgetProvider::class.java)
        val ids = appWidgetManager.getAppWidgetIds(componentName)
        if (ids.isEmpty()) return

        val progressInt = if (durationMs > 0) {
            ((currentPositionMs * 1000) / durationMs).toInt().coerceIn(0, 1000)
        } else 0
        val elapsedStr = formatTime(currentPositionMs)
        val totalStr = formatTime(durationMs)

        for (appWidgetId in ids) {
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            if (minHeight > 85 || minHeight == 0) {
                val partialViews = RemoteViews(context.packageName, R.layout.widget_now_playing)
                partialViews.setProgressBar(R.id.widget_progress_expanded, 1000, progressInt, false)
                partialViews.setTextViewText(R.id.widget_time_elapsed_expanded, elapsedStr)
                partialViews.setTextViewText(R.id.widget_time_total_expanded, totalStr)

                partialViews.setProgressBar(R.id.widget_progress_card, 1000, progressInt, false)
                partialViews.setTextViewText(R.id.widget_time_elapsed_card, elapsedStr)
                partialViews.setTextViewText(R.id.widget_time_total_card, totalStr)

                appWidgetManager.partiallyUpdateAppWidget(appWidgetId, partialViews)
            }
        }
    }

    fun updateNowPlayingWidgets(context: Context) {
        ensurePrefsLoaded(context)
        val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
        val componentName = ComponentName(context, NowPlayingWidgetProvider::class.java)
        val ids = appWidgetManager.getAppWidgetIds(componentName)
        if (ids.isEmpty()) return

        val isLight = themeMode.equals("light", ignoreCase = true)
        val colors = getOrComputeColors(isLight)
        val buttonBgRes = if (isLight) R.drawable.widget_button_bg_light else R.drawable.widget_button_bg
        val buttonIconTint = if (isLight) Color.parseColor("#3F3F46") else Color.parseColor("#E4E4E7")
        val playPauseBitmap = getPlayPauseBitmap(context, isPlaying, colors.accentColor)

        val progressInt = if (durationMs > 0) {
            ((currentPositionMs * 1000) / durationMs).toInt().coerceIn(0, 1000)
        } else 0
        val elapsedStr = formatTime(currentPositionMs)
        val totalStr = formatTime(durationMs)
        val density = context.resources.displayMetrics.density

        for (appWidgetId in ids) {
            val views = RemoteViews(context.packageName, R.layout.widget_now_playing)
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)

            // Dynamic rounded-rect gradient background:
            val bgBitmap = createWidgetBackgroundBitmap(
                if (minWidth > 0) minWidth else 260,
                if (minHeight > 0) minHeight else 90,
                density,
                colors
            )
            views.setImageViewBitmap(R.id.widget_bg_image, bgBitmap)

            // Determine layout mode:
            // 1. Compact: height <= 85dp (1-row horizontal bar)
            // 2. Expanded: height 86..145dp and width >= 220dp (standard horizontal medium)
            // 3. Card: height > 145dp or narrow (2x2, 3x3, 4x3)
            val isCompact = minHeight in 1..85
            val isExpanded = (minHeight in 86..145 && minWidth >= 220) || (minHeight == 0 && minWidth >= 220)
            val isCard = !isCompact && !isExpanded

            if (isCompact) {
                views.setViewVisibility(R.id.widget_compact_layout, View.VISIBLE)
                views.setViewVisibility(R.id.widget_expanded_layout, View.GONE)
                views.setViewVisibility(R.id.widget_card_layout, View.GONE)

                views.setTextViewText(R.id.widget_title, title)
                views.setTextColor(R.id.widget_title, colors.primaryTextColor)
                views.setTextViewText(R.id.widget_artist, artist)
                views.setTextColor(R.id.widget_artist, colors.secondaryTextColor)

                if (artworkBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_art, artworkBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_art, R.drawable.ic_widget_art_fallback)
                }

                views.setImageViewBitmap(R.id.widget_btn_play_pause, playPauseBitmap)
                views.setInt(R.id.widget_btn_prev, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_prev, "setColorFilter", buttonIconTint)
                views.setInt(R.id.widget_btn_next, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_next, "setColorFilter", buttonIconTint)

                if (minWidth in 1..210) {
                    views.setViewVisibility(R.id.widget_btn_prev, View.GONE)
                    views.setViewVisibility(R.id.widget_btn_next, View.GONE)
                } else {
                    views.setViewVisibility(R.id.widget_btn_prev, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_btn_next, View.VISIBLE)
                }
            } else if (isExpanded) {
                views.setViewVisibility(R.id.widget_compact_layout, View.GONE)
                views.setViewVisibility(R.id.widget_expanded_layout, View.VISIBLE)
                views.setViewVisibility(R.id.widget_card_layout, View.GONE)

                views.setTextViewText(R.id.widget_title_expanded, title)
                views.setTextColor(R.id.widget_title_expanded, colors.primaryTextColor)
                views.setTextViewText(R.id.widget_artist_expanded, artist)
                views.setTextColor(R.id.widget_artist_expanded, colors.secondaryTextColor)

                if (artworkBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_art_expanded, artworkBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_art_expanded, R.drawable.ic_widget_art_fallback)
                }

                views.setImageViewBitmap(R.id.widget_btn_play_pause_expanded, playPauseBitmap)
                views.setInt(R.id.widget_btn_prev_expanded, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_prev_expanded, "setColorFilter", buttonIconTint)
                views.setInt(R.id.widget_btn_next_expanded, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_next_expanded, "setColorFilter", buttonIconTint)

                views.setProgressBar(R.id.widget_progress_expanded, 1000, progressInt, false)
                views.setTextViewText(R.id.widget_time_elapsed_expanded, elapsedStr)
                views.setTextViewText(R.id.widget_time_total_expanded, totalStr)

                if (minWidth in 220..270) {
                    views.setViewVisibility(R.id.widget_btn_prev_expanded, View.GONE)
                    views.setViewVisibility(R.id.widget_btn_next_expanded, View.GONE)
                } else {
                    views.setViewVisibility(R.id.widget_btn_prev_expanded, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_btn_next_expanded, View.VISIBLE)
                }
            } else {
                // Card layout:
                views.setViewVisibility(R.id.widget_compact_layout, View.GONE)
                views.setViewVisibility(R.id.widget_expanded_layout, View.GONE)
                views.setViewVisibility(R.id.widget_card_layout, View.VISIBLE)

                views.setTextViewText(R.id.widget_title_card, title)
                views.setTextColor(R.id.widget_title_card, colors.primaryTextColor)
                views.setTextViewText(R.id.widget_artist_card, artist)
                views.setTextColor(R.id.widget_artist_card, colors.secondaryTextColor)

                if (artworkBitmap != null) {
                    views.setImageViewBitmap(R.id.widget_art_card, artworkBitmap)
                } else {
                    views.setImageViewResource(R.id.widget_art_card, R.drawable.ic_widget_art_fallback)
                }

                views.setImageViewBitmap(R.id.widget_btn_play_pause_card, playPauseBitmap)
                views.setInt(R.id.widget_btn_prev_card, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_prev_card, "setColorFilter", buttonIconTint)
                views.setInt(R.id.widget_btn_next_card, "setBackgroundResource", buttonBgRes)
                views.setInt(R.id.widget_btn_next_card, "setColorFilter", buttonIconTint)

                views.setProgressBar(R.id.widget_progress_card, 1000, progressInt, false)
                views.setTextViewText(R.id.widget_time_elapsed_card, elapsedStr)
                views.setTextViewText(R.id.widget_time_total_card, totalStr)

                if (minWidth in 1..180) {
                    views.setViewVisibility(R.id.widget_btn_prev_card, View.GONE)
                    views.setViewVisibility(R.id.widget_btn_next_card, View.GONE)
                } else {
                    views.setViewVisibility(R.id.widget_btn_prev_card, View.VISIBLE)
                    views.setViewVisibility(R.id.widget_btn_next_card, View.VISIBLE)
                }
            }

            // Bind click intents across all layouts:
            val playPauseIntent = Intent(context, NowPlayingWidgetProvider::class.java).apply {
                action = ACTION_PLAY_PAUSE
            }
            val playPausePI = PendingIntent.getBroadcast(
                context, 101, playPauseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_play_pause, playPausePI)
            views.setOnClickPendingIntent(R.id.widget_btn_play_pause_expanded, playPausePI)
            views.setOnClickPendingIntent(R.id.widget_btn_play_pause_card, playPausePI)

            val prevIntent = Intent(context, NowPlayingWidgetProvider::class.java).apply {
                action = ACTION_PREV
            }
            val prevPI = PendingIntent.getBroadcast(
                context, 102, prevIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPI)
            views.setOnClickPendingIntent(R.id.widget_btn_prev_expanded, prevPI)
            views.setOnClickPendingIntent(R.id.widget_btn_prev_card, prevPI)

            val nextIntent = Intent(context, NowPlayingWidgetProvider::class.java).apply {
                action = ACTION_NEXT
            }
            val nextPI = PendingIntent.getBroadcast(
                context, 103, nextIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_next, nextPI)
            views.setOnClickPendingIntent(R.id.widget_btn_next_expanded, nextPI)
            views.setOnClickPendingIntent(R.id.widget_btn_next_card, nextPI)

            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingOpen = PendingIntent.getActivity(
                context, 100, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_now_playing_root, pendingOpen)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    fun updateLyricsWidgets(context: Context) {
        ensurePrefsLoaded(context)
        val appWidgetManager = AppWidgetManager.getInstance(context) ?: return
        val componentName = ComponentName(context, LyricsWidgetProvider::class.java)
        val ids = appWidgetManager.getAppWidgetIds(componentName)
        if (ids.isEmpty()) return

        val isLight = themeMode.equals("light", ignoreCase = true)
        val colors = getOrComputeColors(isLight)
        val density = context.resources.displayMetrics.density

        val activeLyricColor = if (currentLyricText == "Not playing" || currentLyricText == "No lyrics available") {
            colors.primaryTextColor
        } else {
            colors.accentColor
        }
        val dimmedColor = if (isLight) {
            blendColors(colors.secondaryTextColor, Color.BLACK, 0.45f)
        } else {
            Color.parseColor("#71717A")
        }

        for (appWidgetId in ids) {
            val views = RemoteViews(context.packageName, R.layout.widget_lyrics)
            val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)

            // Dynamic rounded-rect background:
            val bgBitmap = createWidgetBackgroundBitmap(
                if (minWidth > 0) minWidth else 260,
                if (minHeight > 0) minHeight else 120,
                density,
                colors
            )
            views.setImageViewBitmap(R.id.widget_lyrics_bg_image, bgBitmap)

            // Header (shown when widget height >= 110dp):
            if (minHeight >= 110) {
                views.setViewVisibility(R.id.widget_lyrics_header, View.VISIBLE)
                val trackHeader = if (title != "Not Playing") "$title • $artist" else "LUMAIRE LIVE LYRICS"
                views.setTextViewText(R.id.widget_lyrics_track_info, trackHeader)
                views.setTextColor(R.id.widget_lyrics_track_info, colors.accentColor)
            } else {
                views.setViewVisibility(R.id.widget_lyrics_header, View.GONE)
            }

            // Lyric texts:
            views.setTextViewText(R.id.widget_lyrics_prev, prevLyricText)
            views.setTextColor(R.id.widget_lyrics_prev, dimmedColor)

            views.setTextViewText(R.id.widget_lyrics_current, currentLyricText)
            views.setTextColor(R.id.widget_lyrics_current, activeLyricColor)

            views.setTextViewText(R.id.widget_lyrics_next, nextLyricText)
            views.setTextColor(R.id.widget_lyrics_next, colors.secondaryTextColor)

            views.setTextViewText(R.id.widget_lyrics_next2, next2LyricText)
            views.setTextColor(R.id.widget_lyrics_next2, dimmedColor)

            // Adaptive line count and typography across widget dimensions:
            if (minHeight in 1..85) {
                // 1-row ticker: single line only
                views.setTextViewTextSize(R.id.widget_lyrics_current, TypedValue.COMPLEX_UNIT_SP, 14f)
                views.setViewVisibility(R.id.widget_lyrics_prev, View.GONE)
                views.setViewVisibility(R.id.widget_lyrics_next, View.GONE)
                views.setViewVisibility(R.id.widget_lyrics_next2, View.GONE)
            } else if (minHeight in 86..150) {
                // Medium compact (e.g. 2x2, 3x2)
                views.setTextViewTextSize(R.id.widget_lyrics_current, TypedValue.COMPLEX_UNIT_SP, 15f)
                views.setTextViewTextSize(R.id.widget_lyrics_next, TypedValue.COMPLEX_UNIT_SP, 12f)
                views.setViewVisibility(R.id.widget_lyrics_prev, View.GONE)
                views.setViewVisibility(
                    R.id.widget_lyrics_next,
                    if (nextLyricText.isBlank()) View.GONE else View.VISIBLE
                )
                views.setViewVisibility(R.id.widget_lyrics_next2, View.GONE)
            } else if (minHeight in 151..210) {
                // Medium tall (e.g. 4x2 tall, 3x3): prev line + current + next
                views.setTextViewTextSize(R.id.widget_lyrics_prev, TypedValue.COMPLEX_UNIT_SP, 12f)
                views.setTextViewTextSize(R.id.widget_lyrics_current, TypedValue.COMPLEX_UNIT_SP, 17f)
                views.setTextViewTextSize(R.id.widget_lyrics_next, TypedValue.COMPLEX_UNIT_SP, 13f)
                views.setViewVisibility(
                    R.id.widget_lyrics_prev,
                    if (prevLyricText.isBlank()) View.GONE else View.VISIBLE
                )
                views.setViewVisibility(
                    R.id.widget_lyrics_next,
                    if (nextLyricText.isBlank()) View.GONE else View.VISIBLE
                )
                views.setViewVisibility(R.id.widget_lyrics_next2, View.GONE)
            } else {
                // Large (minHeight > 210 or 0 default): prev + current + next + next2
                views.setTextViewTextSize(R.id.widget_lyrics_prev, TypedValue.COMPLEX_UNIT_SP, 13f)
                views.setTextViewTextSize(R.id.widget_lyrics_current, TypedValue.COMPLEX_UNIT_SP, 20f)
                views.setTextViewTextSize(R.id.widget_lyrics_next, TypedValue.COMPLEX_UNIT_SP, 14f)
                views.setTextViewTextSize(R.id.widget_lyrics_next2, TypedValue.COMPLEX_UNIT_SP, 13f)
                views.setViewVisibility(
                    R.id.widget_lyrics_prev,
                    if (prevLyricText.isBlank()) View.GONE else View.VISIBLE
                )
                views.setViewVisibility(
                    R.id.widget_lyrics_next,
                    if (nextLyricText.isBlank()) View.GONE else View.VISIBLE
                )
                views.setViewVisibility(
                    R.id.widget_lyrics_next2,
                    if (next2LyricText.isBlank()) View.GONE else View.VISIBLE
                )
            }

            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val pendingOpen = PendingIntent.getActivity(
                context, 200, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_lyrics_root, pendingOpen)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
