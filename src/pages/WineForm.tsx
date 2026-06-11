import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Sparkles } from "lucide-react";
import { WinePhoto } from "@/components/WinePhoto";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { compressImage } from "@/lib/imageCompress";

const WINE_TYPES = ["Weißwein", "Rotwein", "Rosé", "Schaumwein"];

const WineForm = () => {
  const { id } = useParams();
  const isEdit = id && id !== "new";
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [form, setForm] = useState({
    name: "", winery: "", vintage: "", grape_variety: "", region: "", country: "",
    rating: 0, notes: "", photo_url: "", bottle_count: 1, wine_type: "",
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!isEdit || !user) return;
    (async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", id).maybeSingle();
      if (error || !data) { toast.error("Wein nicht gefunden"); navigate("/"); return; }
      setForm({
        name: data.name, winery: data.winery ?? "", vintage: data.vintage?.toString() ?? "",
        grape_variety: data.grape_variety ?? "", region: data.region ?? "", country: data.country ?? "",
        rating: data.rating ?? 0, notes: data.notes ?? "", photo_url: data.photo_url ?? "",
        bottle_count: data.bottle_count, wine_type: (data as any).wine_type ?? "",
      });
    })();
  }, [id, user, isEdit, navigate]);

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("analyze-wine-label", {
        body: { image_base64: base64, media_type: file.type || "image/jpeg" },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.fallback) {
          toast.info(`${data.error}. Du kannst die Felder manuell ausfüllen.`);
        } else {
          toast.error(data.error);
        }
        return;
      }
      setForm(f => ({
        ...f,
        name: data.name || f.name,
        winery: data.winery ?? f.winery,
        vintage: data.vintage ? String(data.vintage) : f.vintage,
        grape_variety: data.grape_variety ?? f.grape_variety,
        region: data.region ?? f.region,
        country: data.country ?? f.country,
        wine_type: data.wine_type ?? f.wine_type,
      }));
      toast.success("Wein erkannt – Felder ausgefüllt");
    } catch (e: any) {
      toast.error(e.message || "Erkennung fehlgeschlagen");
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    if (!original || !user) return;
    setUploading(true);
    const file = await compressImage(original);
    const path = `${user.id}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("wine-photos").upload(path, file, { contentType: file.type });
    if (error) { toast.error(error.message); setUploading(false); return; }
    // Store the storage path; signed URLs are generated on demand for display.
    setForm(f => ({ ...f, photo_url: path }));
    setUploading(false);
    toast.success("Foto hochgeladen");
    // Auto-analyze label
    analyzeImage(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name,
      winery: form.winery || null,
      vintage: form.vintage ? parseInt(form.vintage) : null,
      grape_variety: form.grape_variety || null,
      region: form.region || null,
      country: form.country || null,
      rating: form.rating || null,
      notes: form.notes || null,
      photo_url: form.photo_url || null,
      bottle_count: form.bottle_count,
      wine_type: form.wine_type || null,
    };
    const res = isEdit
      ? await supabase.from("wines").update(payload).eq("id", id!)
      : await supabase.from("wines").insert(payload);
    setSaving(false);
    if (res.error) toast.error(res.error.message);
    else { toast.success(isEdit ? "Aktualisiert" : "Hinzugefügt"); navigate("/"); }
  };

  const handleDelete = async () => {
    if (!isEdit || !confirm("Wein wirklich löschen?")) return;
    const { error } = await supabase.from("wines").delete().eq("id", id!);
    if (error) toast.error(error.message);
    else { toast.success("Gelöscht"); navigate("/"); }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        <Card className="p-6 sm:p-8 bg-card/70 backdrop-blur shadow-elegant">
          <h1 className="serif text-3xl font-semibold mb-6">{isEdit ? "Wein bearbeiten" : "Neuer Wein"}</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Foto vom Etikett</Label>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent" /> Claude erkennt den Wein automatisch
              </p>
              <div className="flex items-center gap-3">
                {form.photo_url && (
                  <WinePhoto
                    photoUrl={form.photo_url}
                    alt="Wein"
                    className="w-20 h-20 object-cover rounded-md border border-border"
                  />
                )}
                <label className="flex-1">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" disabled={uploading || analyzing} />
                  <div className="border border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/50 transition">
                    {analyzing ? (
                      <Sparkles className="w-5 h-5 mx-auto mb-1 text-accent animate-pulse" />
                    ) : (
                      <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Lädt hoch..." : analyzing ? "Etikett wird analysiert..." : "Foto hochladen"}
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="winery">Weingut</Label>
                <Input id="winery" value={form.winery} onChange={(e) => setForm(f => ({ ...f, winery: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="vintage">Jahrgang</Label>
                <Input id="vintage" type="number" value={form.vintage} onChange={(e) => setForm(f => ({ ...f, vintage: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="grape">Rebsorte</Label>
                <Input id="grape" value={form.grape_variety} onChange={(e) => setForm(f => ({ ...f, grape_variety: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="region">Region</Label>
                <Input id="region" value={form.region} onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="country">Land</Label>
                <Input id="country" value={form.country} onChange={(e) => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="wine_type">Typ</Label>
                <Select value={form.wine_type || undefined} onValueChange={(v) => setForm(f => ({ ...f, wine_type: v }))}>
                  <SelectTrigger id="wine_type"><SelectValue placeholder="Weintyp wählen" /></SelectTrigger>
                  <SelectContent>
                    {WINE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="bottles">Anzahl Flaschen</Label>
                <Input id="bottles" type="number" min={0} value={form.bottle_count}
                  onChange={(e) => setForm(f => ({ ...f, bottle_count: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Bewertung</Label>
                <div className="mt-2"><StarRating value={form.rating} onChange={(v) => setForm(f => ({ ...f, rating: v }))} /></div>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notizen</Label>
              <Textarea id="notes" rows={4} value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button type="submit" disabled={saving} className="flex-1 bg-bordeaux-gradient">
                {saving ? "Speichern..." : isEdit ? "Aktualisieren" : "Hinzufügen"}
              </Button>
              {isEdit && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4 mr-2" /> Löschen
                </Button>
              )}
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export default WineForm;
