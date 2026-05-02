export const PAIRING_CATEGORIES = [
  "Rotes Fleisch",
  "Geflügel",
  "Wild",
  "Fisch & Meeresfrüchte",
  "Pasta & Pizza",
  "Käse",
  "Vegetarisch",
  "Würzige Küche",
  "Dessert",
  "Apéro / Solo",
] as const;

export type PairingCategory = typeof PAIRING_CATEGORIES[number];

export const pairingCategoryEmoji: Record<string, string> = {
  "Rotes Fleisch": "🥩",
  "Geflügel": "🍗",
  "Wild": "🦌",
  "Fisch & Meeresfrüchte": "🐟",
  "Pasta & Pizza": "🍝",
  "Käse": "🧀",
  "Vegetarisch": "🥗",
  "Würzige Küche": "🌶️",
  "Dessert": "🍰",
  "Apéro / Solo": "🥂",
};
