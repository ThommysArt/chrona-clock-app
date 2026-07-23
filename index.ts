/**
 * Custom entry so we can register the Android widget task handler
 * (and configuration screen) alongside Expo Router.
 *
 * @see https://saleksovski.github.io/react-native-android-widget/
 */
import "expo-router/entry";

import { Platform } from "react-native";

// Android home-screen widgets (react-native-android-widget)
if (Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      registerWidgetTaskHandler,
      registerWidgetConfigurationScreen,
    } = require("react-native-android-widget");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { widgetTaskHandler } = require("./src/widgets/android/task-handler");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {
      WidgetConfigurationScreen,
    } = require("./src/widgets/android/configuration-screen");
    registerWidgetTaskHandler(widgetTaskHandler);
    registerWidgetConfigurationScreen(WidgetConfigurationScreen);
  } catch (e) {
    console.warn("[chrona] Android widget handler not registered", e);
  }
}

// iOS widgets are registered via createWidget() at module load
// when their modules are imported — keep a soft import for timeline updates.
if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./src/widgets/ios/ChronaNowWidget");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./src/widgets/ios/ChronaCitiesWidget");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("./src/widgets/ios/ChronaClockWidget");
  } catch (e) {
    console.warn("[chrona] iOS widgets not registered", e);
  }
}
