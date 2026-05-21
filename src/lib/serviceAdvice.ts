// Heuristik für Dekantier- und Glas-Empfehlungen
export interface ServiceAdvice {
  decant: string;
  decantMinutes: number; // 0 = nicht nötig
  glass: string;
  temperature: string;
}

const includesAny = (haystack: string, terms: string[]) =>
  terms.some((t) => haystack.includes(t.toLowerCase()));

export const getServiceAdvice = (wine: {
  grape_variety?: string | null;
  vintage?: number | null;
  name?: string | null;
}): ServiceAdvice => {
  const g = (wine.grape_variety ?? "").toLowerCase();
  const n = (wine.name ?? "").toLowerCase();
  const text = `${g} ${n}`;
  const age = wine.vintage ? new Date().getFullYear() - wine.vintage : 0;

  // Sparkling
  if (includesAny(text, ["champagne", "champagner", "sekt", "prosecco", "cava", "crémant", "spumante"])) {
    return {
      decant: "Nicht dekantieren – direkt aus der Flasche servieren.",
      decantMinutes: 0,
      glass: "Champagner-Flöte oder schmales Tulpenglas",
      temperature: "6–8 °C",
    };
  }

  // Dessert / fortified
  if (includesAny(text, ["port", "sauternes", "tokaji", "eiswein", "ice wine", "moscato", "riesling spätlese", "trockenbeerenauslese"])) {
    return {
      decant: "Nicht erforderlich.",
      decantMinutes: 0,
      glass: "Kleines Dessertweinglas",
      temperature: "8–12 °C",
    };
  }

  // White / Rosé
  if (includesAny(text, ["riesling", "sauvignon blanc", "chardonnay", "grüner veltliner", "pinot grigio", "pinot gris", "weiß", "weiss", "rosé", "rose", "albariño", "verdejo", "vermentino", "chenin", "gewürztraminer"])) {
    const oaked = includesAny(text, ["barrique", "reserva", "gran reserva"]) || age > 8;
    return {
      decant: oaked
        ? "Optional 15–20 Min. karaffieren, um Aromen zu öffnen."
        : "Nicht dekantieren – frisch servieren.",
      decantMinutes: oaked ? 20 : 0,
      glass: includesAny(text, ["chardonnay"]) ? "Burgunder-Weißweinglas" : "Schlankes Weißweinglas",
      temperature: oaked ? "10–12 °C" : "8–10 °C",
    };
  }

  // Pinot Noir / Nebbiolo / Burgunder
  if (includesAny(text, ["pinot noir", "spätburgunder", "spaetburgunder", "nebbiolo", "barolo", "barbaresco", "burgunder"])) {
    return {
      decant: age > 15
        ? "Vorsichtig dekantieren wegen Depot – 30 Min. vor dem Servieren."
        : "30–60 Min. karaffieren für volle Aromatik.",
      decantMinutes: age > 15 ? 30 : 45,
      glass: "Burgunderglas (bauchig)",
      temperature: "16–18 °C",
    };
  }

  // Full-bodied reds
  if (includesAny(text, ["cabernet", "merlot", "syrah", "shiraz", "bordeaux", "malbec", "tempranillo", "sangiovese", "brunello", "chianti", "rioja", "amarone", "zinfandel", "primitivo", "grenache", "garnacha", "côtes du rhône", "cotes du rhone"])) {
    if (age >= 15) {
      return {
        decant: "Älterer Wein – nur kurz und vorsichtig dekantieren (Depot abtrennen), ca. 20 Min.",
        decantMinutes: 20,
        glass: "Bordeauxglas (hoch, breit)",
        temperature: "17–18 °C",
      };
    }
    if (age <= 4) {
      return {
        decant: "Junger, kräftiger Roter – 60–90 Min. dekantieren für weichere Tannine.",
        decantMinutes: 75,
        glass: "Bordeauxglas (hoch, breit)",
        temperature: "16–18 °C",
      };
    }
    return {
      decant: "30–60 Min. dekantieren für optimale Aromen-Entfaltung.",
      decantMinutes: 45,
      glass: "Bordeauxglas (hoch, breit)",
      temperature: "16–18 °C",
    };
  }

  // Generic red fallback
  return {
    decant: age > 10
      ? "Vorsichtig 20–30 Min. dekantieren."
      : "30 Min. karaffieren empfohlen.",
    decantMinutes: age > 10 ? 25 : 30,
    glass: "Universal-Rotweinglas",
    temperature: "16–18 °C",
  };
};
