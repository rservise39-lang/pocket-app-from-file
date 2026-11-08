import { describe, expect, it } from "vitest";
import { applyPayment, makeItem, weekCombinedTotal, type Project } from "./store";

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
    expect(weekCombinedTotal({ ...p, itemsPaid: 1000 }, newWeek)).toBe(6500);
  });
  it("remaining equals grand total minus the payments made", () => {
    const total = 7500;
    let paid = applyPayment(0, 2000);
    expect(total - paid).toBe(5500);
    paid = applyPayment(paid, 5500);
    expect(total - paid).toBe(0);
    expect(applyPayment(paid, 0)).toBe(7500);
  });
});