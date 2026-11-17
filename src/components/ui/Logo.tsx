import React from "react";

/** Small grid mark used in the navbar and favicon-like spots. */
export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#4f46e5" />
      <g fill="#fff">
        <rect x="7" y="7" width="5" height="5" rx="1.2" />
        <rect x="13.5" y="7" width="5" height="5" rx="1.2" opacity=".55" />
        <rect x="20" y="7" width="5" height="5" rx="1.2" />
        <rect x="7" y="13.5" width="5" height="5" rx="1.2" opacity=".55" />
        <rect x="13.5" y="13.5" width="5" height="5" rx="1.2" />
        <rect x="20" y="13.5" width="5" height="5" rx="1.2" opacity=".55" />
        <rect x="7" y="20" width="5" height="5" rx="1.2" />
        <rect x="13.5" y="20" width="5" height="5" rx="1.2" opacity=".55" />
        <rect x="20" y="20" width="5" height="5" rx="1.2" />
      </g>
    </svg>
  );
}
