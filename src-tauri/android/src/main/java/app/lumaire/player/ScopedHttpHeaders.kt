package app.lumaire.player

import android.net.Uri
import androidx.media3.datasource.*
import org.json.JSONObject

/** Headers apply to one exact stream URI; local files never use this factory. */
object ScopedHttpHeaders {
    private var uri: String? = null
    private var values: Map<String, String> = emptyMap()
    @Synchronized fun register(source: Uri, headers: JSONObject?) {
        val next = headers?.keys()?.asSequence()?.associateWith { key ->
            headers.getString(key)
        } ?: emptyMap()
        val checked = StreamHeaderPolicy.checked(source.toString(), next)
        uri = source.toString(); values = checked
    }
    @Synchronized private fun forSource(source: Uri) = if (source.toString() == uri) values else emptyMap()
    class Factory : DataSource.Factory {
        override fun createDataSource(): DataSource = object : DataSource {
            private var delegate: DataSource? = null
            private val listeners = mutableListOf<TransferListener>()
            override fun addTransferListener(listener: TransferListener) { listeners.add(listener); delegate?.addTransferListener(listener) }
            override fun open(spec: DataSpec): Long {
                val source = DefaultHttpDataSource.Factory().setConnectTimeoutMs(15000).setReadTimeoutMs(15000)
                    .setDefaultRequestProperties(forSource(spec.uri)).createDataSource()
                listeners.forEach { source.addTransferListener(it) }; delegate = source
                return source.open(spec)
            }
            override fun read(buffer: ByteArray, offset: Int, length: Int) = requireNotNull(delegate).read(buffer, offset, length)
            override fun getUri() = delegate?.uri
            override fun getResponseHeaders(): Map<String, List<String>> = delegate?.responseHeaders ?: emptyMap()
            override fun close() { delegate?.close(); delegate = null }
        }
    }
}
