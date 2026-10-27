package app.lumaire.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import kotlin.math.pow
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
        val dark = WidgetUpdateHelper.extractColors(null, isLight = false)
        val light = WidgetUpdateHelper.extractColors(null, isLight = true)
        assertTrue(dark.primaryTextColor != 0)
        assertTrue(light.primaryTextColor != 0)
    }

    @Test
    fun artworkHueChangesTheCardAndFallbackIsNeutral() {
        val warm = WidgetUpdateHelper.artworkColors(0xFFE0A030.toInt(), false)
        val cool = WidgetUpdateHelper.artworkColors(0xFF305FD0.toInt(), false)
        assertNotEquals(warm.bgGradientStart, cool.bgGradientStart)
        assertTrue(WidgetUpdateHelper.colorRed(warm.bgGradientStart) > WidgetUpdateHelper.colorBlue(warm.bgGradientStart))
        assertTrue(WidgetUpdateHelper.colorBlue(cool.bgGradientStart) > WidgetUpdateHelper.colorRed(cool.bgGradientStart))
        val neutral = WidgetUpdateHelper.artworkColors(null, false)
        assertTrue(kotlin.math.abs(WidgetUpdateHelper.colorRed(neutral.bgGradientStart) - WidgetUpdateHelper.colorBlue(neutral.bgGradientStart)) < 16)
    }

    @Test
    fun textKeepsContrastAcrossArtworkAndThemes() {
        fun luminance(color: Int): Double {
            fun channel(value: Int): Double {
                val v = value / 255.0
                return if (v <= 0.04045) v / 12.92 else ((v + 0.055) / 1.055).pow(2.4)
            }
            return 0.2126 * channel(WidgetUpdateHelper.colorRed(color)) +
                0.7152 * channel(WidgetUpdateHelper.colorGreen(color)) +
                0.0722 * channel(WidgetUpdateHelper.colorBlue(color))
        }
        for (sample in listOf<Int?>(null, 0xFF000000.toInt(), 0xFFFFFFFF.toInt(), 0xFFFFDD00.toInt(), 0xFF0033FF.toInt(), 0xFFFF0066.toInt())) {
            for (light in listOf(false, true)) {
                val colors = WidgetUpdateHelper.artworkColors(sample, light)
                for (text in listOf(colors.primaryTextColor, colors.secondaryTextColor)) {
                    for (background in listOf(colors.bgGradientStart, colors.bgGradientEnd)) {
                        val a = luminance(text)
                        val glass = if (light) background else WidgetUpdateHelper.blendColors(
                            WidgetUpdateHelper.blendColors(background, 0xFFFFFFFF.toInt(), 18f / 255),
                            0xFFFFFFFF.toInt(), 20f / 255
                        )
                        val b = luminance(glass)
                        assertTrue("Widget text must meet 4.5:1 contrast", (maxOf(a, b) + 0.05) / (minOf(a, b) + 0.05) >= 4.5)
                    }
                }
            }
        }
    }

    @Test
    fun upcomingLyricsFillsContextWithoutRepeatingOrInventingLines() {
        val lines = (0 until 30).map { NativeLyricLine(it * 1000L, "Line $it") }
        assertEquals((2 until 26).joinToString("\n") { "Line $it" }, WidgetUpdateHelper.upcomingLyrics(lines, 2))
        assertEquals("Line 29", WidgetUpdateHelper.upcomingLyrics(lines, 29))
        assertEquals("", WidgetUpdateHelper.upcomingLyrics(lines, 30))
        assertEquals("", WidgetUpdateHelper.upcomingLyrics(emptyList(), 0))
    }
}
