import React from "react";

const RETRY_KEY = "lazy-retry";

export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retryKey: string,
) {
  return React.lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const hasRetried = sessionStorage.getItem(`${RETRY_KEY}:${retryKey}`) === "1";

      if (!hasRetried) {
        sessionStorage.setItem(`${RETRY_KEY}:${retryKey}`, "1");
        window.location.reload();
      }

      throw error;
    }
  });
}
