import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Wine {
  id: string;
  name: string;
  winery: string | null;
  vintage: number | null;
  grape_variety: string | null;
  region: string | null;
  country: string | null;
  wine_type: string | null;
  bottle_count: number;
  rating: number | null;
  drink_from: number | null;
  drink_to: number | null;
  price_min: number | null;
  price_max: number | null;
}

type SortKey = "name" | "country" | "vintage" | "type" | "bottles";

const sortLabels: Record<SortKey, string> = {
  name: "Name (A–Z)",
  country: "Land, dann Name",
  vintage: "Jahrgang (neueste zuerst)",
  type: "Weintyp, dann Name",
  bottles: "Flaschenzahl (absteigend)",
};

const Report = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wines, setWines] = useState<Wine[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showWindow, setShowWindow] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("id,name,winery,vintage,grape_variety,region,country,wine_type,bottle_count,rating,drink_from,drink_to,price_min,price_max")
        .eq("user_id", user.id)
        .order("name");
      if (error) toast.error("Weine konnten nicht geladen werden.");
      setWines((data as Wine[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const rows = useMemo(() => {
    let list = [...wines];
    if (onlyInStock) list = list.filter((w) => (w.bottle_count ?? 0) > 0);
    const byName = (a: Wine, b: Wine) => a.name.localeCompare(b.name, "de");
    list.sort((a, b) => {
      switch (sortKey) {
        case "country":
          return (a.country ?? "zzz").localeCompare(b.country ?? "zzz", "de") || byName(a, b);
        case "vintage":
          return (b.vintage ?? 0) - (a.vintage ?? 0) || byName(a, b);
        case "type":
          return (a.wine_type ?? "zzz").localeCompare(b.wine_type ?? "zzz", "de") || byName(a, b);
        case "bottles":
          return (b.bottle_count ?? 0) - (a.bottle_count ?? 0) || byName(a, b);
        default:
          return byName(a, b);
      }
    });
    return list;
  }, [wines, sortKey, onlyInStock]);

  const totalBottles = rows.reduce((s, w) => s + (w.bottle_count ?? 0), 0);
  const totalValue = rows.reduce((s, w) => {
    const min = Number(w.price_min ?? 0);
    const max = Number(w.price_max ?? min);
    const avg = min && max ? (min + max) / 2 : min || max || 0;
    return s + avg * (w.bottle_count ?? 0);
  }, 0);

  const priceText = (w: Wine) => {
    const min = w.price_min != null ? Number(w.price_min) : null;
    const max = w.price_max != null ? Number(w.price_max) : null;
    if (min == null && max == null) return "–";
    if (min != null && max != null && min !== max) return `${min}–${max} €`;
    return `${min ?? max} €`;
  };

  const windowText = (w: Wine) => {
    if (w.drink_from == null && w.drink_to == null) return "–";
    return `${w.drink_from ?? "?"}–${w.drink_to ?? "?"}`;
  };

  const generatePdf = () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(114, 22, 43);
      doc.text("Mein Weinkeller", 40, 44);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(
        `Stand: ${today}  ·  ${rows.length} Weine  ·  ${totalBottles} Flaschen${
          showPrices && totalValue > 0 ? `  ·  geschätzter Wert: ${Math.round(totalValue).toLocaleString("de-DE")} €` : ""
        }`,
        40,
        62
      );

      const head = [
        [
          "Wein",
          "Weingut",
          "Jg.",
          "Typ",
          "Rebsorte",
          "Land",
          "Region",
          ...(showWindow ? ["Trinkfenster"] : []),
          ...(showPrices ? ["Preis"] : []),
          "Fl.",
        ],
      ];

      const body = rows.map((w) => [
        w.name,
        w.winery ?? "–",
        w.vintage ? String(w.vintage) : "–",
        w.wine_type ?? "–",
        w.grape_variety ?? "–",
        w.country ?? "–",
        w.region ?? "–",
        ...(showWindow ? [windowText(w)] : []),
        ...(showPrices ? [priceText(w)] : []),
        String(w.bottle_count ?? 0),
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 78,
        margin: { left: 40, right: 40, bottom: 40 },
        styles: { fontSize: 8, cellPadding: 4, textColor: 40, lineColor: [230, 220, 224], lineWidth: 0.3 },
        headStyles: { fillColor: [114, 22, 43], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [250, 246, 247] },
        columnStyles: { [head[0].length - 1]: { halign: "right", cellWidth: 28 } },
        didDrawPage: () => {
          const page = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(140);
          doc.text(
            `Seite ${page}`,
            doc.internal.pageSize.getWidth() - 40,
            doc.internal.pageSize.getHeight() - 20,
            { align: "right" }
          );
        },
      });

      doc.save(`weinkeller-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF erstellt.");
    } catch (e) {
      toast.error("PDF konnte nicht erstellt werden.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-6 h-6 text-primary" />
          <h1 className="serif text-3xl font-semibold">Keller-Report</h1>
        </div>
        <p className="text-muted-foreground mb-6">
          Erstelle jederzeit eine aktuelle PDF-Liste deiner Weine inklusive Flaschenzahl.
        </p>

        <Card className="p-6 space-y-6">
          <div className="space-y-2">
            <Label>Sortierung</Label>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabels).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="stock">Nur Weine mit Bestand</Label>
              <Switch id="stock" checked={onlyInStock} onCheckedChange={setOnlyInStock} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prices">Preisspanne anzeigen</Label>
              <Switch id="prices" checked={showPrices} onCheckedChange={setShowPrices} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="win">Trinkfenster anzeigen</Label>
              <Switch id="win" checked={showWindow} onCheckedChange={setShowWindow} />
            </div>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
            {loading ? "Lade Weine…" : `${rows.length} Weine · ${totalBottles} Flaschen`}
            {!loading && showPrices && totalValue > 0 && (
              <> · geschätzter Wert {Math.round(totalValue).toLocaleString("de-DE")} €</>
            )}
          </div>

          <Button
            className="w-full bg-bordeaux-gradient"
            size="lg"
            disabled={loading || generating || rows.length === 0}
            onClick={generatePdf}
          >
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            PDF erstellen
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Report;
