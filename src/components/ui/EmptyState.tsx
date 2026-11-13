import React from "react";

export default function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="pg-empty">
      <span className="pg-icon-badge">{icon}</span>
      <h3>{title}</h3>
      {children && <p className="mb-3">{children}</p>}
      {action}
    </div>
  );
}
