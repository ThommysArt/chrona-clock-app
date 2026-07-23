import * as db from "@/lib/db";

/**
 * Per-instance Android widget preferences (city selection for Time / Clock widgets).
 * Stored in SQLite `meta` so the headless widget task and the config screen share state.
 */

function keyFor(widgetName: string, widgetId: number): string {
  return `widget:${widgetName}:${widgetId}:cityId`;
}

export async function getWidgetCityId(
  widgetName: string,
  widgetId: number
): Promise<string | null> {
  try {
    const value = await db.getMeta(keyFor(widgetName, widgetId));
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function setWidgetCityId(
  widgetName: string,
  widgetId: number,
  cityId: string
): Promise<void> {
  await db.setMeta(keyFor(widgetName, widgetId), cityId);
}

export async function clearWidgetCityId(
  widgetName: string,
  widgetId: number
): Promise<void> {
  try {
    await db.setMeta(keyFor(widgetName, widgetId), "");
  } catch {
    // ignore
  }
}
