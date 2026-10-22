"use client";

import { createContext, useContext } from "react";

export type CopyToVm = (text: string) => boolean;
export const CopyToVmContext = createContext<CopyToVm | undefined>(undefined);
export const useCopyToVm = () => useContext(CopyToVmContext);

export async function copyLessonCode(text: string, writeClipboard: ((text: string) => Promise<void>) | undefined, copyToVm?: CopyToVm) {
  // VM clipboard works independently of browser clipboard permissions.
  let vmCopied = false;
  try { vmCopied = copyToVm?.(text) ?? false; } catch { /* A VM failure must not prevent local copying. */ }
  let clipboardCopied = false;
  try {
    if (writeClipboard) {
      await writeClipboard(text);
      clipboardCopied = true;
    }
  } catch {
    // Return both outcomes so the learner does not see a false success message.
  }
  return { clipboardCopied, vmCopied };
}

export async function writeBrowserClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
  } finally {
    input.remove();
  }
}
