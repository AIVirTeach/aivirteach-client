"use client";

import { useLayoutEffect, useState } from "react";
import { createTutorRequestOwner } from "./tutor-context";

export function useTutorRequest(contextKey: string) {
  const [owner] = useState(createTutorRequestOwner);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  useLayoutEffect(() => {
    owner.setContext(contextKey);
    return () => owner.cancel();
  }, [owner, contextKey]);
  return {
    busy: !!contextKey && busyKey === contextKey && owner.isBusy(),
    cancel() { owner.cancel(); setBusyKey(null); },
    begin() {
      const request = owner.begin();
      if (!request) return null;
      setBusyKey(contextKey);
      return {
        ...request,
        finish() {
          if (request.isCurrent()) setBusyKey(null);
          request.finish();
        },
      };
    },
  };
}
