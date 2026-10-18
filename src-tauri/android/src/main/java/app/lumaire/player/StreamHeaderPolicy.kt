package app.lumaire.player

import java.net.URI

object StreamHeaderPolicy {
    private val allowed = setOf("user-agent", "accept", "accept-language", "referer", "origin", "sec-fetch-mode")
    fun checked(source: String, headers: Map<String, String>): Map<String, String> {
        require(headers.size <= 6)
        headers.forEach { (key, value) ->
            require(key.lowercase() in allowed && value.length <= 4096 && !value.contains('\r') && !value.contains('\n'))
        }
        if (headers.isNotEmpty()) {
            val uri = URI(source)
            require(uri.scheme == "https" && uri.host?.lowercase()?.endsWith(".googlevideo.com") == true && uri.port in listOf(-1, 443) && uri.userInfo == null)
        }
        return headers.toMap()
    }
}
