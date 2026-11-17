"use client";
import { useState } from "react";
import type { FlowCtl } from "./Flow";

/** Major steps plus the current question inside each one, kept while moving back and forth. */
export function useStages(count: number) {
  const [step, setStep] = useState(0);
  const [subs, setSubs] = useState<Record<number, string | undefined>>({});
  const goTo = (i: number, sub?: string) => {
    if (sub !== undefined) setSubs((s) => ({ ...s, [i]: sub }));
    setStep(i);
  };
  const flow = (i: number): FlowCtl => ({
    stage: i + 1,
    sub: subs[i],
    setSub: (k) => setSubs((s) => ({ ...s, [i]: k })),
    onFinish: () => {
      if (i >= count - 1) return;
      setSubs((s) => ({ ...s, [i + 1]: undefined }));
      setStep(i + 1);
    },
    onBackOut: i > 0 ? () => goTo(i - 1, "__last") : undefined,
  });
  return { step, goTo, flow };
}
