package app.lumaire.player

/** The disposable Python worker accepts one request; independent lookups must wait. */
class ResolverRequests(
    private val run: (String, (String?, String?) -> Unit) -> Unit,
    private val abort: () -> Unit,
    private val now: () -> Long,
    private val lifetime: (String) -> Long = { 120_000L },
) {
    companion object {
        fun sourceLifetime(source: String, wallMillis: Long): Long {
            val uri = try { java.net.URI(source) } catch (_: Exception) { return 0L }
            val raw = uri.rawQuery?.split('&')?.firstOrNull { it.startsWith("expire=") }?.substringAfter('=') ?: return 120_000L
            val seconds = raw.toLongOrNull() ?: return 0L
            if (seconds <= 0 || seconds > Long.MAX_VALUE / 1000) return 0L
            return (seconds * 1000 - wallMillis - 30_000).coerceIn(0L, 120_000L)
        }
    }
    private class Work(val input: String, val cacheable: Boolean, val callbacks: MutableList<(String?, String?) -> Unit>)
    private data class Cached(val value: String, val expires: Long)
    private val waiting = ArrayDeque<Work>()
    private val cache = linkedMapOf<String, Cached>()
    private var active: Work? = null
    var executions = 0; private set
    var cacheHits = 0; private set

    fun request(input: String, cacheable: Boolean, callback: (String?, String?) -> Unit) {
        val cached = cache[input]
        if (cacheable && cached != null && cached.expires > now()) {
            cacheHits++
            callback(cached.value, null)
            return
        }
        cache.remove(input)
        val duplicate = active?.takeIf { it.input == input } ?: waiting.firstOrNull { it.input == input }
        if (duplicate != null) {
            if (duplicate.callbacks.size >= 16) callback(null, "Too many pending online lookups. Try again.")
            else duplicate.callbacks.add(callback)
            return
        }
        if (waiting.size >= 8) { callback(null, "Too many pending online lookups. Try again."); return }
        val work = Work(input, cacheable, mutableListOf(callback))
        if (active == null) start(work) else waiting.addLast(work)
    }

    private fun start(work: Work) {
        active = work
        executions++
        run(work.input) { result, error ->
            if (active !== work) return@run
            if (work.cacheable && result != null && error == null && result.length <= 32_768) {
                cache.entries.removeAll { it.value.expires <= now() }
                val ttl = lifetime(result).coerceIn(0L, 120_000L)
                if (ttl > 0) {
                    if (cache.size >= 16) cache.remove(cache.keys.first())
                    cache[work.input] = Cached(result, now() + ttl)
                }
            }
            active = null
            if (waiting.isNotEmpty()) start(waiting.removeFirst())
            work.callbacks.forEach { it(result, error) }
        }
    }

    fun invalidate() { cache.clear() }

    fun cancel(reason: String) {
        val cancelled = listOfNotNull(active) + waiting.toList()
        active = null
        waiting.clear()
        abort()
        cancelled.forEach { work -> work.callbacks.forEach { it(null, reason) } }
    }
}
