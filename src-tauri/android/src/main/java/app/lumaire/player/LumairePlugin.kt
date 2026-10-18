package app.lumaire.player

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

@TauriPlugin
class LumairePlugin(private val activity: Activity) : Plugin(activity) {
    private var controller: MediaController? = null
    private val io = Executors.newSingleThreadExecutor()
    private var connecting = false
    private val waiting = mutableListOf<Pair<Invoke, (MediaController) -> Unit>>()

    private fun withPlayer(invoke: Invoke, operation: (MediaController) -> Unit) {
        activity.runOnUiThread {
            val active = controller
            if (active != null) { operation(active); return@runOnUiThread }
            waiting.add(Pair(invoke, operation))
            if (connecting) return@runOnUiThread
            connecting = true
            val future = MediaController.Builder(activity,
                SessionToken(activity, ComponentName(activity, PlaybackService::class.java))).buildAsync()
            future.addListener({
                connecting = false
                val pending = waiting.toList(); waiting.clear()
                try {
                    val player = future.get(); controller = player
                    pending.forEach { (request, action) ->
                        try { action(player) } catch (_: Exception) { request.reject("Playback action failed.") }
                    }
                } catch (_: Exception) {
                    pending.forEach { (request, _) -> request.reject("Could not connect to Android audio playback.") }
                }
            }, ContextCompat.getMainExecutor(activity))
        }
    }

    private fun state(player: MediaController): JSObject = JSObject().apply {
        val failure = player.playerError
        put("status", when {
            failure != null -> "error"
            player.playbackState == Player.STATE_ENDED -> "ended"
            player.playbackState == Player.STATE_BUFFERING -> "buffering"
            player.isPlaying -> "playing"
            player.mediaItemCount == 0 -> "idle"
            else -> "paused"
        })
        put("time", player.currentPosition.coerceAtLeast(0).toDouble() / 1000)
        put("duration", if (player.duration == C.TIME_UNSET) 0.0 else player.duration.coerceAtLeast(0).toDouble()/1000)
        put("error", if (failure != null) "Android could not play this audio. Check the source or try another file." else org.json.JSONObject.NULL)
        put("id", player.currentMediaItem?.mediaId ?: "")
    }

    @Command
    fun playback(invoke: Invoke) {
        val args = invoke.getArgs()
        withPlayer(invoke) { player ->
            when (args.getString("action")) {
                "load" -> {
                    val uri = Uri.parse(args.getString("uri"))
                    // The only caller is the Rust adapter, which resolves stored IDs.
                    require(uri.scheme == "file" || uri.scheme == "https")
                    val media = MediaItem.Builder().setMediaId(args.getString("id") ?: "")
                        .setUri(uri).setMediaMetadata(MediaMetadata.Builder()
                            .setTitle(args.getString("title")).setArtist(args.getString("artist")).build()).build()
                    player.setMediaItem(media, (args.optDouble("position", 0.0)*1000).toLong())
                    player.prepare()
                    player.playWhenReady = args.optBoolean("autoplay", false)
                }
                "play" -> player.play()
                "pause" -> player.pause()
                "seek" -> player.seekTo((args.optDouble("value", 0.0)*1000).toLong())
                "volume" -> player.volume = args.optDouble("value", 1.0).toFloat().coerceIn(0f, 1f)
                "stop" -> { player.stop(); player.clearMediaItems() }
                "state" -> {}
                else -> { invoke.reject("Unknown audio command."); return@withPlayer }
            }
            invoke.resolve(state(player))
        }
    }

    @Command
    fun pickAudio(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "audio/*"
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        activity.runOnUiThread { startActivityForResult(invoke, intent, "audioSelected") }
    }

    @ActivityCallback
    private fun audioSelected(invoke: Invoke, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            invoke.resolve(JSObject().apply { put("paths", org.json.JSONArray()) }); return
        }
        val intent = result.data
        val uris = mutableListOf<Uri>()
        intent?.clipData?.let { clips -> for (i in 0 until clips.itemCount.coerceAtMost(100)) uris.add(clips.getItemAt(i).uri) }
        if (uris.isEmpty()) intent?.data?.let { uris.add(it) }
        io.execute {
            val paths = org.json.JSONArray()
            try {
                val directory = File(activity.filesDir, "imported").apply { mkdirs() }
                for (uri in uris.distinct()) {
                    val name = displayName(uri)
                    val extension = name.substringAfterLast('.', "").lowercase()
                    require(extension in listOf("mp3", "wav", "flac", "ogg", "m4a", "aac", "opus"))
                    val hash = MessageDigest.getInstance("SHA-256").digest(uri.toString().toByteArray()).joinToString("") { "%02x".format(it) }
                    val folder = File(directory, hash).apply { mkdirs() }
                    val safeName = name.replace(Regex("[\\\\/\\p{Cntrl}]"), "_").take(180).let { if (it.lowercase().endsWith(".$extension")) it else "audio.$extension" }
                    val target = File(folder, safeName)
                    val partial = File(folder, "audio.part")
                    try {
                        // An existing explicit import is reused and deduplicated by its path.
                        if (!target.exists()) {
                            activity.contentResolver.openInputStream(uri).use { input ->
                                requireNotNull(input)
                                partial.outputStream().use { output ->
                                    val buffer = ByteArray(65536); var total = 0L
                                    while (true) {
                                        val read = input.read(buffer); if (read < 0) break
                                        total += read; require(total <= 200L * 1024 * 1024)
                                        output.write(buffer, 0, read)
                                    }
                                    require(total > 0)
                                }
                            }
                            check(partial.renameTo(target))
                        }
                        paths.put(target.absolutePath)
                    } finally { partial.delete() }
                }
                invoke.resolve(JSObject().apply { put("paths", paths) })
            } catch (_: Exception) { invoke.reject("Could not import the audio. Choose supported files under 200 MB.") }
        }
    }

    private fun displayName(uri: Uri): String = activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
        if (it.moveToFirst()) it.getString(0) else "audio"
    } ?: "audio"

    @Command
    fun pickText(invoke: Invoke) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("text/plain", "application/octet-stream", "application/x-subrip"))
        }
        activity.runOnUiThread { startActivityForResult(invoke, intent, "textSelected") }
    }

    @ActivityCallback
    private fun textSelected(invoke: Invoke, result: ActivityResult) {
        val uri = result.data?.data
        if (result.resultCode != Activity.RESULT_OK || uri == null) { invoke.resolve(); return }
        io.execute {
            try {
                val bytes = activity.contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input)
                    val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                    while (true) {
                        val count = input.read(buffer); if (count < 0) break
                        require(out.size() + count <= 1048576); out.write(buffer, 0, count)
                    }
                    out.toByteArray()
                }
                val text = Charsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString()
                invoke.resolve(JSObject().apply { put("text", text); put("fileName", displayName(uri)) })
            } catch (_: Exception) { invoke.reject("Choose a UTF-8 LRC or text file under 1 MB.") }
        }
    }

    override fun onDestroy() {
        // Release this Activity's controller, not the service's active player.
        activity.runOnUiThread { controller?.release(); controller = null }
        io.shutdown()
    }
}
