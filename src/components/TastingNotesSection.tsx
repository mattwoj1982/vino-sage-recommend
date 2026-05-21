import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import { Notebook, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TastingNote {
  id: string;
  tasted_at: string;
  rating: number | null;
  notes: string | null;
  occasion: string | null;
}

export const TastingNotesSection = ({ wineId }: { wineId: string }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<TastingNote[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    tasted_at: new Date().toISOString().slice(0, 10),
    rating: 0,
    notes: "",
    occasion: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("tasting_notes")
      .select("id, tasted_at, rating, notes, occasion")
      .eq("wine_id", wineId)
      .order("tasted_at", { ascending: false });
    setNotes((data as TastingNote[]) ?? []);
  };

  useEffect(() => { load(); }, [wineId]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("tasting_notes").insert({
      wine_id: wineId,
      user_id: user.id,
      tasted_at: form.tasted_at,
      rating: form.rating || null,
      notes: form.notes || null,
      occasion: form.occasion || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Verkostungsnotiz gespeichert");
    setForm({ tasted_at: new Date().toISOString().slice(0, 10), rating: 0, notes: "", occasion: "" });
    setAdding(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasting_notes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setNotes((n) => n.filter((x) => x.id !== id));
  };

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="serif text-xl font-semibold flex items-center gap-2">
          <Notebook className="w-5 h-5 text-primary" /> Verkostungshistorie
          {notes.length > 0 && <span className="text-sm text-muted-foreground">({notes.length})</span>}
        </h2>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4 mr-1" /> Notiz hinzufügen
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-4 mb-4 space-y-3 bg-card/40">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Datum</label>
              <Input type="date" value={form.tasted_at} onChange={(e) => setForm({ ...form, tasted_at: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Anlass</label>
              <Input value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} placeholder="z. B. Geburtstag" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Bewertung</label>
            <StarRating value={form.rating} onChange={(v) => setForm({ ...form, rating: v })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notizen</label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Aromen, Eindrücke..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
            <Button size="sm" onClick={save} className="bg-bordeaux-gradient">Speichern</Button>
          </div>
        </Card>
      )}

      {notes.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">Noch keine Verkostungen erfasst.</p>
      )}

      <div className="space-y-3">
        {notes.map((n) => (
          <Card key={n.id} className="p-4 bg-card/40">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {new Date(n.tasted_at).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
                  {n.occasion && <span className="text-muted-foreground">· {n.occasion}</span>}
                </div>
                {n.rating ? <div className="mt-1"><StarRating value={n.rating} readonly /></div> : null}
                {n.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2">{n.notes}</p>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(n.id)}>
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
