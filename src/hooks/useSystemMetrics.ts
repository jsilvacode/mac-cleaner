import { useEffect, useState } from "react";
import { getSystemMetrics } from "../services/cleanerApi";
import type { SystemMetrics } from "../types/cleaner";

export function useSystemMetrics(pollingMs = 3000, enabled = true): SystemMetrics | null {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    const fetchMetrics = async () => {
      try {
        const data = await getSystemMetrics();
        if (active) {
          setMetrics(data);
        }
      } catch {
        if (active) {
          setMetrics(null);
        }
      }
    };

    void fetchMetrics();
    const interval = window.setInterval(() => {
      void fetchMetrics();
    }, pollingMs);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pollingMs, enabled]);

  return metrics;
}
