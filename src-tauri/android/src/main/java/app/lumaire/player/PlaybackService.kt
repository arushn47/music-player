package app.lumaire.player

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/** Audio belongs to the service, never the WebView or Activity lifecycle. */
class PlaybackService : MediaSessionService() {
    private var session: MediaSession? = null

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
        val notificationProvider = androidx.media3.session.DefaultMediaNotificationProvider(this).apply {
            setSmallIcon(R.drawable.ic_notification)
        }
        setMediaNotificationProvider(notificationProvider)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return if (controllerInfo.packageName == packageName || controllerInfo.isTrusted) session else null
    }

    override fun onDestroy() {
        session?.run { player.release(); release() }
        session = null
        super.onDestroy()
    }
}
