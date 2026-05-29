import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Sparkles, ShoppingBasket, Wine as WineIcon, Globe, Grape, Printer, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  getDrinkAlerts,
  getPairingGaps,
  getCellarStats,
  type WineLite,
} from "@/lib/cellarAnalysis";
import { pairingCategoryEmoji } from "@/lib/pairingCategories";

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wines, setWines] = useState<WineLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id, name, winery, vintage, bottle_count, drink_from, drink_to, pairing_categories, rating, country, grape_variety, region, price_min, price_max");
      if (error) toast.error(error.message);
      else setWines((data as WineLite[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const alerts = useMemo(() => getDrinkAlerts(wines), [wines]);
  const gaps = useMemo(() => getPairingGaps(wines), [wines]);
  const stats = useMemo(() => getCellarStats(wines), [wines]);
  const topValuable = useMemo(() => {
    return [...wines]
      .map((w) => {
        const min = Number(w.price_min ?? 0);
        const max = Number(w.price_max ?? w.price_min ?? 0);
        const perBottle = max > 0 ? (min + max) / 2 : 0;
        return { wine: w, perBottle, total: perBottle * w.bottle_count };
      })
      .filter((x) => x.perBottle > 0)
      .sort((a, b) => b.perBottle - a.perBottle)
      .slice(0, 10);
  }, [wines]);

  const past = alerts.filter((a) => a.kind === "past");
  const peak = alerts.filter((a) => a.kind === "peak");
  const soon = alerts.filter((a) => a.kind === "soon");
  const missing = gaps.filter((g) => g.level === "missing");
  const low = gaps.filter((g) => g.level === "low");

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 print:py-2">
        <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="serif text-4xl sm:text-5xl font-semibold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">Trinkfenster, Lücken & Einkaufsliste auf einen Blick</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Drucken
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Lädt...</p>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard icon={<WineIcon className="w-4 h-4" />} label="Flaschen" value={stats.totalBottles} />
              <StatCard icon={<Sparkles className="w-4 h-4" />} label="Jetzt trinkbar" value={stats.drinkableNow} />
              <StatCard icon={<Globe className="w-4 h-4" />} label="Länder" value={stats.countries} />
              <StatCard icon={<Grape className="w-4 h-4" />} label="Rebsorten" value={stats.grapes} />
              <StatCard
                icon={<span className="text-xs font-semibold leading-none">CHF</span>}
                label="Bestandswert"
                value={
                  stats.estimatedValueMax > 0
                    ? stats.estimatedValueMin === stats.estimatedValueMax
                      ? `${stats.estimatedValueMin.toFixed(0)} CHF`
                      : `${stats.estimatedValueMin.toFixed(0)}–${stats.estimatedValueMax.toFixed(0)} CHF`
                    : "–"
                }
              />
            </div>

            {/* Trinkfenster-Erinnerungen */}
            <Card className="p-6 bg-card/60">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-primary" />
                <h2 className="serif text-2xl font-semibold">Trinkfenster-Erinnerungen</h2>
              </div>
              {alerts.length === 0 ? (
                <p className="text-muted-foreground text-sm">Alles entspannt – keine Weine drängen aktuell.</p>
              ) : (
                <div className="space-y-4">
                  {past.length > 0 && (
                    <AlertGroup
                      title="Höhepunkt überschritten"
                      icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
                      tone="destructive"
                      items={past}
                    />
                  )}
                  {peak.length > 0 && (
                    <AlertGroup
                      title="Letztes Jahr im Trinkfenster"
                      icon={<Sparkles className="w-4 h-4 text-amber-500" />}
                      tone="warning"
                      items={peak}
                    />
                  )}
                  {soon.length > 0 && (
                    <AlertGroup
                      title="Bald trinkreif"
                      icon={<Clock className="w-4 h-4 text-muted-foreground" />}
                      tone="muted"
                      items={soon}
                    />
                  )}
                </div>
              )}
            </Card>

            {/* Lücken-Analyse */}
            <Card className="p-6 bg-card/60">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingBasket className="w-5 h-5 text-primary" />
                <h2 className="serif text-2xl font-semibold">Einkaufsliste & Lücken</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Welche Speisen-Kategorien sind in deinem Keller unterversorgt?
              </p>
              {gaps.length === 0 ? (
                <p className="text-muted-foreground text-sm">Top – alle Kategorien sind solide bestückt.</p>
              ) : (
                <div className="space-y-4">
                  {missing.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2 text-destructive">Komplett fehlend</h3>
                      <div className="flex flex-wrap gap-2">
                        {missing.map((g) => (
                          <Badge key={g.category} variant="destructive" className="text-sm py-1 px-3">
                            {pairingCategoryEmoji[g.category]} {g.category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {low.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2 text-amber-600 dark:text-amber-400">Niedriger Bestand (≤ 2)</h3>
                      <div className="flex flex-wrap gap-2">
                        {low.map((g) => (
                          <Badge key={g.category} variant="outline" className="text-sm py-1 px-3 border-amber-500/40">
                            {pairingCategoryEmoji[g.category]} {g.category} · {g.bottles}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-2 print:hidden">
                    <Button size="sm" variant="outline" onClick={() => navigate("/recommend")}>
                      <Sparkles className="w-4 h-4 mr-2" /> KI fragen, was zu kaufen wäre
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Top wertvolle Flaschen */}
            {topValuable.length > 0 && (
              <Card className="p-6 bg-card/60">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h2 className="serif text-2xl font-semibold">Top 10 wertvollste Flaschen</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Geschätzter Marktwert pro Flasche (Mittelwert von price_min/price_max).
                </p>
                <ol className="space-y-1.5">
                  {topValuable.map((t, i) => (
                    <li key={t.wine.id}>
                      <Link
                        to={`/wine/${t.wine.id}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm hover:bg-accent/40 transition"
                      >
                        <span className="truncate">
                          <span className="text-muted-foreground tabular-nums mr-2">{i + 1}.</span>
                          <span className="font-medium">{t.wine.name}</span>
                          {t.wine.vintage && <span className="text-muted-foreground"> · {t.wine.vintage}</span>}
                          {t.wine.winery && <span className="text-muted-foreground"> · {t.wine.winery}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {t.perBottle.toFixed(0)} CHF · {t.wine.bottle_count}× · ges. {t.total.toFixed(0)} CHF
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <Card className="p-4 bg-card/60">
    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
      {icon}
      <span>{label}</span>
    </div>
    <div className="serif text-2xl font-semibold">{value}</div>
  </Card>
);

const AlertGroup = ({
  title,
  icon,
  tone,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "destructive" | "warning" | "muted";
  items: ReturnType<typeof getDrinkAlerts>;
}) => {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "warning"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-border bg-muted/30";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-medium">
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground">({items.length})</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.wine.id}>
            <Link
              to={`/wine/${a.wine.id}`}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent/40 transition ${toneClass}`}
            >
              <span className="truncate">
                <span className="font-medium">{a.wine.name}</span>
                {a.wine.vintage && <span className="text-muted-foreground"> · {a.wine.vintage}</span>}
                {a.wine.winery && <span className="text-muted-foreground"> · {a.wine.winery}</span>}
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {a.message} · {a.wine.bottle_count}×
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
