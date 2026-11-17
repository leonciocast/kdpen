import { Placement, placementEnd } from "./engine";

/** Center of a cell in a grid drawn at (x, y) with square cells of `cell` size. */
export function cellCenter(x: number, y: number, cell: number, row: number, col: number): [number, number] {
  return [x + (col + 0.5) * cell, y + (row + 0.5) * cell];
}

/**
 * Outline of a "circled word" capsule from the start cell center to the end
 * cell center, as a closed polygon (y grows downward, like SVG and jsPDF).
 */
export function capsulePoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radius: number,
  segments = 14
): [number, number][] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = angle - Math.PI / 2 + (Math.PI * i) / segments;
    pts.push([x2 + radius * Math.cos(a), y2 + radius * Math.sin(a)]);
  }
  for (let i = 0; i <= segments; i++) {
    const a = angle + Math.PI / 2 + (Math.PI * i) / segments;
    pts.push([x1 + radius * Math.cos(a), y1 + radius * Math.sin(a)]);
  }
  return pts;
}

export function placementCapsule(p: Placement, x: number, y: number, cell: number, radiusRatio = 0.4): [number, number][] {
  const [sx, sy] = cellCenter(x, y, cell, p.row, p.col);
  const [er, ec] = placementEnd(p);
  const [ex, ey] = cellCenter(x, y, cell, er, ec);
  return capsulePoints(sx, sy, ex, ey, cell * radiusRatio);
}

export function pointsToSvgPath(pts: [number, number][]): string {
  return pts.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)},${py.toFixed(2)}`).join(" ") + " Z";
}
