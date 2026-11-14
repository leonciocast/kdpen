import React from "react";

export type PanelTone = "action" | "result" | "options" | "summary";

/**
 * A colored section. Tones make section types recognisable at a glance:
 * action (indigo: what to do), result (teal: your list / preview),
 * options (slate: optional settings), summary (amber: totals and the final button).
 */
export function Panel({
  tone,
  title,
  n,
  optional,
  icon,
  aside,
  children,
  className = "",
  bodyClassName = "",
  testId,
}: {
  tone: PanelTone;
  title: React.ReactNode;
  n?: number;
  optional?: boolean;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
}) {
  return (
    <section className={`pg-panel pg-panel-${tone} ${className}`} data-testid={testId}>
      <header className="pg-panel-head">
        {n !== undefined ? <span className={`pg-num-badge ${optional ? "quiet" : ""}`}>{n}</span> : icon ? <span className="pg-panel-icon">{icon}</span> : null}
        <h3 className="pg-panel-title">
          {title}
          {optional && <span className="pg-optional">optional</span>}
        </h3>
        {aside && <div className="pg-panel-aside">{aside}</div>}
      </header>
      <div className={`pg-panel-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A numbered sub-step inside a screen: "1. Type your words". */
export function SubStep({ n, title, optional, hint, children, className = "" }: { n: number; title: React.ReactNode; optional?: boolean; hint?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`pg-substep ${optional ? "is-optional" : ""} ${className}`}>
      <div className="pg-substep-head">
        <span className={`pg-num-badge ${optional ? "quiet" : ""}`} aria-hidden="true">
          {n}
        </span>
        <div>
          <div className="pg-substep-title">
            <span className="visually-hidden">Step {n}: </span>
            {title}
            {optional && <span className="pg-optional">optional</span>}
          </div>
          {hint && <div className="pg-substep-hint">{hint}</div>}
        </div>
      </div>
      {children && <div className="pg-substep-body">{children}</div>}
    </div>
  );
}

/** Big two-way choice (e.g. "Type my words" / "Upload a file"). */
export function ChoiceSwitch<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; label: string; options: { value: T; title: string; text: string; icon: React.ReactNode; testId?: string }[] }) {
  return (
    <div className="pg-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)} data-testid={o.testId}>
          <span className="pg-choice-icon">{o.icon}</span>
          <span>
            <strong>{o.title}</strong>
            <small>{o.text}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
