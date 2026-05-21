import { Link, useNavigate } from "react-router-dom";
import { Wine, LogOut, Sparkles, Share2, Plus, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const AppHeader = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/50 bg-card/40 backdrop-blur-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-full bg-bordeaux-gradient flex items-center justify-center shadow-glow group-hover:shadow-elegant transition">
            <Wine className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="serif text-xl font-semibold hidden sm:inline">Mein Weinkeller</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/menus")}>
            <BookOpen className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Menüs</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/recommend")}>
            <Sparkles className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">KI-Empfehlung</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/share")}>
            <Share2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Teilen</span>
          </Button>
          <Button size="sm" onClick={() => navigate("/wine/new")} className="bg-bordeaux-gradient">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Neu</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </nav>
      </div>
    </header>
  );
};
