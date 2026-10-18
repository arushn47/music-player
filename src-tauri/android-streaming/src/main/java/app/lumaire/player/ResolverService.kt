package app.lumaire.player

import android.app.Service
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.os.*
import com.chaquo.python.Python
import com.chaquo.python.android.AndroidPlatform
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

/** One request in a private, expendable process. Audio is owned by PlaybackService. */
class ResolverService : Service() {
    private val busy = AtomicBoolean(false)
    private val messenger = Messenger(Handler(Looper.getMainLooper()) { message ->
        when (message.what) {
            1 -> {
                if (!busy.compareAndSet(false, true)) return@Handler true
                val reply = message.replyTo
                val generation = message.data.getInt("generation")
                val request = message.data.getString("request") ?: "{}"
                Thread {
                    val result = try {
                        val operation = JSONObject(request).optString("operation")
                        check(operation != "challenge" || applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
                            "Live challenge diagnostics require a debug build."
                        }
                        if (!Python.isStarted()) Python.start(AndroidPlatform(this))
                        val wheels = File(filesDir, "python-wheels").apply { mkdirs() }
                        val expected = mapOf(
                            "yt_dlp-2026.8.19-py3-none-any.whl" to "1d57897e94c6665a0a6f9bc54b34e584284e32c034ffab3a7df25d8f7b24eedf",
                            "yt_dlp_ejs-0.8.0-py3-none-any.whl" to "79300e5fca7f937a1eeede11f0456862c1b41107ce1d726871e0207424f4bdb4")
                        expected.forEach { (name, hash) ->
                            val bytes = assets.open("python-wheels/$name").use { it.readBytes() }
                            check(MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) } == hash)
                            val destination = File(wheels, name)
                            if (!destination.exists() || !destination.readBytes().contentEquals(bytes)) destination.writeBytes(bytes)
                        }
                        Python.getInstance().getModule("lumaire_resolver").callAttr("run", request,
                            applicationInfo.nativeLibraryDir + "/libqjs.so", cacheDir.absolutePath, wheels.absolutePath).toString()
                    } catch (_: Exception) {
                        JSONObject().put("error", "The bundled Android resolver could not initialize.").toString()
                    }
                    try {
                        reply.send(Message.obtain(null, 1).apply { data = Bundle().apply {
                            putString("result", result); putInt("generation", generation)
                        } })
                    } catch (_: Exception) { shutdown() }
                }.start()
            }
            2 -> shutdown()
        }
        true
    })
    override fun onBind(intent: Intent): IBinder = messenger.binder
    private fun shutdown() {
        val pid = Process.myPid().toString()
        File("/proc").listFiles()?.filter { it.name.all(Char::isDigit) }?.forEach {
            try {
                if (File(it, "status").readLines().any { line -> line.startsWith("PPid:") && line.substringAfter(":").trim() == pid })
                    Process.killProcess(it.name.toInt())
            } catch (_: Exception) { }
        }
        Process.killProcess(Process.myPid())
    }
    override fun onDestroy() { super.onDestroy(); shutdown() }
}
