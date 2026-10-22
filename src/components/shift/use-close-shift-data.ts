"use client";

import { useState, useCallback, useEffect } from "react";

export function useCloseShiftData() {
  const [loading, setLoading] = useState(true);
  const [shiftData, setShiftData] = useState<any | null>(null);
  const [actualCash, setActualCash] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");

  const fetchShift = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/shifts/current");
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json?.data) {
          const s = json.data;
          setShiftData(s);
          if (s.actualCash !== null && s.actualCash !== undefined) {
            setActualCash(s.actualCash);
          } else {
            setActualCash(null);
          }
          if (s.explanation) {
            setExplanation(s.explanation);
          }
        } else {
          setShiftData(null);
        }
      }
    } catch (err) {
      console.error("Failed to load shift:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShift();
  }, [fetchShift]);

  return {
    loading,
    shiftData,
    setShiftData,
    actualCash,
    setActualCash,
    explanation,
    setExplanation,
    fetchShift,
  };
}
