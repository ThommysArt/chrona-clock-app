import { create } from "zustand";

import { type CityDefinition, DEFAULT_CITIES, STORAGE_KEYS } from "@/lib/constants";
import { loadJson, saveJson } from "@/lib/storage";

type CitiesState = {
  cities: CityDefinition[];
  addCity: (city: CityDefinition) => void;
  removeCity: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  hasCity: (id: string) => boolean;
};

const defaultList: CityDefinition[] = DEFAULT_CITIES.map((c) => ({ ...c }));

export const useCitiesStore = create<CitiesState>((set, get) => ({
  cities: loadJson<CityDefinition[]>(STORAGE_KEYS.cities, defaultList),

  addCity: (city) => {
    const { cities } = get();
    if (cities.some((c) => c.id === city.id || c.timezone === city.timezone && c.label === city.label)) {
      return;
    }
    const next = [...cities, city];
    saveJson(STORAGE_KEYS.cities, next);
    set({ cities: next });
  },

  removeCity: (id) => {
    const next = get().cities.filter((c) => c.id !== id);
    saveJson(STORAGE_KEYS.cities, next);
    set({ cities: next });
  },

  reorder: (fromIndex, toIndex) => {
    const next = [...get().cities];
    const [item] = next.splice(fromIndex, 1);
    if (!item) return;
    next.splice(toIndex, 0, item);
    saveJson(STORAGE_KEYS.cities, next);
    set({ cities: next });
  },

  hasCity: (id) => get().cities.some((c) => c.id === id),
}));
