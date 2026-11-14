"use client";
import React from "react";
import { BsArrowLeft, BsArrowRight, BsCheck2, BsInfoCircleFill } from "react-icons/bs";

export interface WizardStep {
  label: string;
}

/** Numbered stepper with progress bar. Steps beyond `maxReachable` are disabled. */
export function Stepper({ steps, current, maxReachable, onSelect }: { steps: WizardStep[]; current: number; maxReachable: number; onSelect: (i: number) => void }) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="Progress" className="no-print">
      <div className="pg-step-meta">
        <span>
          Step {current + 1} of {steps.length}: <strong className="text-body">{steps[current].label}</strong>
        </span>
        <span>{Math.round(pct)}% complete</span>
      </div>
      <div className="pg-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <ol className="pg-stepper">
        {steps.map((s, i) => {
          const state = i === current ? "current" : i < current ? "done" : "";
          return (
            <li key={s.label} className={`pg-step ${state}`}>
              <button type="button" disabled={i > maxReachable} onClick={() => onSelect(i)} aria-current={i === current ? "step" : undefined} title={s.label}>
                <span className="pg-step-num">{i < current ? <BsCheck2 /> : i + 1}</span>
                <span className="pg-step-label">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepIntro({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="pg-step-intro">
      <span className="pg-icon-badge">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function WizardFooter({
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled,
  hint,
  backLabel = "Back",
  nextIcon,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hint?: React.ReactNode;
  backLabel?: string;
  nextIcon?: React.ReactNode;
}) {
  return (
    <div className="pg-wizard-footer no-print">
      {onBack ? (
        <button type="button" className="btn btn-light" onClick={onBack}>
          <BsArrowLeft /> {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="pg-footer-right">
        <div aria-live="polite" data-testid="wizard-hint">
          {hint ? nextDisabled && onNext ? (
            <span className="pg-hint-blocked">
              <BsInfoCircleFill aria-hidden="true" /> {hint}
            </span>
          ) : (
            <span className="pg-hint-ok">{hint}</span>
          ) : null}
        </div>
        {onNext && (
          <button type="button" className="btn btn-primary" onClick={onNext} disabled={nextDisabled} data-testid="wizard-next">
            {nextLabel} {nextIcon ?? <BsArrowRight />}
          </button>
        )}
      </div>
    </div>
  );
}
