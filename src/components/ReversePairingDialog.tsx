import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wineId: string;
  wineName: string;
}

export const ReversePairingDialog = ({ open, onOpenChange, wineId, wineName }: Props) => {
  const [occasion, setOccasion] = useState("");
  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setPairing(null);
    try {
      const { data, error } = await supabase.functions.invoke("reverse-pairing", {
        body: { wine_id: wineId, occasion: occasion.trim() },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 serif text-2xl">
            <UtensilsCrossed className="w-5 h-5 text-primary" /> Was koche ich dazu?
          </DialogTitle>
          <DialogDescription>
            Reverse-Pairing für „{wineName}". KI schlägt passende Gerichte vor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            placeholder="Anlass oder Wunsch (optional, z.B. '4 Gäste, vegetarisch')"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            maxLength={500}
          />
          <Button
            onClick={handleRun}
            disabled={loading}
            className="w-full bg-bordeaux-gradient"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loading ? "Sommelier denkt nach..." : pairing ? "Neu vorschlagen" : "Gerichte vorschlagen"}
          </Button>

          {pairing && (
            <div className="mt-2 p-4 rounded-xl border border-border bg-card/40">
              <div className="prose prose-invert max-w-none whitespace-pre-wrap serif text-base leading-relaxed">
                {pairing}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
