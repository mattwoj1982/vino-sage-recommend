import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChefHat, Plus, Trash2, Printer, BookOpen, Users } from "lucide-react";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;       // z. B. "Vorspeise"
  dish: string;       // Speise
  wine_id?: string | null;
  wine_label?: string | null;
}

interface Menu {
  id: string;
  name: string;
  guest_count: number;
  courses: Course[];
  notes: string | null;
  created_at: string;
}

interface WineRef { id: string; name: string; winery: string | null; vintage: number | null; bottle_count: number; }

// Annahme: ~3 Gläser pro 0,75-l-Flasche → bottlesNeeded = ceil(guests / 3)
const bottlesPerCourse = (guests: number) => Math.max(1, Math.ceil(guests / 3));

const Menus = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [wines, setWines] = useState<WineRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Menu | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  const load = async () => {
    const [m, w] = await Promise.all([
      supabase.from("menus").select("*").order("created_at", { ascending: false }),
      supabase.from("wines").select("id, name, winery, vintage, bottle_count").order("name"),
    ]);
    if (m.error) toast.error(m.error.message);
    else setMenus((m.data ?? []).map((x: any) => ({ ...x, courses: x.courses ?? [] })) as Menu[]);
    setWines((w.data as WineRef[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const createNew = () => {
    setEditing({
      id: "",
      name: "",
      guest_count: 4,
      courses: [
        { id: crypto.randomUUID(), name: "Apéro", dish: "" },
        { id: crypto.randomUUID(), name: "Vorspeise", dish: "" },
        { id: crypto.randomUUID(), name: "Hauptgang", dish: "" },
        { id: crypto.randomUUID(), name: "Dessert", dish: "" },
      ],
      notes: null,
      created_at: new Date().toISOString(),
    });
  };

  const saveMenu = async () => {
    if (!editing || !user) return;
    if (!editing.name.trim()) return toast.error("Bitte Menünamen vergeben");
    const payload = {
      user_id: user.id,
      name: editing.name.trim(),
      guest_count: editing.guest_count,
      courses: editing.courses as any,
      notes: editing.notes,
    };
    const { error } = editing.id
      ? await supabase.from("menus").update(payload).eq("id", editing.id)
      : await supabase.from("menus").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Menü gespeichert");
    setEditing(null);
    load();
  };

  const deleteMenu = async (id: string) => {
    if (!confirm("Menü löschen?")) return;
    const { error } = await supabase.from("menus").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setMenus((m) => m.filter((x) => x.id !== id));
  };

  const printMenu = (menu: Menu) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const total = menu.courses.filter((c) => c.wine_id).length * bottlesPerCourse(menu.guest_count);
    win.document.write(`
      <html><head><title>${menu.name}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 600px; margin: 2rem auto; padding: 2rem; color: #222; }
        h1 { font-size: 2rem; border-bottom: 2px solid #722f37; padding-bottom: .5rem; }
        .meta { color: #666; margin-bottom: 2rem; }
        .course { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #eee; }
        .course-name { font-size: .85rem; text-transform: uppercase; letter-spacing: .1em; color: #722f37; }
        .dish { font-size: 1.15rem; margin: .3rem 0; }
        .wine { font-style: italic; color: #555; }
        .footer { margin-top: 2rem; padding-top: 1rem; border-top: 2px solid #722f37; font-size: .9rem; color: #666; }
      </style></head><body>
      <h1>${menu.name}</h1>
      <div class="meta">Für ${menu.guest_count} Gäste · ${menu.courses.length} Gänge</div>
      ${menu.courses.map((c) => `
        <div class="course">
          <div class="course-name">${c.name}</div>
          <div class="dish">${c.dish || "—"}</div>
          ${c.wine_label ? `<div class="wine">🍷 ${c.wine_label}</div>` : ""}
        </div>
      `).join("")}
      <div class="footer">Geplante Flaschenmenge: ca. <strong>${total}</strong> Flaschen (~3 Gläser pro Flasche)</div>
      ${menu.notes ? `<div class="footer">Notizen: ${menu.notes}</div>` : ""}
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 200);
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="serif text-3xl sm:text-4xl font-semibold flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-primary" /> Menü-Bibliothek
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Plane Menüs mit Weinbegleitung und Flaschenkalkulation</p>
          </div>
          <Button onClick={createNew} className="bg-bordeaux-gradient">
            <Plus className="w-4 h-4 mr-2" /> Neues Menü
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12">Lädt...</p>
        ) : menus.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/30">
            <ChefHat className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <p className="serif text-2xl mb-2">Noch keine Menüs</p>
            <p className="text-muted-foreground mb-6">Plane dein erstes Menü inklusive Weinpairing.</p>
            <Button onClick={createNew} className="bg-bordeaux-gradient">
              <Plus className="w-4 h-4 mr-2" /> Menü erstellen
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {menus.map((m) => {
              const bottles = m.courses.filter((c) => c.wine_id).length * bottlesPerCourse(m.guest_count);
              return (
                <Card key={m.id} className="p-5 bg-card/40 hover:bg-card/60 transition cursor-pointer" onClick={() => setEditing(m)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="serif text-xl font-semibold">{m.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {m.guest_count} Gäste</span>
                        <span>· {m.courses.length} Gänge</span>
                        <span>· ca. {bottles} Flaschen</span>
                      </p>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => printMenu(m)}><Printer className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMenu(m.id)}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="serif text-2xl">{editing.id ? "Menü bearbeiten" : "Neues Menü"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="z. B. Weihnachtsdinner 2026" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Gäste</label>
                  <Input type="number" min={1} value={editing.guest_count} onChange={(e) => setEditing({ ...editing, guest_count: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Gänge</h3>
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...editing, courses: [...editing.courses, { id: crypto.randomUUID(), name: "Neuer Gang", dish: "" }] })}>
                    <Plus className="w-3 h-3 mr-1" /> Gang
                  </Button>
                </div>
                {editing.courses.map((c, idx) => (
                  <Card key={c.id} className="p-3 bg-card/40 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input className="w-40" value={c.name} onChange={(e) => {
                        const cs = [...editing.courses]; cs[idx] = { ...c, name: e.target.value }; setEditing({ ...editing, courses: cs });
                      }} placeholder="Gang" />
                      <Input className="flex-1" value={c.dish} onChange={(e) => {
                        const cs = [...editing.courses]; cs[idx] = { ...c, dish: e.target.value }; setEditing({ ...editing, courses: cs });
                      }} placeholder="Speise" />
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...editing, courses: editing.courses.filter((_, i) => i !== idx) })}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <Select
                      value={c.wine_id ?? "none"}
                      onValueChange={(v) => {
                        const cs = [...editing.courses];
                        if (v === "none") cs[idx] = { ...c, wine_id: null, wine_label: null };
                        else {
                          const w = wines.find((x) => x.id === v);
                          cs[idx] = { ...c, wine_id: v, wine_label: w ? `${w.name}${w.vintage ? ` ${w.vintage}` : ""}${w.winery ? ` · ${w.winery}` : ""}` : null };
                        }
                        setEditing({ ...editing, courses: cs });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Wein zuweisen (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Kein Wein —</SelectItem>
                        {wines.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}{w.vintage ? ` (${w.vintage})` : ""} · {w.bottle_count} im Keller
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {c.wine_id && (
                      <p className="text-xs text-muted-foreground">
                        Bedarf: ~{bottlesPerCourse(editing.guest_count)} Flasche(n) für {editing.guest_count} Gäste
                      </p>
                    )}
                  </Card>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Notizen</label>
                <Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Abbrechen</Button>
              <Button onClick={saveMenu} className="bg-bordeaux-gradient">Speichern</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Menus;
