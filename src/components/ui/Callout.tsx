import React from "react";
import { BsCheckCircleFill, BsExclamationTriangleFill, BsInfoCircleFill } from "react-icons/bs";

export default function Callout({ tone = "info", children, className = "" }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode; className?: string }) {
  const icon = tone === "warn" ? <BsExclamationTriangleFill /> : tone === "ok" ? <BsCheckCircleFill /> : <BsInfoCircleFill />;
  return (
    <div className={`pg-callout ${tone} ${className}`} role={tone === "warn" ? "alert" : "status"}>
      {icon}
      <div>{children}</div>
    </div>
  );
}
