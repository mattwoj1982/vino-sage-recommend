import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: number;
}

export const StarRating = ({ value, onChange, readonly, size = 24 }: StarRatingProps) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <button
        key={i}
        type="button"
        disabled={readonly}
        onClick={() => onChange?.(i === value ? 0 : i)}
        className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
      >
        <Star
          style={{ width: size, height: size }}
          className={i <= value ? "fill-accent text-accent" : "text-muted-foreground/40"}
        />
      </button>
    ))}
  </div>
);
