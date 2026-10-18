package app.lumaire.player

import org.junit.Assert.*
import org.junit.Test

class StreamHeaderPolicyTest {
    @Test fun approvedHeadersAreCopiedAndLocalPlaybackNeedsNone() {
        val input = mutableMapOf("User-Agent" to "test-player")
        val checked = StreamHeaderPolicy.checked("https://r1.googlevideo.com/audio", input)
        input["User-Agent"] = "changed"
        assertEquals("test-player", checked["User-Agent"])
        assertTrue(StreamHeaderPolicy.checked("file:///local/song.mp3", emptyMap()).isEmpty())
    }
    @Test fun credentialsAndHeaderInjectionAreRejected() {
        for (headers in listOf(mapOf("Cookie" to "private"), mapOf("Authorization" to "secret"), mapOf("User-Agent" to "x\r\nInjected: yes"))) {
            assertThrows(IllegalArgumentException::class.java) { StreamHeaderPolicy.checked("https://r1.googlevideo.com/audio", headers) }
        }
    }
    @Test fun headersCannotBeAttachedToOtherOrigins() {
        for (uri in listOf("file:///audio", "http://r1.googlevideo.com/audio", "https://r1.googlevideo.com.evil.test/audio", "https://r1.googlevideo.com:444/audio", "https://user@r1.googlevideo.com/audio")) {
            assertThrows(IllegalArgumentException::class.java) { StreamHeaderPolicy.checked(uri, mapOf("User-Agent" to "test")) }
        }
    }
}
