package app.lumaire.player

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle

/**
 * Android AppWidgetProvider for Lumaire Now Playing widget.
 * Controls play/pause, next, and previous actions in the background.
 */
class NowPlayingWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        WidgetUpdateHelper.updateNowPlayingWidgets(context)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
        WidgetUpdateHelper.updateNowPlayingWidgets(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            WidgetUpdateHelper.ACTION_PLAY_PAUSE -> {
                WidgetUpdateHelper.togglePlayPause(context)
            }
            WidgetUpdateHelper.ACTION_PREV -> {
                WidgetUpdateHelper.skipPrevious(context)
            }
            WidgetUpdateHelper.ACTION_NEXT -> {
                WidgetUpdateHelper.skipNext(context)
            }
        }
    }
}
