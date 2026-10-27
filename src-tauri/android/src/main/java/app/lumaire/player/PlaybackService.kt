package app.lumaire.player

import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.media3.common.Player
import androidx.media3.common.MediaItem
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/** Audio belongs to the service, never the WebView or Activity lifecycle. */
class PlaybackService : MediaSessionService() {
    companion object {
        var listenedTrackId: String? = null
            private set
        var listenedMs: Long = 0
            private set
    }
    private var session: MediaSession? = null
    private val clockHandler = Handler(Looper.getMainLooper())
    private var lastPosition = 0L
    private var lastTick = 0L
    private var wasPlaying = false
    private fun sample(position: Long? = null) {
        val player = session?.player ?: return
        val now = SystemClock.elapsedRealtime()
        val current = position ?: player.currentPosition
        val elapsed = now - lastTick
        val progress = current - lastPosition
        if (wasPlaying && elapsed in 1..5000 && progress > 0 && progress <= elapsed + 500) {
            listenedMs += minOf(elapsed, progress)
        }
        lastTick = now
        lastPosition = current
        wasPlaying = player.isPlaying
    }
    private val clockTick = object : Runnable {
        override fun run() {
            sample()
            WidgetUpdateHelper.onProgressTick(this@PlaybackService)
            if (session?.player?.isPlaying == true) clockHandler.postDelayed(this, 1000)
        }
    }

    override fun onCreate() {
        super.onCreate()
        val factory = androidx.media3.datasource.DefaultDataSource.Factory(this, ScopedHttpHeaders.Factory())
        val player = ExoPlayer.Builder(this).setMediaSourceFactory(
            androidx.media3.exoplayer.source.DefaultMediaSourceFactory(this).setDataSourceFactory(factory)
        ).build().apply {
            setAudioAttributes(AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
        }
        session = MediaSession.Builder(this, player).build()
        player.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                sample()
                clockHandler.removeCallbacks(clockTick)
                if (isPlaying) {
                    WidgetUpdateHelper.onProgressTick(this@PlaybackService)
                    clockHandler.postDelayed(clockTick, 1000)
                }
            }
            override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
                listenedTrackId = item?.mediaId
                listenedMs = 0
                lastTick = SystemClock.elapsedRealtime()
                lastPosition = player.currentPosition
                wasPlaying = player.isPlaying
            }
            override fun onPositionDiscontinuity(old: Player.PositionInfo, new: Player.PositionInfo, reason: Int) {
                sample(old.positionMs)
                lastPosition = new.positionMs
            }
        })
        WidgetUpdateHelper.attachPlayer(this, player)
        val notificationProvider = androidx.media3.session.DefaultMediaNotificationProvider(this).apply {
            setSmallIcon(R.drawable.ic_notification)
        }
        setMediaNotificationProvider(notificationProvider)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return if (controllerInfo.packageName == packageName || controllerInfo.isTrusted) session else null
    }

    override fun onDestroy() {
        sample()
        clockHandler.removeCallbacks(clockTick)
        WidgetUpdateHelper.detachPlayer()
        session?.run { player.release(); release() }
        session = null
        super.onDestroy()
    }
}
