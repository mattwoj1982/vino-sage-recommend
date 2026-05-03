import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

import { toast } from "sonner";
import { Wine } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Bitte gib zuerst deine E-Mail-Adresse ein");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Reset-Link versendet! Schau in dein E-Mail-Postfach.");
  };

  useEffect(() => {
    if (user) navigate("/");
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Willkommen zurück!");
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
          <h1 className="serif text-4xl font-semibold text-foreground">Mein Weinkeller</h1>
          <p className="text-muted-foreground mt-2">Verwalte deine Sammlung mit Stil</p>
        </div>

        <Card className="p-6 shadow-elegant border-border/50 bg-card/80 backdrop-blur">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email">E-Mail</Label>
              <Input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="login-pw">Passwort</Label>
              <Input id="login-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-bordeaux-gradient hover:opacity-90 transition shadow-glow">
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
            >
              Passwort vergessen?
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Registrierung ist nur per Einladung möglich. Wenn du einen Share-Link
            erhalten hast, kannst du den Keller direkt ohne Konto ansehen.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
