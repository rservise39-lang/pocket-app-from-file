import { z } from "zod";
import type { Project } from "./store";

export const PROJECTS_STORAGE_KEY = "a3mali-v1";

const number = z.number().finite();
const id = z.string().min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const uniqueIds = (values: { id: string }[]) => new Set(values.map((value) => value.id)).size === values.length;
const worker = z.object({ id, name: z.string(), rate: number }).passthrough();
const week = z.object({
  id, start: date, paid: number,
  att: z.record(z.array(z.union([z.literal(0), z.literal(0.5), z.literal(1)])).length(6)),
}).passthrough();
const item = z.object({ name: z.string(), price: number, qty: number, total: number }).passthrough();
const project = z.object({
  id, name: z.string(),
  workers: z.array(worker).refine(uniqueIds),
  weeks: z.array(week).refine(uniqueIds),
  items: z.array(item).optional(), itemsPaid: number.optional(),
}).passthrough();
const projectsSchema = z.array(project).refine(uniqueIds);

function rejectUnsafeKeys(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("ملف غير صالح: يحتوي على مفاتيح غير آمنة.");
    rejectUnsafeKeys(child);
  }
}

/** Validate without normalizing, dropping fields, or recalculating stored totals. */
export function parseBackup(text: string): Project[] {
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error("تعذر قراءة JSON. اختر نسخة احتياطية صالحة."); }
  rejectUnsafeKeys(value);
  const result = projectsSchema.safeParse(value);
  if (!result.success) throw new Error("الملف لا يطابق بيانات أعمالي: تحقق من الورشات والعمال والأسابيع والحضور والمواد والمدفوعات.");
  // JSON cannot contain undefined optional values. Return the validated original
  // to preserve every stored field exactly (including future extension fields).
  return value as Project[];
}

export function serializeBackup(projects: Project[]): string {
  const text = JSON.stringify(projects, null, 2);
  parseBackup(text);
  return text;
}

export function backupSummary(projects: Project[]) {
  return projects.reduce((sum, project) => ({
    projects: sum.projects + 1,
    workers: sum.workers + project.workers.length,
    weeks: sum.weeks + project.weeks.length,
    items: sum.items + (project.items?.length ?? 0),
  }), { projects: 0, workers: 0, weeks: 0, items: 0 });
}

/** localStorage.setItem is atomic: only publish the new state after it succeeds. */
export function persistRestore(text: string, storage: Pick<Storage, "setItem">): Project[] {
  const projects = parseBackup(text);
  storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  return projects;
}