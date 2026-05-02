import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Wine } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase setzt nach Klick auf Reset-Link automatisch eine Recovery-Session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen haben");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passwort aktualisiert! Du bist jetzt eingeloggt.");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bordeaux-gradient shadow-glow mb-4">
            <Wine className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="serif text-4xl font-semibold text-foreground">Neues Passwort</h1>
          <p className="text-muted-foreground mt-2">Lege jetzt dein neues Passwort fest</p>
        </div>

        <Card className="p-6 shadow-elegant border-border/50 bg-card/80 backdrop-blur">
          {!ready ? (
            <p className="text-center text-muted-foreground text-sm">
              Bitte öffne diese Seite über den Link in der E-Mail, die du gerade angefordert hast.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="new-pw">Neues Passwort</Label>
                <Input id="new-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="confirm-pw">Passwort bestätigen</Label>
                <Input id="confirm-pw" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-bordeaux-gradient hover:opacity-90 transition shadow-glow">
                {loading ? "Speichern..." : "Passwort speichern"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
