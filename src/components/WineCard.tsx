import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Wine as WineIcon, Star } from "lucide-react";
import { getDrinkStatus, drinkStatusEmoji, drinkStatusLabel } from "@/lib/drinkWindow";
import { WinePhoto } from "@/components/WinePhoto";

interface WineCardProps {
  wine: {
    id: string;
    name: string;
    winery: string | null;
    vintage: number | null;
    grape_variety: string | null;
    region: string | null;
    rating: number | null;
    photo_url: string | null;
    bottle_count: number;
    drink_from?: number | null;
    drink_to?: number | null;
  };
  basePath?: string;
}

export const WineCard = ({ wine, basePath = "/wine" }: WineCardProps) => {
  const status = getDrinkStatus(wine.drink_from, wine.drink_to);
  return (
    <Link to={`${basePath}/${wine.id}`}>
      <Card className="overflow-hidden border-border/50 bg-card/70 backdrop-blur hover:border-primary/50 hover:shadow-glow transition-all duration-300 group h-full">
        <div className="aspect-[4/3] bg-wine-gradient relative overflow-hidden">
          <WinePhoto
            photoUrl={wine.photo_url}
            alt={wine.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <WineIcon className="w-16 h-16 text-primary-foreground/40" />
              </div>
            }
          />
          <div className="absolute top-2 right-2 bg-background/80 backdrop-blur px-2 py-1 rounded-md text-xs font-medium">
            {wine.bottle_count} 🍾
          </div>
          {status !== "unknown" && (
            <div
              className="absolute top-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded-md text-xs font-medium"
              title={drinkStatusLabel[status]}
            >
              {drinkStatusEmoji[status]}
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="serif text-xl font-semibold text-foreground line-clamp-1">{wine.name}</h3>
          {wine.winery && <p className="text-sm text-muted-foreground line-clamp-1">{wine.winery}</p>}
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
            <span>{[wine.vintage, wine.region].filter(Boolean).join(" · ")}</span>
            {wine.rating ? (
              <span className="flex items-center gap-0.5 text-accent">
                {Array.from({ length: wine.rating }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 fill-current" />
                ))}
              </span>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
};
