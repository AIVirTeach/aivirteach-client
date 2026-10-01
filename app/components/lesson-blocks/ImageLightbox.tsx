"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

type ImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div className="lb-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <button ref={closeButton} type="button" className="lb-lightbox-close" aria-label="关闭图片预览" onClick={onClose}>×</button>
    <Image src={src} alt={alt} width={1600} height={1200} unoptimized />
  </div>;
}
