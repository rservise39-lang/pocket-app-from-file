import { describe, expect, it } from "vitest";
import { makeItem, weekCombinedTotal, type Project } from "./store";

describe("material accounting", () => {
  it("calculates material total as quantity multiplied by unit price", () => {
    expect(makeItem("اسمنت", 3, 500).total).toBe(1500);
  });
  it("adds project materials to the selected week's worker wages", () => {
    const p: Project = {
      id: "p", name: "ورشة", workers: [{ id: "a", name: "سليم", rate: 2000 }],
      weeks: [
        { id: "old", start: "2026-10-24", paid: 0, att: { a: [1, 0.5, 0, 0, 0, 0] } },
        { id: "new", start: "2026-10-31", paid: 0, att: { a: [1, 1, 1, 0, 0, 0] } },
      ],
      items: [makeItem("اسمنت", 3, 500)],
    };
    const [oldWeek, newWeek] = p.weeks;
    if (!oldWeek || !newWeek) throw new Error("Missing test weeks");
    expect(weekCombinedTotal(p, oldWeek)).toBe(4500);
    expect(weekCombinedTotal(p, newWeek)).toBe(7500);
  });
});