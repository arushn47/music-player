package app.lumaire.player

import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetUpdateHelperTest {
    @Test
    fun formatTimeHandlesEdgeCases() {
        assertEquals("0:00", WidgetUpdateHelper.formatTime(-500L))
        assertEquals("0:00", WidgetUpdateHelper.formatTime(0L))
        assertEquals("0:09", WidgetUpdateHelper.formatTime(9_000L))
        assertEquals("0:45", WidgetUpdateHelper.formatTime(45_000L))
        assertEquals("2:05", WidgetUpdateHelper.formatTime(125_000L))
        assertEquals("1:01:05", WidgetUpdateHelper.formatTime(3_665_000L))
    }

    @Test
    fun extractColorsFallbackReturnsValidColors() {
        val dark = WidgetUpdateHelper.extractColors(null, isLight = false, customAccentHex = null)
        val light = WidgetUpdateHelper.extractColors(null, isLight = true, customAccentHex = null)
        // Ensure colors are properly populated
        assert(dark.primaryTextColor != 0)
        assert(light.primaryTextColor != 0)
    }
}
