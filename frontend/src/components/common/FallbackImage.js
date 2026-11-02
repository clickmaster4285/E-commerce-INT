"use client";

import { useState } from "react";
import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";

const fallbackStyle = {
  backgroundColor: "var(--user-bg-hover, var(--bg-tertiary, #f1f5f9))",
  color: "var(--user-text-subtle, var(--text-muted, #94a3b8))",
};

function ImagePlaceholder({ alt, className = "", style, fill = false, width, height }) {
  const dimensions = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%" }
    : { width: width || undefined, height: height || undefined };

  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={`inline-flex items-center justify-center overflow-hidden ${className}`}
      style={{ ...fallbackStyle, ...dimensions, ...style }}
    >
      <ImageIcon aria-hidden="true" className="h-[38%] w-[38%] min-h-3 min-w-3 max-h-8 max-w-8" strokeWidth={1.7} />
    </span>
  );
}

export default function FallbackImage({
  src,
  alt = "",
  className = "",
  style,
  onError,
  nextImage = false,
  fill = false,
  priority = false,
  unoptimized = false,
  loader,
  ...props
}) {
  const [failedSrc, setFailedSrc] = useState(null);
  const normalizedSrc = typeof src === "object" && src !== null ? src : String(src || "").trim();
  const sourceKey = typeof normalizedSrc === "string" ? normalizedSrc : normalizedSrc?.src;

  if (!sourceKey || failedSrc === sourceKey) {
    return <ImagePlaceholder alt={alt} className={className} style={style} fill={fill} width={props.width} height={props.height} />;
  }

  const handleError = (event) => {
    setFailedSrc(sourceKey);
    onError?.(event);
  };

  if (nextImage) {
    return (
      <Image
        {...props}
        src={normalizedSrc}
        alt={alt}
        className={className}
        style={style}
        fill={fill}
        priority={priority}
        loading={priority ? "eager" : props.loading}
        unoptimized={unoptimized}
        loader={loader}
        onError={handleError}
      />
    );
  }

  return (
    <img
      {...props}
      src={sourceKey}
      alt={alt}
      className={className}
      style={fill ? { ...style, position: "absolute", inset: 0, width: "100%", height: "100%" } : style}
      loading={priority ? "eager" : props.loading}
      fetchPriority={priority ? "high" : props.fetchPriority}
      onError={handleError}
    />
  );
}
