/**
 * Align androidx.work artifacts across the Android graph.
 *
 * Conflict:
 *   - react-native-android-widget → work-runtime:2.8.1
 *   - expo-widgets (Glance)       → work-runtime-ktx:2.7.1
 *
 * From WorkManager 2.8.0, Kotlin extensions (OneTimeWorkRequestKt,
 * PeriodicWorkRequestKt, …) live in work-runtime. The older
 * work-runtime-ktx:2.7.1 still ships those classes, so the release
 * classpath fails with checkReleaseDuplicateClasses.
 *
 * Forcing both artifacts onto the same 2.9.x line resolves the clash.
 * work-runtime-ktx ≥ 2.8 is effectively empty (API moved into work-runtime).
 */
const { withProjectBuildGradle, createRunOncePlugin } = require("expo/config-plugins");

const WORK_VERSION = "2.9.1";
const MARKER = "chrona-work-manager-align";

const FORCE_BLOCK = `
// ${MARKER}: keep work-runtime and work-runtime-ktx on the same version
// (react-native-android-widget vs expo-widgets/Glance).
subprojects { subproject ->
    subproject.configurations.configureEach { configuration ->
        configuration.resolutionStrategy {
            force "androidx.work:work-runtime:${WORK_VERSION}"
            force "androidx.work:work-runtime-ktx:${WORK_VERSION}"
        }
    }
}
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withAndroidWorkManagerAlign(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      return cfg;
    }
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }
    cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${FORCE_BLOCK}\n`;
    return cfg;
  });
}

module.exports = createRunOncePlugin(
  withAndroidWorkManagerAlign,
  "withAndroidWorkManagerAlign",
  "1.0.0",
);
