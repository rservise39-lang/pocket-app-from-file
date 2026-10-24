// Parses the user's weekly workbook (attendance blocks + materials invoices)
// into app-shaped projects. Pure: works on a plain grid of cell values so it can
// be tested without a file.

export type Cell = string | number | null;

export type ParsedWeek = { start: string | null; att: Record<string, number[]> };
export type ParsedWorker = { name: string; rate: number };
export type ParsedItem = { name: string; price: number; qty: number };
export type ParsedProject = {
  name: string;
  workers: ParsedWorker[];
  weeks: ParsedWeek[];
  items: ParsedItem[];
  itemsTotal: number;
  itemsPaid: number;
};

export const DAY_NAMES = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

const normAr = (s: string) =>
  s
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const keyName = (s: string) => normAr(String(s ?? ""));

const FILLER_RE =
  /^(وصل|المجموع|مجموع|تخفيض|دافع|دافع|باقي|دين|خالص|total|versement|ايام|ايام|الاسبوع|اسبوع|week|عرض|الطول|الارتفاع|بلافو|حيوط|باب|كومبريسور|نوع|سلع)/i;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isText = (v: Cell): v is string => typeof v === "string" && v.trim() !== "";
const num = (v: Cell): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const isFiller = (s: string) => normAr(s).split(" ").some((w) => w !== "" && FILLER_RE.test(w));
const dayIndex = (v: Cell) => (isText(v) ? DAY_NAMES.findIndex((d) => normAr(d) === normAr(v)) : -1);
const at = (grid: Cell[][], r: number, c: number): Cell =>
  r >= 0 && c >= 0 && r < grid.length && c < (grid[r]?.length ?? 0) ? grid[r][c] : null;

/** Title cell of a sheet, e.g. A1="صالح تركي" — used when a block has no client name. */
function sheetTitle(grid: Cell[][]): string | null {
  for (let r = 0; r < Math.min(3, grid.length); r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const v = grid[r][c];
      if (isText(v) && !isFiller(v) && dayIndex(v) < 0 && !DATE_RE.test(v)) return v.trim();
    }
  }
  return null;
}

type Block = { labelCol: number; rows: { r: number; i: number }[] };

function findBlocks(grid: Cell[][]): Block[] {
  const rows = grid.length;
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const byCol = new Map<number, { r: number; i: number }[]>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = dayIndex(grid[r]?.[c]);
      if (i >= 0) {
        if (!byCol.has(c)) byCol.set(c, []);
        byCol.get(c)!.push({ r, i });
      }
    }
  }
  const blocks: Block[] = [];
  for (const [labelCol, cells] of byCol) {
    cells.sort((a, b) => a.r - b.r);
    let run: { r: number; i: number }[] = [cells[0]];
    for (let k = 1; k <= cells.length; k++) {
      const cur = cells[k];
      const prev = run[run.length - 1];
      const joins = cur && cur.r === prev.r + 1 && cur.i === prev.i + 1;
      if (joins) run.push(cur);
      else {
        if (run.length >= 3) blocks.push({ labelCol, rows: run });
        run = cur ? [cur] : [];
      }
    }
  }
  return blocks;
}

function headerRow(grid: Cell[][], block: Block): number | null {
  for (let d = 1; d <= 4; d++) {
    const r = block.rows[0].r - d;
    if (r < 0) break;
    if (dayIndex(at(grid, r, block.labelCol)) >= 0) continue;
    let names = 0;
    for (let c = block.labelCol + 1; c < (grid[r]?.length ?? 0); c++) {
      const v = grid[r][c];
      if (isText(v) && !isFiller(v) && dayIndex(v) < 0) names++;
      else break;
    }
    if (names >= 1) return r;
  }
  return null;
}

function readWorkers(grid: Cell[][], header: number, labelCol: number) {
  const workers: { col: number; name: string }[] = [];
  for (let c = labelCol + 1; c < (grid[header]?.length ?? 0); c++) {
    const v = grid[header][c];
    if (!isText(v) || isFiller(v) || dayIndex(v) >= 0) break;
    workers.push({ col: c, name: v.trim() });
  }
  return workers;
}

/** Rows below a block holding the "days" total then the "pay" total. */
function totalRows(grid: Cell[][], block: Block, workerCols: number[]) {
  const found: number[] = [];
  const last = block.rows[block.rows.length - 1].r;
  for (let r = last + 1; r <= last + 8 && found.length < 2; r++) {
    if (dayIndex(at(grid, r, block.labelCol)) >= 0) break;
    const vals = workerCols.map((c) => num(at(grid, r, c)));
    if (vals.some((v) => v !== null)) found.push(r);
  }
  return found;
}

function blockWeek(grid: Cell[][], block: Block, workers: { col: number; name: string }[]) {
  const att: Record<string, number[]> = {};
  for (const w of workers) {
    const arr = [0, 0, 0, 0, 0, 0];
    for (const { r, i } of block.rows) {
      const v = num(at(grid, r, w.col));
      if (v !== null) arr[i] = Math.min(1, Math.max(0, v));
    }
    att[w.name] = arr;
  }
  let start: string | null = null;
  const first = block.rows[0].r;
  for (let c = block.labelCol - 1; c >= 0 && !start; c--) {
    const v = at(grid, first, c);
    if (isText(v) && DATE_RE.test(v)) start = v;
  }
  if (!start) {
    for (let c = 0; c < (grid[first]?.length ?? 0) && !start; c++) {
      const v = grid[first][c];
      if (isText(v) && DATE_RE.test(v)) start = v;
    }
  }
  return { att, start };
}

export function parseAttendance(grid: Cell[][], sheetName: string) {
  const title = sheetTitle(grid);
  const projects = new Map<string, ParsedProject>();
  const rates = new Map<string, number[]>();
  const clients: string[] = [];

  for (const block of findBlocks(grid)) {
    const header = headerRow(grid, block);
    if (header === null) continue;
    const workers = readWorkers(grid, header, block.labelCol);
    if (!workers.length) continue;

    const label = at(grid, header, block.labelCol);
    const name =
      isText(label) && !isFiller(label) && dayIndex(label) < 0 ? label.trim() : (title ?? sheetName);
    if (!clients.includes(name)) clients.push(name);

    if (!projects.has(name)) projects.set(name, { name, workers: [], weeks: [], items: [], itemsTotal: 0, itemsPaid: 0 });
    const project = projects.get(name)!;

    const { att, start } = blockWeek(grid, block, workers);
    const seen = new Set(project.weeks.map((w) => w.start));
    if (!start || !seen.has(start)) project.weeks.push({ start, att });

    const cols = workers.map((w) => w.col);
    const totals = totalRows(grid, block, cols);
    if (totals.length === 2) {
      workers.forEach((w) => {
        const days = num(at(grid, totals[0], w.col)) ?? 0;
        const pay = num(at(grid, totals[1], w.col)) ?? 0;
        if (days > 0 && pay > 0) {
          const rate = Math.round(pay / days / 10) * 10;
          const k = `${name}\u0000${keyName(w.name)}`;
          if (!rates.has(k)) rates.set(k, []);
          rates.get(k)!.push(rate);
        }
      });
    }
  }

  // worker names come from the blocks themselves
  for (const project of projects.values()) {
    const names = new Map<string, string>();
    for (const wk of project.weeks) {
      for (const w of Object.keys(wk.att)) if (!names.has(keyName(w))) names.set(keyName(w), w);
    }
    project.workers = [...names.values()].map((display) => ({ name: display, rate: 0 }));
  }

  // a worker's daily pay is what the sheet's own pay row implies (pay ÷ days)
  for (const [k, list] of rates) {
    const [projName, workerKey] = k.split("\u0000");
    const project = projects.get(projName);
    if (!project) continue;
    const counts = new Map<number, number>();
    for (const r of list) counts.set(r, (counts.get(r) ?? 0) + 1);
    const rate = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const w = project.workers.find((x) => keyName(x.name) === workerKey);
    if (w && !w.rate) w.rate = rate;
  }

  return { projects: [...projects.values()], clients };
}

type ItemList = { nameCol: number; rows: number[]; totalCol: number };

function rowHasFiller(grid: Cell[][], r: number) {
  for (const v of grid[r] ?? []) if (isText(v) && isFiller(v)) return true;
  return false;
}

function findItemLists(grid: Cell[][]): ItemList[] {
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const lists: ItemList[] = [];
  for (let nc = 1; nc < cols; nc++) {
    let open: ItemList | null = null;
    for (let r = 0; r < grid.length; r++) {
      // an invoice ends at its own total / discount / paid / remaining rows
      if (rowHasFiller(grid, r)) {
        open = null;
        continue;
      }
      const name = grid[r]?.[nc];
      if (!isText(name) || isFiller(name) || dayIndex(name) >= 0 || DATE_RE.test(name)) continue;
      const price = num(at(grid, r, nc - 1));
      if (price === null || price < 5) continue;
      let totalCol = -1;
      for (let c = nc + 1; c < (grid[r]?.length ?? 0); c++) if (num(grid[r][c]) !== null) totalCol = c;
      if (totalCol < 0) continue;
      if (open && r - open.rows[open.rows.length - 1] <= 3) open.rows.push(r);
      else {
        open = { nameCol: nc, rows: [r], totalCol };
        lists.push(open);
      }
    }
  }
  return lists.filter((l) => l.rows.length >= 3);
}

function labelValue(grid: Cell[][], r: number, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const v = at(grid, r, c);
    if (isText(v) && !isFiller(v) && dayIndex(v) < 0) return v.trim();
  }
  return null;
}

export function parseMaterials(grid: Cell[][], sheetName: string, clients: string[]) {
  const out: ParsedProject[] = [];
  for (const list of findItemLists(grid)) {
    const end = list.rows[list.rows.length - 1];
    let total = 0;
    let paid = 0;
    let discount = 0;
    let remaining = 0;
    let hasTotal = false;
    for (let r = end + 1; r <= Math.min(grid.length - 1, end + 9); r++) {
      for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
        const v = grid[r][c];
        if (!isText(v)) continue;
        const k = normAr(v);
        const right = num(at(grid, r, c + 1)) ?? num(at(grid, r, c + 2));
        if (/^(المجموع|مجموع|total job)/.test(k)) {
          total = num(at(grid, r, list.totalCol)) ?? right ?? 0;
          hasTotal = true;
        } else if (/^دافع/.test(k)) paid = right ?? 0;
        else if (/^تخفيض/.test(k)) discount = right ?? 0;
        else if (/^باقي/.test(k)) remaining = right ?? 0;
      }
    }
    if (!hasTotal) continue; // real invoices always end with a total
    if (!paid) paid = Math.max(0, total - discount - remaining);

    let name: string | null = null;
    for (let r = list.rows[0] - 1; r >= Math.max(0, list.rows[0] - 3) && !name; r--) {
      const above = at(grid, r, list.nameCol);
      // a priced item row above means we walked into the previous invoice
      if (isText(above) && !isFiller(above) && num(at(grid, r, list.nameCol - 1)) !== null) break;
      name =
        labelValue(grid, r, list.nameCol, list.nameCol) ??
        labelValue(grid, r, list.nameCol + 1, list.nameCol + 2) ??
        labelValue(grid, r, list.nameCol - 2, list.nameCol - 1);
    }
    if (!name) name = clients.length === 1 ? clients[0] : sheetName;

    const items = list.rows.map((r) => {
      const itemName = String(grid[r][list.nameCol]).trim();
      const price = num(at(grid, r, list.nameCol - 1)) ?? 0;
      let qty = 1;
      for (let c = list.nameCol + 1; c < list.totalCol; c++) {
        const v = num(grid[r][c]);
        if (v !== null) {
          qty = v;
          break;
        }
      }
      return { name: itemName, price, qty: qty || 1 };
    });

    out.push({
      name: name.trim(),
      workers: [],
      weeks: [],
      items,
      itemsTotal: total,
      itemsPaid: paid,
    });
  }
  return out;
}

export function parseSheet(grid: Cell[][], sheetName: string): ParsedProject[] {
  const att = parseAttendance(grid, sheetName);
  const mats = parseMaterials(grid, sheetName, att.clients);
  const byName = new Map<string, ParsedProject>();
  for (const p of [...att.projects, ...mats]) {
    const k = keyName(p.name);
    if (!byName.has(k)) {
      byName.set(k, { name: p.name, workers: [], weeks: [], items: [], itemsTotal: 0, itemsPaid: 0 });
    }
    const t = byName.get(k)!;
    t.workers.push(...p.workers);
    t.weeks.push(...p.weeks);
    t.items.push(...p.items);
    t.itemsTotal += p.itemsTotal;
    t.itemsPaid += p.itemsPaid;
  }
  return [...byName.values()];
}
