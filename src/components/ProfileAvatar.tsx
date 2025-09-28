import React, { useEffect, useMemo, useState } from 'react';

interface ProfileAvatarProps {
  photoUrl?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-20 h-20 text-lg'
};

const sizePixels = { sm: 32, md: 48, lg: 64, xl: 80 };

const getInitials = (name?: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || '??';

const isUwaRepo = (u: string) =>
  /^https?:\/\/api\.research-repository\.uwa\.edu\.au\/ws\/files\//i.test(u);

const hasExtension = (u: string) => /\.[a-z]{3,4}(\?|$)/i.test(u);

const optimizeImageUrl = (url: string, size: keyof typeof sizePixels): string => {
  if (!url) return url;
  if (url.includes('unsplash.com')) {
    const s = Math.max(sizePixels[size] * 3, 200);
    return url.replace(/w=\d+&h=\d+/, `w=${s}&h=${s}&q=95&dpr=2`);
  }
  return url;
};

export default function ProfileAvatar({
  photoUrl,
  name,
  size = 'md',
  className = ''
}: ProfileAvatarProps) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Build a small list of candidate URLs to try if the first fails
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (photoUrl) {
      const base = optimizeImageUrl(photoUrl, size);
      list.push(base);
      if (isUwaRepo(base) && !hasExtension(base)) {
        // Try common extensions, then ?download=1 as a last resort
        list.push(`${base}.jpg`);
        list.push(`${base}.png`);
        list.push(`${base}?download=1`);
      }
    }
    return list;
  }, [photoUrl, size]);

  useEffect(() => {
    // Reset on url change
    setSrcIndex(0);
    setImageError(false);
  }, [photoUrl]);

const handleImageError = () => {
  if (srcIndex < candidates.length - 1) {
    setSrcIndex(srcIndex + 1);   // 👈 try the next candidate
  } else {
    setImageError(true);         // give up only at the end
  }
};

const handleImageLoad = () => {
  console.log('[ProfileAvatar] image loaded', { name, srcToUse });
  setHasLoaded(true);
  setImageError(false);
};

  const srcToUse = candidates[srcIndex];
return (
  <div
    className={`${sizeClasses[size]} ${className} relative rounded-full overflow-hidden bg-blue-100 flex items-center justify-center`}
    style={{
    aspectRatio: '1 / 1',   // keep it square → circle stays circle
    
  }}
  >
    {srcToUse && !imageError ? (
      <>
        {console.log('[ProfileAvatar] rendering <img>', { name, srcToUse })}
        <img
          src={srcToUse}
          alt={`${name || 'User'} profile picture`}
          onError={(e) => {
            console.warn('[ProfileAvatar] image error', { name, srcToUse });
            handleImageError();
          }}
          onLoad={(e) => {
            console.log('[ProfileAvatar] image loaded', { name, srcToUse });
            handleImageLoad();
          }}
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
          style={{
            objectFit: 'cover',
            objectPosition: 'center',
            imageRendering: '-webkit-optimize-contrast',
            filter: 'contrast(1.1) saturate(1.1)',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
          }}
          loading="eager"       // 👈 force load
          draggable={false}
          referrerPolicy="no-referrer"
        />
      </>
    ) : (
      <>
        {console.log('[ProfileAvatar] rendering initials', { name })}
        <span className="text-blue-600 font-semibold">
          {getInitials(name)}
        </span>
      </>
    )}
  </div>
);

}
