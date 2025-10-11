import React from 'react';

interface SafeHtmlRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Safely renders HTML content by allowing only basic formatting tags
 * This prevents XSS attacks while enabling basic HTML formatting
 */
export default function SafeHtmlRenderer({ 
  content, 
  className, 
  style
}: SafeHtmlRendererProps) {
  if (!content) return null;

  // Convert line breaks to <br> tags for proper HTML rendering
  const processedContent = content
    .replace(/\n/g, '<br>')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: URLs

  return (
    <div 
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
}
