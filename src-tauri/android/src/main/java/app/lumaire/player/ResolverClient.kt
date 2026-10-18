package app.lumaire.player

import android.content.*
import android.os.*
import org.json.JSONObject

/** Small IPC boundary. Neither signed URLs nor diagnostics are persisted. */
class ResolverClient(private val context: Context) {
    private val handler = Handler(Looper.getMainLooper())
    private var generation = 0
    private var connection: ServiceConnection? = null
    private var remote: Messenger? = null
    private var complete: ((JSONObject?, String?) -> Unit)? = null
    private var lastReleaseAt = 0L
    var lastDiagnostic = JSONObject(); private set
    private val timeout = Runnable { cancel("Online lookup timed out. Check your connection and try again.") }

    fun request(args: JSONObject, callback: (JSONObject?, String?) -> Unit) {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!BuildConfig.HAS_ANDROID_STREAMING) { callback(null, "Android streaming is disabled in this build."); return }
        val cancelled = complete != null
        cancel("Online lookup was cancelled by a newer request.")
        val token = ++generation
        complete = callback
        handler.postDelayed({
            if (token != generation) return@postDelayed
            val replies = Messenger(Handler(Looper.getMainLooper()) { message ->
                if (token == generation && message.data.getInt("generation") == token) {
                    val result = try { JSONObject(message.data.getString("result") ?: "{}") } catch (_: Exception) { JSONObject().put("error", "Invalid resolver response.") }
                    lastDiagnostic = result.optJSONObject("diagnostic") ?: JSONObject()
                    val done = complete; complete = null; release(false)
                    done?.invoke(if (result.has("error")) null else result, result.optString("error").takeIf { it.isNotEmpty() })
                }
                true
            })
            val link = object : ServiceConnection {
                override fun onServiceConnected(name: ComponentName, binder: IBinder) {
                    if (token != generation) return
                    try {
                        remote = Messenger(binder)
                        remote?.send(Message.obtain(null, 1).apply {
                            data = Bundle().apply { putString("request", args.toString()); putInt("generation", token) }
                            replyTo = replies
                        })
                    } catch (_: Exception) { cancel("Android resolver disconnected. Try again.") }
                }
                override fun onServiceDisconnected(name: ComponentName) {
                    if (token == generation && complete != null) cancel("Android resolver disconnected. Try again.")
                }
                override fun onNullBinding(name: ComponentName) { if (token == generation) cancel("Android resolver is unavailable.") }
            }
            connection = link
            if (!context.bindService(Intent().setClassName(context, "app.lumaire.player.ResolverService"), link, Context.BIND_AUTO_CREATE))
                cancel("Android resolver could not start.")
        }, maxOf(if (cancelled) 200L else 0L, 200L - (SystemClock.uptimeMillis() - lastReleaseAt)))
        handler.postDelayed(timeout, 90000)
    }
    private fun release(kill: Boolean) {
        handler.removeCallbacks(timeout)
        if (kill) try { remote?.send(Message.obtain(null, 2)) } catch (_: Exception) { }
        remote = null
        connection?.let { try { context.unbindService(it) } catch (_: Exception) { } }
        if (connection != null) lastReleaseAt = SystemClock.uptimeMillis()
        connection = null
    }
    fun cancel(reason: String = "Online lookup cancelled.") {
        generation++
        val done = complete; complete = null
        release(done != null)
        done?.invoke(null, reason)
    }
}
