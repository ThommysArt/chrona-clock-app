import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { ChronaCitiesWidget } from "@/widgets/android/chrona-cities-widget";
import { ChronaClockWidget } from "@/widgets/android/chrona-clock-widget";
import { ChronaNowWidget } from "@/widgets/android/chrona-now-widget";
import {
  loadWidgetPayload,
  resolveWidgetCity,
} from "@/widgets/shared/widget-data";
import { clearWidgetCityId } from "@/widgets/shared/widget-prefs";

/**
 * Headless JS handler for Android home-screen widgets.
 * Called on add / update / resize / click / delete.
 *
 * Always re-layout from widgetInfo.width/height so resize produces correct UI.
 */
export async function widgetTaskHandler(
  props: WidgetTaskHandlerProps
): Promise<void> {
  const { widgetInfo, widgetAction, clickAction, renderWidget } = props;

  if (widgetAction === "WIDGET_DELETED") {
    // Drop per-instance city preference
    await clearWidgetCityId(widgetInfo.widgetName, widgetInfo.widgetId).catch(
      () => undefined
    );
    return;
  }

  if (widgetAction === "WIDGET_CLICK" && clickAction === "OPEN_APP") {
    // Opening the app is handled by the default intent; still refresh UI.
  }

  const payload = await loadWidgetPayload();
  const width = Math.max(40, widgetInfo.width || 110);
  const height = Math.max(40, widgetInfo.height || 110);

  switch (widgetInfo.widgetName) {
    case "ChronaNow": {
      const city = await resolveWidgetCity(
        payload,
        widgetInfo.widgetName,
        widgetInfo.widgetId
      );
      renderWidget({
        light: (
          <ChronaNowWidget
            city={city}
            theme="light"
            width={width}
            height={height}
          />
        ),
        dark: (
          <ChronaNowWidget
            city={city}
            theme="dark"
            width={width}
            height={height}
          />
        ),
      });
      break;
    }

    case "ChronaCities": {
      renderWidget({
        light: (
          <ChronaCitiesWidget
            cities={payload.cities}
            theme="light"
            width={width}
            height={height}
          />
        ),
        dark: (
          <ChronaCitiesWidget
            cities={payload.cities}
            theme="dark"
            width={width}
            height={height}
          />
        ),
      });
      break;
    }

    case "ChronaClock": {
      const city = await resolveWidgetCity(
        payload,
        widgetInfo.widgetName,
        widgetInfo.widgetId
      );
      renderWidget({
        light: (
          <ChronaClockWidget
            city={city}
            cities={payload.cities}
            theme="light"
            width={width}
            height={height}
          />
        ),
        dark: (
          <ChronaClockWidget
            city={city}
            cities={payload.cities}
            theme="dark"
            width={width}
            height={height}
          />
        ),
      });
      break;
    }

    default:
      break;
  }
}
