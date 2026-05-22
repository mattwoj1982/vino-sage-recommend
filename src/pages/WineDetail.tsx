import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Wine as WineIcon, Sparkles, UtensilsCrossed, CalendarRange, Tag, GlassWater, ChefHat } from "lucide-react";
import { toast } from "sonner";
import { getDrinkStatus, drinkStatusLabel, drinkStatusEmoji } from "@/lib/drinkWindow";
import { pairingCategoryEmoji } from "@/lib/pairingCategories";
import { WinePhoto } from "@/components/WinePhoto";
import { ServiceDialog } from "@/components/ServiceDialog";
import { TastingNotesSection } from "@/components/TastingNotesSection";
import { ReversePairingDialog } from "@/components/ReversePairingDialog";

const WineDetail = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wine, setWine] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", id).maybeSingle();
      if (error || !data) toast.error("Wein nicht gefunden");
      setWine(data); setLoading(false);
    })();
  }, [id, user]);

  const handleGenerate = async () => {
    if (!wine) return;
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke("describe-wine", {
      body: { wine_id: wine.id },
    });
    setGenerating(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Generierung fehlgeschlagen");
      return;
    }
    setWine({ ...wine, ...data });
    toast.success("Wein-Profil erstellt");
  };

  if (authLoading || loading) return null;
  if (!wine) return null;

  const status = getDrinkStatus(wine.drink_from, wine.drink_to);
  const hasProfile = wine.description || wine.food_pairing || wine.drink_from;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        <Card className="overflow-hidden bg-card/70 backdrop-blur shadow-elegant">
          <div className="aspect-[16/10] bg-wine-gradient relative">
            <WinePhoto
              photoUrl={wine.photo_url}
              alt={wine.name}
              className="w-full h-full object-cover"
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <WineIcon className="w-24 h-24 text-primary-foreground/40" />
                </div>
              }
            />
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h1 className="serif text-4xl font-semibold">{wine.name}</h1>
                {wine.winery && <p className="text-muted-foreground mt-1">{wine.winery}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setServiceOpen(true)}
                  disabled={!wine.bottle_count}
                  className="bg-bordeaux-gradient shadow-glow"
                >
                  <GlassWater className="w-4 h-4 mr-2" /> Servieren
                </Button>
                <Button variant="outline" onClick={() => setReverseOpen(true)}>
                  <ChefHat className="w-4 h-4 mr-2" /> Was koche ich dazu?
                </Button>
                <Button variant="outline" onClick={() => navigate(`/wine/${wine.id}/edit`)}>
                  <Edit className="w-4 h-4 mr-2" /> Bearbeiten
                </Button>
              </div>
            </div>

            {wine.rating > 0 && <div className="my-4"><StarRating value={wine.rating} readonly /></div>}

            <div className="flex flex-wrap gap-2 my-4">
              {wine.vintage && <Badge variant="secondary">{wine.vintage}</Badge>}
              {wine.grape_variety && <Badge variant="secondary">{wine.grape_variety}</Badge>}
              {wine.region && <Badge variant="secondary">{wine.region}</Badge>}
              <Badge className="bg-bordeaux-gradient">{wine.bottle_count} 🍾 im Keller</Badge>
              {status !== "unknown" && (
                <Badge variant="outline" className="border-primary/40">
                  {drinkStatusEmoji[status]} {drinkStatusLabel[status]}
                </Badge>
              )}
            </div>

            {(wine.drink_from || wine.drink_to) && (
              <div className="mt-6 pt-6 border-t border-border">
                <h2 className="serif text-xl font-semibold mb-2 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-primary" /> Bestes Trinkfenster
                </h2>
                <p className="text-muted-foreground">
                  {wine.drink_from ?? "?"} – {wine.drink_to ?? "?"}
                </p>
              </div>
            )}

            {(wine.price_min != null || wine.price_max != null) && (
              <div className="mt-6 pt-6 border-t border-border">
                <h2 className="serif text-xl font-semibold mb-2 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" /> Preisspanne
                </h2>
                <p className="text-muted-foreground">
                  {wine.price_min != null && wine.price_max != null
                    ? `€ ${Number(wine.price_min).toFixed(2)} – € ${Number(wine.price_max).toFixed(2)}`
                    : `ca. € ${Number(wine.price_min ?? wine.price_max).toFixed(2)}`}
                  <span className="text-xs ml-2 opacity-70">(geschätzt, pro 0,75l)</span>
                </p>
              </div>
            )}

            {wine.description && (
              <div className="mt-6 pt-6 border-t border-border">
                <h2 className="serif text-xl font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Beschreibung
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{wine.description}</p>
              </div>
            )}

            {wine.food_pairing && (
              <div className="mt-6 pt-6 border-t border-border">
                <h2 className="serif text-xl font-semibold mb-2 flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-primary" /> Speisen-Empfehlung
                </h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{wine.food_pairing}</p>
                {wine.pairing_categories?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {wine.pairing_categories.map((c: string) => (
                      <Badge key={c} variant="outline" className="border-primary/40">
                        {pairingCategoryEmoji[c] ?? "🍽️"} {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {wine.notes && (
              <div className="mt-6 pt-6 border-t border-border">
                <h2 className="serif text-xl font-semibold mb-2">Eigene Notizen</h2>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{wine.notes}</p>
              </div>
            )}

            <TastingNotesSection wineId={wine.id} />

            <div className="mt-6 pt-6 border-t border-border">
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="bg-bordeaux-gradient hover:opacity-90 transition shadow-glow w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {generating
                  ? "Sommelier denkt nach..."
                  : hasProfile ? "Wein-Profil neu generieren" : "Wein-Profil mit KI erstellen"}
              </Button>
              {!hasProfile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Erzeugt Beschreibung, Speisen-Empfehlung und Trinkfenster.
                </p>
              )}
            </div>
          </div>
        </Card>
      </main>

      <ServiceDialog
        open={serviceOpen}
        onOpenChange={setServiceOpen}
        wine={wine}
        onServed={(c) => setWine({ ...wine, bottle_count: c })}
      />

      <ReversePairingDialog
        open={reverseOpen}
        onOpenChange={setReverseOpen}
        wineId={wine.id}
        wineName={wine.name}
      />
    </div>
  );
};

export default WineDetail;
