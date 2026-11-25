import { useState } from 'react';
import { Utensils } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function SafeImage({ src, alt, className = '' }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-stone-200 to-stone-100 text-stone-600 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Utensils className="w-7 h-7 mb-2 text-stone-400" />
        <span className="text-xs font-medium text-stone-500 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
