import { describe, expect, it } from "vitest";
import { addDays, currentWeekStart, weekStart } from "./weeks";

describe("calendar weeks", () => {
  it("defaults to the current Saturday rather than the last recorded week", () => {
    expect(currentWeekStart(new Date(2026, 10, 8, 10))).toBe("2026-11-07");
  });
  it("aligns a historical date with its Saturday to Thursday attendance week", () => {
    expect(weekStart("2025-01-05")).toBe("2025-01-04");
    expect(addDays(weekStart("2025-01-05"), 5)).toBe("2025-01-09");
  });
  it("can move backwards into the previous year", () => {
    expect(addDays("2025-01-04", -7)).toBe("2024-12-28");
  });
});