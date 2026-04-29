import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { StarRating } from "@/components/StarRating";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Wine as WineIcon } from "lucide-react";
import { toast } from "sonner";

const WineDetail = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [wine, setWine] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data, error } = await supabase.from("wines").select("*").eq("id", id).maybeSingle();
      if (error || !data) toast.error("Wein nicht gefunden");
      setWine(data); setLoading(false);
    })();
  }, [id, user]);

  if (authLoading || loading) return null;
  if (!wine) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Zurück
        </Button>
        <Card className="overflow-hidden bg-card/70 backdrop-blur shadow-elegant">
          <div className="aspect-[16/10] bg-wine-gradient relative">
            {wine.photo_url ? (
              <img src={wine.photo_url} alt={wine.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <WineIcon className="w-24 h-24 text-primary-foreground/40" />
              </div>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h1 className="serif text-4xl font-semibold">{wine.name}</h1>
                {wine.winery && <p className="text-muted-foreground mt-1">{wine.winery}</p>}
              </div>
              <Button variant="outline" onClick={() => navigate(`/wine/${wine.id}/edit`)}>
                <Edit className="w-4 h-4 mr-2" /> Bearbeiten
              </Button>
            </div>

            {wine.rating > 0 && <div className="my-4"><StarRating value={wine.rating} readonly /></div>}

            <div className="flex flex-wrap gap-2 my-4">
              {wine.vintage && <Badge variant="secondary">{wine.vintage}</Badge>}
              {wine.grape_variety && <Badge variant="secondary">{wine.grape_variety}</Badge>}
              {wine.region && <Badge variant="secondary">{wine.region}</Badge>}
              <Badge className="bg-bordeaux-gradient">{wine.bottle_count} 🍾 im Keller</Badge>
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
    </div>
  );
};

export default WineDetail;
