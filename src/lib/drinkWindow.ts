export type DrinkStatus = "wait" | "now" | "past" | "unknown";

export const getDrinkStatus = (
  drink_from: number | null | undefined,
  drink_to: number | null | undefined,
): DrinkStatus => {
  if (!drink_from && !drink_to) return "unknown";
  const year = new Date().getFullYear();
  if (drink_from && year < drink_from) return "wait";
  if (drink_to && year > drink_to) return "past";
  return "now";
};

export const drinkStatusLabel: Record<DrinkStatus, string> = {
  now: "Jetzt trinken",
  wait: "Noch warten",
  past: "Höhepunkt überschritten",
  unknown: "Unbekannt",
};

export const drinkStatusEmoji: Record<DrinkStatus, string> = {
  now: "🍷",
  wait: "⏳",
  past: "⌛",
  unknown: "❓",
};
