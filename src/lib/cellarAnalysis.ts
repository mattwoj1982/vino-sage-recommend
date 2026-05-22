import { PAIRING_CATEGORIES, type PairingCategory } from "./pairingCategories";

export interface WineLite {
  id: string;
  name: string;
  winery: string | null;
  vintage: number | null;
  bottle_count: number;
  drink_from: number | null;
  drink_to: number | null;
  pairing_categories: string[] | null;
  rating: number | null;
  country: string | null;
  grape_variety: string | null;
  region: string | null;
  price_min: number | null;
  price_max: number | null;
}

export interface DrinkAlert {
  wine: WineLite;
  kind: "past" | "peak" | "soon";
  message: string;
}

/**
 * Trinkfenster-Erinnerungen:
 *  - past: drink_to < aktuelles Jahr (Höhepunkt überschritten)
 *  - peak: aktuelles Jahr == drink_to (letztes Jahr im Fenster)
 *  - soon: drink_from == aktuelles oder nächstes Jahr (bald trinkreif)
 */
export const getDrinkAlerts = (wines: WineLite[]): DrinkAlert[] => {
  const year = new Date().getFullYear();
  const alerts: DrinkAlert[] = [];
  for (const w of wines) {
    if (w.bottle_count <= 0) continue;
    if (w.drink_to != null) {
      if (year > w.drink_to) {
        alerts.push({ wine: w, kind: "past", message: `Höhepunkt seit ${year - w.drink_to} Jahr(en) überschritten` });
        continue;
      }
      if (year === w.drink_to) {
        alerts.push({ wine: w, kind: "peak", message: `Letztes Jahr im Trinkfenster – jetzt geniessen` });
        continue;
      }
    }
    if (w.drink_from != null && (w.drink_from === year || w.drink_from === year + 1)) {
      alerts.push({
        wine: w,
        kind: "soon",
        message: w.drink_from === year ? "Jetzt trinkreif" : "Im nächsten Jahr trinkreif",
      });
    }
  }
  // Priorität: past > peak > soon
  const order = { past: 0, peak: 1, soon: 2 } as const;
  return alerts.sort((a, b) => order[a.kind] - order[b.kind]);
};

export interface PairingGap {
  category: PairingCategory;
  bottles: number;
  level: "missing" | "low";
}

/**
 * Lücken-Analyse: pro Pairing-Kategorie die Anzahl Flaschen.
 *  - missing: 0 Flaschen
 *  - low: 1–2 Flaschen
 */
export const getPairingGaps = (wines: WineLite[]): PairingGap[] => {
  const counts = new Map<PairingCategory, number>();
  PAIRING_CATEGORIES.forEach((c) => counts.set(c, 0));
  for (const w of wines) {
    const cats = (w.pairing_categories ?? []) as PairingCategory[];
    for (const c of cats) {
      if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + w.bottle_count);
    }
  }
  const gaps: PairingGap[] = [];
  counts.forEach((bottles, category) => {
    if (bottles === 0) gaps.push({ category, bottles, level: "missing" });
    else if (bottles <= 2) gaps.push({ category, bottles, level: "low" });
  });
  return gaps.sort((a, b) => a.bottles - b.bottles);
};

export interface CellarStats {
  totalBottles: number;
  uniqueWines: number;
  drinkableNow: number;
  countries: number;
  grapes: number;
  estimatedValueMin: number;
  estimatedValueMax: number;
}

export const getCellarStats = (wines: WineLite[]): CellarStats => {
  const year = new Date().getFullYear();
  let totalBottles = 0;
  let drinkableNow = 0;
  let estimatedValueMin = 0;
  let estimatedValueMax = 0;
  const countries = new Set<string>();
  const grapes = new Set<string>();
  for (const w of wines) {
    totalBottles += w.bottle_count;
    const inWindow =
      (w.drink_from == null || w.drink_from <= year) &&
      (w.drink_to == null || w.drink_to >= year);
    if (inWindow) drinkableNow += w.bottle_count;
    if (w.country) countries.add(w.country);
    if (w.grape_variety) grapes.add(w.grape_variety);
    const pMin = Number(w.price_min ?? 0);
    const pMax = Number(w.price_max ?? w.price_min ?? 0);
    estimatedValueMin += pMin * w.bottle_count;
    estimatedValueMax += pMax * w.bottle_count;
  }
  return {
    totalBottles,
    uniqueWines: wines.length,
    drinkableNow,
    countries: countries.size,
    grapes: grapes.size,
    estimatedValueMin,
    estimatedValueMax,
  };
};
