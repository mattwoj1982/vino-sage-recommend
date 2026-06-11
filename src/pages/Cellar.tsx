import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { WineCard } from "@/components/WineCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Wine as WineIcon, Plus, ChefHat, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getDrinkStatus, type DrinkStatus } from "@/lib/drinkWindow";
import { PAIRING_CATEGORIES, pairingCategoryEmoji } from "@/lib/pairingCategories";

interface Wine {
  id: string;
  name: string;
  winery: string | null;
  vintage: number | null;
  grape_variety: string | null;
  region: string | null;
  country: string | null;
  rating: number | null;
  photo_url: string | null;
  bottle_count: number;
  drink_from: number | null;
  drink_to: number | null;
  pairing_categories: string[] | null;
  wine_type: string | null;
}

const WINE_TYPES = ["Weißwein", "Rotwein", "Rosé", "Schaumwein"];

const Cellar = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [grape, setGrape] = useState("all");
  const [region, setRegion] = useState("all");
  const [country, setCountry] = useState("all");
  const [vintage, setVintage] = useState("all");
  const [drinkWindow, setDrinkWindow] = useState<"all" | DrinkStatus>("all");
  const [pairing, setPairing] = useState("all");
  const [wineType, setWineType] = useState("all");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillingTypes, setBackfillingTypes] = useState(false);

  const refetchWines = async () => {
    const { data: fresh } = await supabase
      .from("wines")
      .select("id, name, winery, vintage, grape_variety, region, country, rating, photo_url, bottle_count, drink_from, drink_to, pairing_categories, wine_type")
      .order("created_at", { ascending: false });
    if (fresh) setWines(fresh as Wine[]);
  };

  const backfillCountries = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-countries");
      if (error) throw error;
      const d = data as { updated?: number; total?: number; failed?: number; error?: string };
      if (d?.error) throw new Error(d.error);
      toast.success(`Länder ergänzt: ${d.updated ?? 0} von ${d.total ?? 0}${d.failed ? ` (${d.failed} fehlgeschlagen)` : ""}`);
      await refetchWines();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Ergänzen der Länder");
    } finally {
      setBackfilling(false);
    }
  };

  const backfillWineTypes = async () => {
    setBackfillingTypes(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-wine-types");
      if (error) throw error;
      const d = data as { updated?: number; total?: number; failed?: number; error?: string };
      if (d?.error) throw new Error(d.error);
      toast.success(`Typen ergänzt: ${d.updated ?? 0} von ${d.total ?? 0}${d.failed ? ` (${d.failed} fehlgeschlagen)` : ""}`);
      await refetchWines();
    } catch (e: any) {
      toast.error(e.message ?? "Fehler beim Ergänzen der Typen");
    } finally {
      setBackfillingTypes(false);
    }
  };


  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id, name, winery, vintage, grape_variety, region, country, rating, photo_url, bottle_count, drink_from, drink_to, pairing_categories, wine_type")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      else setWines((data as Wine[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const grapes = useMemo(() => Array.from(new Set(wines.map(w => w.grape_variety).filter(Boolean))) as string[], [wines]);
  const regions = useMemo(() => Array.from(new Set(
    wines.filter(w => country === "all" || w.country === country).map(w => w.region).filter(Boolean)
  )).sort() as string[], [wines, country]);

  useEffect(() => {
    if (region !== "all" && !regions.includes(region)) setRegion("all");
  }, [regions, region]);
  const countries = useMemo(() => Array.from(new Set(wines.map(w => w.country).filter(Boolean))).sort() as string[], [wines]);
  const vintages = useMemo(() => Array.from(new Set(wines.map(w => w.vintage).filter(Boolean))).sort((a, b) => (b as number) - (a as number)) as number[], [wines]);

  const filtered = useMemo(() => wines.filter(w => {
    const s = search.toLowerCase();
    if (s && !`${w.name} ${w.winery ?? ""} ${w.region ?? ""} ${w.country ?? ""} ${w.grape_variety ?? ""}`.toLowerCase().includes(s)) return false;
    if (grape !== "all" && w.grape_variety !== grape) return false;
    if (region !== "all" && w.region !== region) return false;
    if (country !== "all" && w.country !== country) return false;
    if (vintage !== "all" && String(w.vintage) !== vintage) return false;
    if (drinkWindow !== "all" && getDrinkStatus(w.drink_from, w.drink_to) !== drinkWindow) return false;
    if (pairing !== "all" && !(w.pairing_categories ?? []).includes(pairing)) return false;
    if (wineType !== "all" && w.wine_type !== wineType) return false;
    return true;
  }), [wines, search, grape, region, country, vintage, drinkWindow, pairing, wineType]);

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="serif text-4xl sm:text-5xl font-semibold mb-2">Dein Weinkeller</h1>
          <p className="text-muted-foreground">{wines.length} {wines.length === 1 ? "Wein" : "Weine"} in deiner Sammlung</p>
        </div>

        <Button
          onClick={() => navigate("/sommelier")}
          size="lg"
          className="w-full sm:w-auto mb-6 bg-bordeaux-gradient shadow-glow"
        >
          <ChefHat className="w-5 h-5 mr-2" />
          KI-Sommelier: Weine zum Menü finden
        </Button>

        {wines.some(w => !w.country) && (
          <Button
            onClick={backfillCountries}
            disabled={backfilling}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto mb-6 sm:ml-2"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {backfilling ? "Ergänze Länder per KI..." : `Länder per KI ergänzen (${wines.filter(w => !w.country).length})`}
          </Button>
        )}

        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Weingut, Region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card/50"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            <Select value={grape} onValueChange={setGrape}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Rebsorte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Rebsorten</SelectItem>
                {grapes.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Regionen</SelectItem>
                {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Land" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Länder</SelectItem>
                {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vintage} onValueChange={setVintage}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Jahrgang" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Jahrgänge</SelectItem>
                {vintages.map(v => <SelectItem key={v} value={String(v)}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={drinkWindow} onValueChange={(v) => setDrinkWindow(v as "all" | DrinkStatus)}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Trinkfenster" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Trinkfenster</SelectItem>
                <SelectItem value="now">🍷 Jetzt trinken</SelectItem>
                <SelectItem value="wait">⏳ Noch warten</SelectItem>
                <SelectItem value="past">⌛ Höhepunkt überschritten</SelectItem>
                <SelectItem value="unknown">❓ Unbekannt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pairing} onValueChange={setPairing}>
              <SelectTrigger className="bg-card/50"><SelectValue placeholder="Speise" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Speisen</SelectItem>
                {PAIRING_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{pairingCategoryEmoji[c]} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Lädt...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/30">
            <WineIcon className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <p className="serif text-2xl mb-2">{wines.length === 0 ? "Dein Keller wartet auf den ersten Wein" : "Keine Treffer"}</p>
            <p className="text-muted-foreground mb-6">{wines.length === 0 ? "Erfasse deinen ersten Wein und bau deine Sammlung auf." : "Versuche andere Suchbegriffe oder Filter."}</p>
            {wines.length === 0 && (
              <Button onClick={() => navigate("/wine/new")} className="bg-bordeaux-gradient">
                <Plus className="w-4 h-4 mr-2" /> Ersten Wein hinzufügen
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(w => <WineCard key={w.id} wine={w} />)}
          </div>
        )}
      </main>
    </div>
  );
};

export default Cellar;
