import { describe, expect, it } from "vitest";
import { parseSheet } from "./parseSheet";
import { mergeParsed } from "./importSheet";
import type { Project } from "./store";

// one attendance block: client "العيد", two workers, six day rows, then the
// sheet's own "days" and "pay" totals (which is where the daily rate comes from)
const attendance = [
  ["العيد", null, null, null],
  [null, "سليم", "القش", null],
  ["السبت", 1, 0.5, "2025-05-31"],
  ["الأحد", 1, 1, null],
  ["الإثنين", 1, 0, null],
  ["الثلاثاء", 1, 1, null],
  ["الأربعاء", 1, 1, null],
  ["الخميس", 1, 0.5, null],
  ["الأيام", 6, 4, null],
  ["الأجرة", 12000, 4000, null],
];

// one material invoice: price / name / qty / total, then المجموع and دافع
const invoice = [
  ["سحة", null, null, null],
  [100, "لصقة", 6, 600],
  [2200, "فينيل", 2, 4400],
  [500, "اندوي", 3, 1500],
  ["المجموع", null, null, 6500],
  ["دافع", null, null, 6500],
];

describe("parseSheet", () => {
  it("reads attendance, the week start and each worker's daily pay", () => {
    const [p] = parseSheet(attendance, "Feuil1");
    expect(p.name).toBe("العيد");
    expect(p.weeks).toHaveLength(1);
    expect(p.weeks[0].start).toBe("2025-05-31");
    expect(p.weeks[0].att["سليم"]).toEqual([1, 1, 1, 1, 1, 1]);
    expect(p.weeks[0].att["القش"]).toEqual([0.5, 1, 0, 1, 1, 0.5]);
    expect(p.workers.find((w) => w.name === "سليم")?.rate).toBe(2000);
    expect(p.workers.find((w) => w.name === "القش")?.rate).toBe(1000);
  });

  it("reads a material invoice with its total and what was paid", () => {
    const [p] = parseSheet(invoice, "سحة");
    expect(p.name).toBe("سحة");
    expect(p.items).toEqual([
      { name: "لصقة", price: 100, qty: 6, total: 600 },
      { name: "فينيل", price: 2200, qty: 2, total: 4400 },
      { name: "اندوي", price: 500, qty: 3, total: 1500 },
    ]);
    expect(p.itemsTotal).toBe(6500);
    expect(p.itemsPaid).toBe(6500);
  });
});

describe("mergeParsed", () => {
  const base: Project[] = [
    {
      id: "p1",
      name: "العيد",
      workers: [{ id: "a", name: "سليم", rate: 2000 }],
      weeks: [],
      items: [],
      itemsPaid: 0,
    },
  ];
  const parsed = [...parseSheet(attendance, "Feuil1"), ...parseSheet(invoice, "سحة")];

  it("adds the missing worker, the week and the new site without duplicating", () => {
    const { data, summary } = mergeParsed(base, parsed);
    expect(summary).toEqual({ projects: 1, workers: 1, weeks: 1, items: 3 });
    constعيد = data.find((p) => p.name === "العيد")!;
    expect(data).toHaveLength(2);
    expect(عيد.workers.map((w) => w.name)).toEqual(["سليم", "القش"]);
    expect(عيد.workers[1].rate).toBe(1000);
    expect(عيد.weeks[0].start).toBe("2025-05-31");
    expect(عيد.weeks[0].att[عيد.workers[0].id]).toEqual([1, 1, 1, 1, 1, 1]);
    const سحة = data.find((p) => p.name === "سحة")!;
    expect(سحة.items).toHaveLength(3);
    expect(سحة.itemsPaid).toBe(6500);
  });

  it("does not add anything twice when the same file is imported again", () => {
    const first = mergeParsed(base, parsed);
    const second = mergeParsed(first.data, parsed);
    expect(second.summary).toEqual({ projects: 0, workers: 0, weeks: 0, items: 0 });
    expect(second.data).toEqual(first.data);
  });
});
