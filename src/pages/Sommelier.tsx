import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChefHat, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

const Sommelier = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState("");
  const [guestCount, setGuestCount] = useState<string>("4");
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const handleSubmit = async () => {
    if (!menu.trim()) {
      toast.error("Bitte beschreibe eine Speise oder ein Menü.");
      return;
    }
    setLoading(true);
    setPairing(null);
    try {
      const guestNum = parseInt(guestCount, 10);
      const { data, error } = await supabase.functions.invoke("sommelier-menu", {
        body: {
          menu: menu.trim(),
          guest_count: Number.isFinite(guestNum) && guestNum > 0 ? guestNum : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPairing(data?.pairing ?? "Keine Empfehlung erhalten.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler bei der Empfehlung");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-bordeaux-gradient flex items-center justify-center shadow-glow">
            <ChefHat className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="serif text-3xl sm:text-4xl font-semibold">KI-Sommelier</h1>
            <p className="text-muted-foreground text-sm">Menü beschreiben – inkl. Glas/Flasche & Alternativen</p>
          </div>
        </div>

        <div className="space-y-4">
          <Textarea
            placeholder={"Beispiel:\nVorspeise: Burrata mit Tomaten und Basilikum\nHauptgang: Geschmorte Lammhaxe mit Rosmarinjus\nDessert: Schokoladenfondant"}
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            rows={8}
            className="bg-card/50 resize-none"
            maxLength={3000}
          />

          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[160px]">
              <Label htmlFor="guests" className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                <Users className="w-3 h-3" /> Gäste
              </Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={50}
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="bg-card/50"
              />
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-bordeaux-gradient"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? "Sommelier denkt nach..." : "Weine empfehlen lassen"}
            </Button>
          </div>
        </div>

        {pairing && (
          <div className="mt-8 p-6 rounded-2xl border border-border bg-card/40 backdrop-blur">
            <div className="prose prose-invert max-w-none whitespace-pre-wrap serif text-base leading-relaxed">
              {pairing}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Sommelier;
