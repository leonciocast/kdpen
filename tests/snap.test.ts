import { describe, expect, it } from "vitest";
import { ALL_DIRECTIONS, inBounds, makePlacement, placementCells } from "../src/lib/wordsearch/engine";
import { fitsInGrid, nearestDirection, resolveFixed, resolveFreeEnd, snapStart, startRange, validDirectionsFrom, validStartCells } from "../src/lib/wordsearch/snap";

describe("startRange / snapStart", () => {
  it("computes the start window for each direction", () => {
    expect(startRange(10, 8, "E")).toEqual({ rowMin: 0, rowMax: 9, colMin: 0, colMax: 2 });
    expect(startRange(10, 8, "W")).toEqual({ rowMin: 0, rowMax: 9, colMin: 7, colMax: 9 });
    expect(startRange(10, 8, "NE")).toEqual({ rowMin: 7, rowMax: 9, colMin: 0, colMax: 2 });
    expect(startRange(10, 11, "E")).toBeNull();
  });

  it("pulls an Across word back from the right edge (ICECREAM in 15x15)", () => {
    // Hovering column 13: ICECREAM (8 letters) must start at column 7 at the latest.
    expect(snapStart(15, 8, "E", [4, 13])).toEqual([4, 7]);
    expect(snapStart(15, 8, "E", [4, 3])).toEqual([4, 3]); // already valid: unchanged
    expect(snapStart(15, 8, "S", [14, 2])).toEqual([7, 2]);
    expect(snapStart(15, 8, "NW", [1, 1])).toEqual([7, 7]);
    expect(snapStart(15, 8, "E", [-2, 20])).toEqual([0, 7]); // even far off-grid
  });

  it("never produces a placement that leaves the grid, from any cell and direction", () => {
    const size = 12;
    for (const word of ["ICE CREAM", "AB", "SANDCASTLE", "TWELVELETTER"]) {
      for (const dir of ALL_DIRECTIONS) {
        for (let r = -3; r < size + 3; r++) {
          for (let c = -3; c < size + 3; c++) {
            const res = resolveFixed(size, [], word, dir, [r, c]);
            expect(res.kind).toBe("place");
            if (res.kind === "place") {
              expect(placementCells(res.placement).every((cell) => inBounds(size, cell))).toBe(true);
              expect(fitsInGrid(size, res.placement.letters.length, dir, [res.placement.row, res.placement.col])).toBe(true);
            }
          }
        }
      }
    }
  });
});

describe("resolveFixed", () => {
  it("marks a snapped placement and keeps letter clashes blocked with a friendly message", () => {
    const res = resolveFixed(15, [], "ICE CREAM", "E", [0, 12]);
    expect(res).toMatchObject({ kind: "place", snapped: true, placement: { row: 0, col: 7, letters: "ICECREAM" } });
    const existing = [makePlacement("SUNSHINE", 0, 9, "S")];
    const clash = resolveFixed(15, existing, "ICE CREAM", "E", [0, 12]);
    expect(clash.kind).toBe("conflict");
    if (clash.kind === "conflict") expect(clash.message).toMatch(/Try another square/);
  });

  it("lists exactly the valid start cells", () => {
    const starts = validStartCells(10, [], "ICECREAM", "E");
    expect(starts.size).toBe(10 * 3);
    expect(starts.has("0,2")).toBe(true);
    expect(starts.has("0,3")).toBe(false);
  });
});

describe("start → end mode", () => {
  it("snaps any end click to the nearest of the 8 directions", () => {
    expect(nearestDirection([5, 5], [5, 9])).toBe("E");
    expect(nearestDirection([5, 5], [6, 9])).toBe("E"); // not a straight line: nearest is across
    expect(nearestDirection([5, 5], [8, 7])).toBe("SE");
    expect(nearestDirection([5, 5], [1, 5])).toBe("N");
    expect(nearestDirection([5, 5], [2, 1])).toBe("NW");
    expect(nearestDirection([5, 5], [5, 5])).toBeNull();
  });

  it("only allows directions that stay inside the grid", () => {
    // From the top-right corner, an 8-letter word can only go W, S or SW.
    expect(validDirectionsFrom(10, [], "ICECREAM", [0, 9]).sort()).toEqual(["S", "SW", "W"]);
    expect(resolveFreeEnd(10, [], "ICECREAM", [0, 9], [0, 12]).kind).toBe("none");
    const ok = resolveFreeEnd(10, [], "ICECREAM", [0, 9], [3, 9]);
    expect(ok).toMatchObject({ kind: "place", placement: { dir: "S" } });
    if (ok.kind === "place") expect(placementCells(ok.placement).every((c) => inBounds(10, c))).toBe(true);
  });
});
