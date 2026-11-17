import Image from "next/image";

/* PLACEHOLDER ART — /public/landing/placeholder-N.svg are sample images,
   not real product photos. Replace `src` with CDN URLs when real images
   are available (see components/landing/data.js). */
export default function ProductImage({ src, alt, className = "", sizes = "(max-width: 640px) 60vw, 280px" }) {
  return (
    <div className={`relative overflow-hidden bg-[var(--user-bg-hover)] ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover transition-transform duration-500 ease-out group-hover/card:scale-105"
      />
    </div>
  );
}
