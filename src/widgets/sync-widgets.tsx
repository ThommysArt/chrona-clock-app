import { Platform } from "react-native";

import {
  loadWidgetPayload,
  resolveWidgetCity,
  type WidgetPayload,
} from "@/widgets/shared/widget-data";

/**
 * Push the latest city times to all platform home-screen widgets.
 * Safe to call from the main app (no-ops when native modules are unavailable).
 */
export async function syncHomeScreenWidgets(): Promise<void> {
  try {
    const payload = await loadWidgetPayload();

    if (Platform.OS === "android") {
      await syncAndroidWidgets(payload);
    }

    if (Platform.OS === "ios") {
      await syncIosWidgets(payload);
    }
  } catch (e) {
    // Widgets require a dev/production build — never crash the app if missing.
    console.warn("[chrona] widget sync skipped", e);
  }
}

async function syncAndroidWidgets(payload: WidgetPayload): Promise<void> {
  const { requestWidgetUpdate } = await import("react-native-android-widget");
  const { ChronaNowWidget } = await import(
    "@/widgets/android/chrona-now-widget"
  );
  const { ChronaCitiesWidget } = await import(
    "@/widgets/android/chrona-cities-widget"
  );
  const { ChronaClockWidget } = await import(
    "@/widgets/android/chrona-clock-widget"
  );

  await requestWidgetUpdate({
    widgetName: "ChronaNow",
    renderWidget: async (info) => {
      const city = await resolveWidgetCity(
        payload,
        info.widgetName,
        info.widgetId
      );
      const width = Math.max(40, info.width || 110);
      const height = Math.max(40, info.height || 110);
      return {
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
      };
    },
  });

  await requestWidgetUpdate({
    widgetName: "ChronaCities",
    renderWidget: (info) => {
      const width = Math.max(40, info.width || 250);
      const height = Math.max(40, info.height || 110);
      return {
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
      };
    },
  });

  await requestWidgetUpdate({
    widgetName: "ChronaClock",
    renderWidget: async (info) => {
      const city = await resolveWidgetCity(
        payload,
        info.widgetName,
        info.widgetId
      );
      const width = Math.max(40, info.width || 110);
      const height = Math.max(40, info.height || 110);
      return {
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
      };
    },
  });
}

async function syncIosWidgets(payload: WidgetPayload): Promise<void> {
  const ChronaNowWidget = (await import("@/widgets/ios/ChronaNowWidget"))
    .default;
  const ChronaCitiesWidget = (
    await import("@/widgets/ios/ChronaCitiesWidget")
  ).default;
  const ChronaClockWidget = (await import("@/widgets/ios/ChronaClockWidget"))
    .default;
  const { loadWidgetTimeline } = await import("@/widgets/shared/widget-data");

  const primary = payload.primary;
  ChronaNowWidget.updateSnapshot({
    cityLabel: primary?.label ?? "",
    timeLabel: primary?.timeLabelShort ?? "--:--",
    meta: primary
      ? `${primary.abbreviation} · ${primary.dateLabel}`
      : "Add cities in app",
    isDaytime: primary?.isDaytime ?? true,
  });

  ChronaCitiesWidget.updateSnapshot({
    cities: payload.cities.map((c) => ({
      label: c.label,
      time: c.timeLabelShort,
      meta: `${c.relative} · ${c.abbreviation}`,
    })),
  });

  ChronaClockWidget.updateSnapshot({
    cityLabel: primary?.label ?? "",
    timeLabel: primary?.timeLabelShort ?? "--:--",
    hourProgress: primary?.hourHandProgress ?? 0,
    minuteProgress: primary?.minuteHandProgress ?? 0,
    isDaytime: primary?.isDaytime ?? true,
  });

  // Minute-level timeline so times advance while the app is backgrounded
  const timeline = await loadWidgetTimeline(45);
  ChronaNowWidget.updateTimeline(
    timeline.map(({ date, payload: p }) => ({
      date,
      props: {
        cityLabel: p.primary?.label ?? "",
        timeLabel: p.primary?.timeLabelShort ?? "--:--",
        meta: p.primary
          ? `${p.primary.abbreviation} · ${p.primary.dateLabel}`
          : "Add cities in app",
        isDaytime: p.primary?.isDaytime ?? true,
      },
    }))
  );
  ChronaCitiesWidget.updateTimeline(
    timeline.map(({ date, payload: p }) => ({
      date,
      props: {
        cities: p.cities.map((c) => ({
          label: c.label,
          time: c.timeLabelShort,
          meta: `${c.relative} · ${c.abbreviation}`,
        })),
      },
    }))
  );
  ChronaClockWidget.updateTimeline(
    timeline.map(({ date, payload: p }) => ({
      date,
      props: {
        cityLabel: p.primary?.label ?? "",
        timeLabel: p.primary?.timeLabelShort ?? "--:--",
        hourProgress: p.primary?.hourHandProgress ?? 0,
        minuteProgress: p.primary?.minuteHandProgress ?? 0,
        isDaytime: p.primary?.isDaytime ?? true,
      },
    }))
  );
}
