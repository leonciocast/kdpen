"use client";
import Link from "next/link";
import React, { useEffect, useRef } from "react";
import { BsArrowLeft, BsArrowRight, BsCheckCircleFill, BsInfoCircleFill } from "react-icons/bs";

/** Where a stage is in its question list. Owned by the tool so it survives going back and forth. */
export interface FlowCtl {
  /** Key of the current question; undefined = first, "__last" = last. */
  sub?: string;
  setSub: (key: string) => void;
  /** Leave this stage forwards (next major step). */
  onFinish: () => void;
  /** Leave this stage backwards (previous major step). Undefined on the very first stage. */
  onBackOut?: () => void;
  /** 1-based major step number, shown in the question indicator. */
  stage?: number;
}

export const FINISH = "__finish";
/** Return from onNext / onSkip: a question key to jump to, FINISH to leave the stage, false to stay, or nothing for "the next question". */
export type FlowJump = string | false | void;

export interface Question {
  key: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  optional?: boolean;
  /** Use the full card width (lists, editors, previews). Default is a focused, centered column. */
  wide?: boolean;
  body: React.ReactNode;
  /** Default true. */
  canNext?: boolean;
  /** Shown next to a disabled Next, in plain words. */
  blockedHint?: React.ReactNode;
  /** Shown next to an enabled Next. */
  hint?: React.ReactNode;
  nextLabel?: React.ReactNode;
  nextIcon?: React.ReactNode;
  nextTestId?: string;
  /** Hide the Next button (choice screens advance when a card is picked; the final screen has its own action). */
  hideNext?: boolean;
  onNext?: () => FlowJump;
  skipLabel?: string;
  onSkip?: () => FlowJump;
  /** Pressing Enter presses Next (default true). In a textarea it needs Ctrl/Cmd+Enter. */
  enter?: boolean;
}

export function resolveIndex(questions: Question[], sub?: string) {
  if (sub === "__last") return questions.length - 1;
  const i = questions.findIndex((q) => q.key === sub);
  return i < 0 ? 0 : i;
}

/** One question at a time: indicator, a big title, a single thing to do, and Back / Skip / Next. */
export function QuestionFlow({ questions, flow, stageLabel }: { questions: Question[]; flow: FlowCtl; stageLabel?: string }) {
  const idx = resolveIndex(questions, flow.sub);
  const q = questions[idx];
  const ref = useRef<HTMLDivElement>(null);
  const can = q.canNext !== false;
  const label = stageLabel ?? (flow.stage ? `Step ${flow.stage}` : undefined);

  useEffect(() => {
    const card = ref.current?.closest(".pg-wizard-card") ?? ref.current;
    if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [q.key]);

  const go = (r: FlowJump) => {
    if (r === false) return;
    if (r === FINISH) return flow.onFinish();
    if (typeof r === "string") return flow.setSub(r);
    if (idx < questions.length - 1) flow.setSub(questions[idx + 1].key);
    else flow.onFinish();
  };
  const next = () => go(q.onNext?.());
  const skip = () => go(q.onSkip ? q.onSkip() : undefined);
  const back = () => (idx > 0 ? flow.setSub(questions[idx - 1].key) : flow.onBackOut?.());

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    if (["BUTTON", "A", "SELECT", "SUMMARY"].includes(t.tagName)) return;
    if (t.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
    if (q.enter === false || q.hideNext || !can) return;
    e.preventDefault();
    next();
  };

  return (
    <div ref={ref} onKeyDown={onKeyDown} data-question={q.key}>
      <div className="pg-card-body">
        <div className={`pg-q ${q.wide ? "wide" : ""}`} key={q.key}>
          {questions.length > 1 && (
            <div className="pg-q-meta" data-testid="question-meta">
              <span>
                {label ? `${label} · ` : ""}Question {idx + 1} of {questions.length}
              </span>
              <span className="pg-q-dots" aria-hidden="true">
                {questions.map((x, i) => (
                  <span key={x.key} className={i < idx ? "done" : i === idx ? "current" : ""} />
                ))}
              </span>
            </div>
          )}
          <h2 className="pg-q-title">
            {q.title} {q.optional && <span className="pg-optional">optional</span>}
          </h2>
          {q.lead && <p className="pg-q-lead">{q.lead}</p>}
          <div className="pg-q-body">{q.body}</div>
        </div>
      </div>
      <div className="pg-wizard-footer no-print">
        {idx > 0 || flow.onBackOut ? (
          <button type="button" className="btn btn-light" onClick={back} data-testid="wizard-back">
            <BsArrowLeft /> Back
          </button>
        ) : (
          <Link href="/" className="btn btn-light" data-testid="wizard-back">
            <BsArrowLeft /> Back
          </Link>
        )}
        <div className="pg-footer-right">
          <div aria-live="polite" data-testid="wizard-hint">
            {!q.hideNext && !can && q.blockedHint ? (
              <span className="pg-hint-blocked">
                <BsInfoCircleFill aria-hidden="true" /> {q.blockedHint}
              </span>
            ) : q.hint ? (
              <span className="pg-hint-ok">{q.hint}</span>
            ) : null}
          </div>
          {q.optional && (
            <button type="button" className="btn btn-ghost pg-skip" onClick={skip} data-testid="wizard-skip">
              {q.skipLabel ?? "Skip"}
            </button>
          )}
          {!q.hideNext && (
            <button type="button" className="btn btn-primary" onClick={next} disabled={!can} data-testid={q.nextTestId ?? "wizard-next"}>
              {q.nextLabel ?? "Next"} {q.nextIcon ?? <BsArrowRight />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  title: React.ReactNode;
  text: React.ReactNode;
  icon: React.ReactNode;
  testId?: string;
  badge?: string;
  cta?: string;
  disabled?: boolean;
}

/** Big tappable cards in the style of the home page tool cards. */
export function ChoiceCards<T extends string>({ options, value, onPick, cols = 2, label }: { options: ChoiceOption<T>[]; value?: T | null; onPick: (v: T) => void; cols?: 2 | 3 | 4; label: string }) {
  return (
    <div className={`pg-choice-cards cols-${cols}`} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const sel = value === o.value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={sel} className={`pg-choice-card ${sel ? "selected" : ""} ${o.badge ? "featured" : ""}`} onClick={() => onPick(o.value)} data-testid={o.testId} disabled={o.disabled}>
            <span className="d-flex justify-content-between align-items-start w-100">
              <span className="pg-icon-badge">{o.icon}</span>
              {sel ? (
                <span className="pg-choice-check">
                  <BsCheckCircleFill /> Selected
                </span>
              ) : (
                o.badge && <span className="pg-rec-badge">{o.badge}</span>
              )}
            </span>
            <span className="pg-choice-title">{o.title}</span>
            <span className="pg-choice-text">{o.text}</span>
            <span className="pg-cta">
              {o.cta ?? "Choose"} <BsArrowRight />
            </span>
          </button>
        );
      })}
    </div>
  );
}
