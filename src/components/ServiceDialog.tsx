import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wine as WineIcon, Thermometer, Timer, GlassWater, Play, Pause, RotateCcw } from "lucide-react";
import { getServiceAdvice } from "@/lib/serviceAdvice";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wine: any;
  onServed: (newBottleCount: number) => void;
}

export const ServiceDialog = ({ open, onOpenChange, wine, onServed }: Props) => {
  const advice = getServiceAdvice(wine ?? {});
  const [step, setStep] = useState<"confirm" | "serving">("confirm");
  const [seconds, setSeconds] = useState(advice.decantMinutes * 60);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("confirm");
      setSeconds(advice.decantMinutes * 60);
      setRunning(false);
    }
  }, [open, advice.decantMinutes]);

  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          toast.success("⏰ Dekantierzeit erreicht – Glas einschenken!");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [running]);

  const handleServe = async () => {
    setSaving(true);
    const newCount = Math.max(0, (wine.bottle_count ?? 1) - 1);
    const { error } = await supabase.from("wines").update({ bottle_count: newCount }).eq("id", wine.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(newCount === 0 ? "Letzte Flasche entnommen 🥲" : `Flasche entnommen – ${newCount} verbleibend`);
    onServed(newCount);
    setStep("serving");
    if (advice.decantMinutes > 0) setRunning(true);
  };

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="serif text-2xl flex items-center gap-2">
            <WineIcon className="w-5 h-5 text-primary" />
            {step === "confirm" ? "Flasche servieren" : "Service-Modus"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Timer className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div><span className="font-medium">Dekantieren:</span> {advice.decant}</div>
            </div>
            <div className="flex items-start gap-2">
              <GlassWater className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div><span className="font-medium">Glas:</span> {advice.glass}</div>
            </div>
            <div className="flex items-start gap-2">
              <Thermometer className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div><span className="font-medium">Temperatur:</span> {advice.temperature}</div>
            </div>
          </div>

          {step === "confirm" ? (
            <p className="text-muted-foreground">
              Aktueller Bestand: <strong>{wine?.bottle_count} Flasche(n)</strong>. Nach dem Servieren wird der
              Bestand automatisch um 1 reduziert.
            </p>
          ) : advice.decantMinutes > 0 ? (
            <div className="text-center py-4">
              <div className="serif text-5xl font-semibold tabular-nums">{fmt(seconds)}</div>
              <p className="text-xs text-muted-foreground mt-1">Dekantier-Timer</p>
              <div className="flex justify-center gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => setRunning((r) => !r)}>
                  {running ? <><Pause className="w-3 h-3 mr-1" /> Pause</> : <><Play className="w-3 h-3 mr-1" /> Start</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSeconds(advice.decantMinutes * 60); setRunning(false); }}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-2">Direkt servieren – kein Dekantieren nötig.</p>
          )}
        </div>

        <DialogFooter>
          {step === "confirm" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={handleServe} disabled={saving || (wine?.bottle_count ?? 0) <= 0} className="bg-bordeaux-gradient">
                Flasche entnehmen
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)} className="bg-bordeaux-gradient">Fertig</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
