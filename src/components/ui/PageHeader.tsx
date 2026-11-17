import React from "react";

export default function PageHeader({ icon, title, lead, actions }: { icon: React.ReactNode; title: string; lead: string; actions?: React.ReactNode }) {
  return (
    <div className="pg-page-header no-print">
      <div className="d-flex align-items-center gap-3 flex-wrap">
        <span className="pg-icon-badge">{icon}</span>
        <div className="flex-grow-1">
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
        {actions}
      </div>
    </div>
  );
}
