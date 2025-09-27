import React, { useState } from 'react';

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

// Map sizes to pixel dimensions for optimal image resolution
const sizePixels = {
  sm: 32,   // 8 * 4 (tailwind w-8 = 32px)
  md: 48,   // 12 * 4 (tailwind w-12 = 48px)
  lg: 64,   // 16 * 4 (tailwind w-16 = 64px)
  xl: 80    // 20 * 4 (tailwind w-20 = 80px)
};

const getInitials = (name?: string) => {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(s => s[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || '??';
};

// Optimize image URL for the required size to prevent pixelation
const optimizeImageUrl = (url: string, size: keyof typeof sizePixels): string => {
  if (!url) return url;
  
  // For Unsplash images, use much higher resolution to ensure quality
  if (url.includes('unsplash.com')) {
    const targetSize = Math.max(sizePixels[size] * 3, 200); // At least 3x or 200px minimum
    const optimizedUrl = url.replace(/w=\d+&h=\d+/, `w=${targetSize}&h=${targetSize}&q=95&dpr=2`);
    console.log(`Optimizing image for size ${size}: ${targetSize}px`, { original: url, optimized: optimizedUrl });
    return optimizedUrl;
  }
  
  // For other image services, return as-is (could add more optimizations here)
  return url;
};

export default function ProfileAvatar({ 
  photoUrl, 
  name, 
  size = 'md', 
  className = '' 
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const shouldShowImage = photoUrl && !imageError;
  const optimizedImageUrl = photoUrl ? optimizeImageUrl(photoUrl, size) : '';

  return (
    <div className={`${sizeClasses[size]} ${className} relative rounded-full overflow-hidden bg-blue-100 flex items-center justify-center`}>
      {shouldShowImage ? (
        <img
          src={optimizedImageUrl}
          alt={`${name || 'User'} profile picture`}
          onError={handleImageError}
          onLoad={handleImageLoad}
          className="absolute inset-0 w-full h-full object-cover object-center select-none"
          style={{ 
            objectFit: 'cover', 
            objectPosition: 'center',
            imageRendering: '-webkit-optimize-contrast',
            WebkitImageRendering: '-webkit-optimize-contrast',
            msInterpolationMode: 'bicubic',
            filter: 'contrast(1.1) saturate(1.1)',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)'
          }}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span className="text-blue-600 font-semibold">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
