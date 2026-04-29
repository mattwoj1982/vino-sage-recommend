import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const Recommend = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState("");

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setRecommendation("");
    const { data, error } = await supabase.functions.invoke("recommend-wine", { body: { prompt } });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data?.error) { toast.error(data.error); return; }
    setRecommendation(data?.recommendation ?? "");
  };

  const examples = [
    "Heute Abend gibt es geschmortes Rindfleisch mit Pilzen",
    "Romantisches Dinner zu zweit mit Lachs",
    "Sommerlicher Apéro auf der Terrasse",
  ];

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bordeaux-gradient shadow-glow mb-3">
            <Sparkles className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="serif text-4xl font-semibold">KI-Sommelier</h1>
          <p className="text-muted-foreground mt-2">Beschreibe Anlass oder Essen – Claude empfiehlt den passenden Wein aus deinem Keller</p>
        </div>

        <Card className="p-6 bg-card/70 backdrop-blur shadow-elegant">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="z.B. Was passt zu einem Pasta-Abend mit Freunden?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              maxLength={1000}
              required
            />
            <div className="flex flex-wrap gap-2">
              {examples.map((ex) => (
                <button
                  type="button"
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent/20 transition text-muted-foreground hover:text-foreground"
                >
                  {ex}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-bordeaux-gradient shadow-glow">
              {loading ? "Claude überlegt..." : "Empfehlung erhalten"}
            </Button>
          </form>

          {recommendation && (
            <div className="mt-6 pt-6 border-t border-border">
              <h2 className="serif text-2xl font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-accent" /> Empfehlung
              </h2>
              <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{recommendation}</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
};

export default Recommend;
