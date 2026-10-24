// Reads the user's Excel workbook in the browser and merges what it finds
// (work sites, workers, weekly attendance, material invoices) into app data.
import { uid, type Item, type Project } from "./store";
import { keyName, parseSheet, type Cell, type ParsedProject } from "./parseSheet";

export type ImportSummary = { projects: number; weeks: number; workers: number; items: number };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Turn every sheet of the workbook into a plain grid of values. */
export async function readWorkbook(file: File): Promise<{ name: string; grid: Cell[][] }[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "buffer", cellDates: true });
  const sheets: { name: string; grid: Cell[][] }[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name] as any;
    if (!ws || !ws["!ref"]) continue;
    const rg = XLSX.utils.decode_range(ws["!ref"]);
    const grid: Cell[][] = [];
    for (let r = rg.s.r; r <= rg.e.r; r++) {
      const row: Cell[] = [];
      for (let c = rg.s.c; c <= rg.e.c; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        let v: Cell = null;
        if (cell) {
          if (cell.t === "d") v = cell.v instanceof Date ? iso(cell.v) : Number(cell.v);
          else if (cell.t === "n") v = Number(cell.v);
          else if (cell.t === "s" || cell.t === "b") v = String(cell.v);
          else if (cell.w) v = String(cell.w);
        }
        row.push(v);
      }
      grid.push(row);
    }
    sheets.push({ name, grid });
  }
  return sheets;
}

const sameItem = (a: Item, b: Item) => a.name === b.name && a.price === b.price && a.qty === b.qty;

/** Add parsed sheets to the app data without duplicating what is already there. */
export function mergeParsed(projects: Project[], parsed: ParsedProject[]) {
  const out: Project[] = projects.map((p) => ({
    ...p,
    workers: p.workers.map((w) => ({ ...w })),
    weeks: p.weeks.map((w) => ({ ...w, att: { ...w.att } })),
    items: p.items ? p.items.map((i) => ({ ...i })) : [],
  }));
  const summary: ImportSummary = { projects: 0, weeks: 0, workers: 0, items: 0 };

  for (const pp of parsed) {
    let target = out.find((p) => keyName(p.name) === keyName(pp.name));
    if (!target) {
      target = { id: uid(), name: pp.name, workers: [], weeks: [], items: [], itemsPaid: 0 };
      out.push(target);
      summary.projects++;
    }

    for (const w of pp.workers) {
      const existing = target.workers.find((x) => keyName(x.name) === keyName(w.name));
      if (existing) {
        if (!existing.rate && w.rate) existing.rate = w.rate;
      } else {
        target.workers.push({ id: uid(), name: w.name, rate: w.rate });
        summary.workers++;
      }
    }

    for (const pw of pp.weeks) {
      const last = target.weeks[target.weeks.length - 1];
      const start = pw.start ?? (last ? last.start : new Date().toISOString().slice(0, 10));
      let week = pw.start ? target.weeks.find((w) => w.start === pw.start) : undefined;
      if (!week) {
        week = { id: uid(), start, att: {}, paid: pw.paid || 0 };
        target.weeks.push(week);
        summary.weeks++;
      }
      for (const [name, days] of Object.entries(pw.att)) {
        const worker = target.workers.find((x) => keyName(x.name) === keyName(name));
        if (worker && !week.att[worker.id]) week.att[worker.id] = days.slice(0, 6);
      }
    }

    if (pp.items.length) {
      const have = target.items ?? [];
      const already = have.length > 0 && pp.items.every((it) => have.some((x) => sameItem(x, it)));
      if (!already) {
        target.items = [...have, ...pp.items.filter((it) => !have.some((x) => sameItem(x, it)))];
        target.itemsPaid = (target.itemsPaid ?? 0) + pp.itemsPaid;
        summary.items += pp.items.length;
      }
    }
  }

  for (const p of out) p.weeks.sort((a, b) => (a.start < b.start ? -1 : 1));
  return { data: out, summary };
}

export async function importSheetFile(projects: Project[], file: File) {
  const sheets = await readWorkbook(file);
  const parsed: ParsedProject[] = [];
  for (const s of sheets) parsed.push(...parseSheet(s.grid, s.name));
  return mergeParsed(projects, parsed);
}
