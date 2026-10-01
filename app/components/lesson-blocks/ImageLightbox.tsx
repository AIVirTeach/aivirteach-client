"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

type ImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

type FocusTarget = { focus: () => void };
type LightboxDialog = { querySelectorAll: (selector: string) => ArrayLike<FocusTarget>; focus: () => void };
type LightboxKeyEvent = { key: string; shiftKey: boolean; preventDefault: () => void };

export function handleImageLightboxKeyDown(
  event: LightboxKeyEvent,
  dialog: LightboxDialog,
  activeElement: FocusTarget | null,
  onClose: () => void,
) {
  if (event.key === "Escape") {
    onClose();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = Array.from(dialog.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ));
  if (focusable.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && (activeElement === first || !focusable.includes(activeElement!))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (activeElement === last || !focusable.includes(activeElement!))) {
    event.preventDefault();
    first.focus();
  }
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialog.current) handleImageLightboxKeyDown(event, dialog.current, document.activeElement as HTMLElement | null, onClose);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return <div ref={dialog} className="lb-lightbox" role="dialog" tabIndex={-1} aria-modal="true" aria-label="图片预览" onMouseDown={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <button ref={closeButton} type="button" className="lb-lightbox-close" aria-label="关闭图片预览" onClick={onClose}>×</button>
    <Image src={src} alt={alt} width={1600} height={1200} unoptimized />
  </div>;
}
