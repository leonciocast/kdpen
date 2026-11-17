"use client";
import React from "react";
import { BsChevronLeft, BsChevronRight } from "react-icons/bs";

/** Tabs for a few items, a compact previous / list / next pager for many. */
export default function ItemPager({ titles, active, onSelect, label }: { titles: string[]; active: number; onSelect: (i: number) => void; label: string }) {
  if (titles.length <= 10) {
    return (
      <div className="pg-tabs" role="tablist" aria-label={label}>
        {titles.map((t, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === active} className={`pg-tab ${i === active ? "active" : ""}`} onClick={() => onSelect(i)}>
            {t}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="pg-pager">
      <button type="button" className="btn btn-light btn-sm" onClick={() => onSelect(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous">
        <BsChevronLeft />
      </button>
      <select className="form-select form-select-sm" value={active} onChange={(e) => onSelect(Number(e.target.value))} aria-label={label}>
        {titles.map((t, i) => (
          <option key={i} value={i}>
            {i + 1}. {t}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-light btn-sm" onClick={() => onSelect(Math.min(titles.length - 1, active + 1))} disabled={active === titles.length - 1} aria-label="Next">
        <BsChevronRight />
      </button>
      <span className="small text-muted">
        {active + 1} of {titles.length.toLocaleString()}
      </span>
    </div>
  );
}
