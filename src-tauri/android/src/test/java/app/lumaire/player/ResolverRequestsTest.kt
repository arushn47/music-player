package app.lumaire.player

import org.junit.Assert.*
import org.junit.Test

class ResolverRequestsTest {
    @Test fun signedUrlExpiryBoundsReuseAndMalformedExpiryIsNeverCached() {
        val wall = 1_000_000L
        assertEquals(120_000L, ResolverRequests.sourceLifetime("https://r.googlevideo.com/audio", wall))
        assertEquals(20_000L, ResolverRequests.sourceLifetime("https://r.googlevideo.com/audio?expire=1050", wall))
        for (expiry in listOf("1000", "invalid", "9223372036854775807")) {
            assertEquals(0L, ResolverRequests.sourceLifetime("https://r.googlevideo.com/audio?expire=$expiry", wall))
        }
        var time = 0L
        var executions = 0
        val queue = ResolverRequests({ _, done -> executions++; done("audio", null) }, {}, { time }, { 20_000L })
        queue.request("source", true) { _, _ -> }
        time = 20_000L
        queue.request("source", true) { _, _ -> }
        assertEquals(2, executions)
    }
    @Test fun concurrentSearchesWaitAndDuplicatesShareTheSameExtraction() {
        val started = mutableListOf<String>()
        val completions = mutableListOf<(String?, String?) -> Unit>()
        var aborts = 0
        val queue = ResolverRequests({ input, done -> started.add(input); completions.add(done) }, { aborts++ }, { 0L })
        val values = mutableListOf<String?>()
        queue.request("search A", false) { value, _ -> values.add(value) }
        queue.request("search B", false) { value, _ -> values.add(value) }
        queue.request("resolve", true) { value, _ -> values.add(value) }
        queue.request("resolve", true) { value, _ -> values.add(value) }
        assertEquals(listOf("search A"), started)
        completions[0]("A", null); completions[1]("B", null); completions[2]("audio", null)
        assertEquals(listOf("search A", "search B", "resolve"), started)
        assertEquals(listOf("A", "B", "audio", "audio"), values)
        assertEquals(0, aborts)
        queue.request("resolve", true) { value, _ -> assertEquals("audio", value) }
        assertEquals(3, queue.executions)
        assertEquals(1, queue.cacheHits)
    }

    @Test fun selectionCancellationRejectsAllOldWorkAndIgnoresLateReplies() {
        val completions = mutableListOf<(String?, String?) -> Unit>()
        val results = mutableListOf<String>()
        var aborts = 0
        val queue = ResolverRequests({ _, done -> completions.add(done) }, { aborts++ }, { 0L })
        queue.request("old", true) { value, error -> results.add(value ?: error!!) }
        queue.request("waiting", false) { value, error -> results.add(value ?: error!!) }
        queue.cancel("cancelled")
        queue.request("new", true) { value, error -> results.add(value ?: error!!) }
        completions[0]("stale", null)
        completions[1]("new audio", null)
        assertEquals(listOf("cancelled", "cancelled", "new audio"), results)
        assertEquals(1, aborts)
        queue.request("old", true) { _, _ -> }
        assertEquals(3, completions.size)
    }

    @Test fun expiryFailureAndPlayerInvalidationAlwaysAllowAFreshExtraction() {
        var time = 0L
        val completions = mutableListOf<(String?, String?) -> Unit>()
        val queue = ResolverRequests({ _, done -> completions.add(done) }, {}, { time })
        queue.request("audio", true) { _, _ -> }; completions[0]("url", null)
        queue.cancel("new playback")
        queue.request("audio", true) { value, _ -> assertEquals("url", value) }
        assertEquals(1, completions.size)
        time = 120_000
        queue.request("audio", true) { _, _ -> }; completions[1](null, "offline")
        queue.request("audio", true) { _, _ -> }; completions[2]("fresh", null)
        queue.invalidate()
        queue.request("audio", true) { _, _ -> }
        assertEquals(4, completions.size)
    }

    @Test fun queueWaitersAndCacheAreBounded() {
        val completions = mutableListOf<(String?, String?) -> Unit>()
        val queue = ResolverRequests({ _, done -> completions.add(done) }, {}, { 0L })
        repeat(17) { i -> queue.request("audio-$i", true) { _, _ -> }; completions[i]("url-$i", null) }
        queue.request("audio-0", true) { _, _ -> }
        assertEquals(18, completions.size)
        var errors = 0
        repeat(9) { i -> queue.request("waiting-$i", false) { _, error -> if (error != null) errors++ } }
        repeat(16) { queue.request("audio-0", true) { _, error -> if (error != null) errors++ } }
        assertEquals(2, errors)
    }

    @Test fun oversizedResponsesAreReturnedWithoutBeingCached() {
        var executions = 0
        val queue = ResolverRequests({ _, done -> executions++; done("x".repeat(32_769), null) }, {}, { 0L })
        repeat(2) { queue.request("audio", true) { value, error -> assertNull(error); assertEquals(32_769, value!!.length) } }
        assertEquals(2, executions)
    }
}
