import { useEffect, useState } from "react";
import { getSignedPhotoUrl } from "@/lib/winePhoto";

interface WinePhotoProps {
  photoUrl: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

export const WinePhoto = ({ photoUrl, alt, className, fallback }: WinePhotoProps) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!photoUrl) { setSrc(null); return; }
    getSignedPhotoUrl(photoUrl).then(url => {
      if (active) setSrc(url);
    });
    return () => { active = false; };
  }, [photoUrl]);

  if (!photoUrl || !src) return <>{fallback ?? null}</>;
  return <img src={src} alt={alt} className={className} />;
};
