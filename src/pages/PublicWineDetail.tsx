import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Wine as WineIcon } from "lucide-react";
import { WinePhoto } from "@/components/WinePhoto";

const PublicWineDetail = () => {
  const { token, id } = useParams();
  const navigate = useNavigate();
  const [wine, setWine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    (async () => {
      const { data } = await supabase.rpc("get_shared_wines", { share_token: token });
      const found = (data ?? []).find((w: any) => w.id === id);
      setWine(found ?? null);
      setLoading(false);
    })();
  }, [token, id]);

  if (loading) return <p className="text-center py-12 text-muted-foreground">Lädt...</p>;
  if (!wine) return <p className="text-center py-12 text-muted-foreground">Wein nicht gefunden</p>;

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate(`/keller/${token}`)} className="mb-4">
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
          <h1 className="serif text-4xl font-semibold">{wine.name}</h1>
          {wine.winery && <p className="text-muted-foreground mt-1">{wine.winery}</p>}
          {wine.rating > 0 && <div className="my-4"><StarRating value={wine.rating} readonly /></div>}
          <div className="flex flex-wrap gap-2 my-4">
            {wine.vintage && <Badge variant="secondary">{wine.vintage}</Badge>}
            {wine.grape_variety && <Badge variant="secondary">{wine.grape_variety}</Badge>}
            {wine.region && <Badge variant="secondary">{wine.region}</Badge>}
          </div>
          {wine.notes && (
            <div className="mt-6 pt-6 border-t border-border">
              <h2 className="serif text-xl font-semibold mb-2">Notizen</h2>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{wine.notes}</p>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
};

export default PublicWineDetail;
