import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WineCard } from "@/components/WineCard";
import { Wine } from "lucide-react";

const PublicCellar = () => {
  const { token } = useParams();
  const [wines, setWines] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const [winesRes, ownerRes] = await Promise.all([
        supabase.rpc("get_shared_wines", { share_token: token }),
        supabase.rpc("get_share_owner_name", { share_token: token }),
      ]);
      if (winesRes.error || ownerRes.error || !ownerRes.data) {
        setValid(false);
      } else {
        setWines(winesRes.data ?? []);
        setOwnerName(ownerRes.data);
      }
      setLoading(false);
    })();
  }, [token]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/50 bg-card/40 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-bordeaux-gradient flex items-center justify-center shadow-glow">
              <Wine className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="serif text-xl font-semibold">Mein Weinkeller</span>
          </div>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition">Anmelden</Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Lädt...</p>
        ) : !valid ? (
          <div className="text-center py-16">
            <h1 className="serif text-3xl font-semibold mb-2">Link ungültig</h1>
            <p className="text-muted-foreground">Dieser Einladungslink existiert nicht oder wurde widerrufen.</p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <p className="text-muted-foreground mb-1">Geteilt von</p>
              <h1 className="serif text-4xl sm:text-5xl font-semibold">{ownerName}</h1>
              <p className="text-muted-foreground mt-2">{wines.length} {wines.length === 1 ? "Wein" : "Weine"} in der Sammlung</p>
            </div>
            {wines.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Noch keine Weine in dieser Sammlung</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {wines.map(w => <WineCard key={w.id} wine={w} basePath={`/keller/${token}/wein`} />)}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default PublicCellar;
