import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Share2, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Link {
  id: string; token: string; name: string | null; is_active: boolean; created_at: string;
}

const Share = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState<Link[]>([]);
  const [name, setName] = useState("");

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);

  const load = async () => {
    const { data } = await supabase.from("share_links").select("*").order("created_at", { ascending: false });
    setLinks(data ?? []);
  };

  useEffect(() => { if (user) load(); }, [user]);

  const create = async () => {
    if (!user) return;
    const { error } = await supabase.from("share_links").insert({ user_id: user.id, name: name || "Mein Link" });
    if (error) toast.error(error.message);
    else { toast.success("Link erstellt"); setName(""); load(); }
  };

  const toggle = async (link: Link) => {
    const { error } = await supabase.from("share_links").update({ is_active: !link.is_active }).eq("id", link.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Link wirklich löschen?")) return;
    const { error } = await supabase.from("share_links").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/keller/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert");
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-bordeaux-gradient shadow-glow mb-3">
            <Share2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="serif text-4xl font-semibold">Keller teilen</h1>
          <p className="text-muted-foreground mt-2">Erstelle Links, mit denen andere deine Sammlung lesen können – ohne Login</p>
        </div>

        <Card className="p-6 bg-card/70 backdrop-blur shadow-elegant mb-4">
          <div className="flex gap-2">
            <Input placeholder="Name (z.B. Familie)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={create} className="bg-bordeaux-gradient">
              <Plus className="w-4 h-4 mr-2" /> Erstellen
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {links.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Noch keine Links erstellt</p>
          ) : links.map(link => (
            <Card key={link.id} className="p-4 bg-card/70 backdrop-blur">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{link.name || "Unbenannt"}</p>
                  <p className="text-xs text-muted-foreground truncate">{`${window.location.origin}/keller/${link.token}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={link.is_active} onCheckedChange={() => toggle(link)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => copy(link.token)} className="flex-1">
                  <Copy className="w-3 h-3 mr-2" /> Kopieren
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(link.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Share;
