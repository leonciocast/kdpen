import React from "react";
import { BsInfoCircle } from "react-icons/bs";

/** Small (i) icon with a hover/focus tooltip. */
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="pg-tip ms-1" tabIndex={0} role="img" aria-label={text} data-tip={text}>
      <BsInfoCircle size={14} />
    </span>
  );
}
