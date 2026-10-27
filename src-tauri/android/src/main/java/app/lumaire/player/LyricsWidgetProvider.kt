package app.lumaire.player

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.os.Bundle

/**
 * Android AppWidgetProvider for Lumaire Live Lyrics widget.
 * Displays synchronized lyrics in real time, adapting typography dynamically to widget dimensions.
 */
class LyricsWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        WidgetUpdateHelper.updateLyricsWidgets(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        WidgetUpdateHelper.updateLyricsWidgets(context)
    }
}
