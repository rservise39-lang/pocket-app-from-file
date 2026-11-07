import { useEffect, useState } from "react";

export const DAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];

export type Worker = { id: string; name: string; rate: number };
export type Week = { id: string; start: string; att: Record<string, number[]>; paid: number };
export type Item = { name: string; price: number; qty: number; total: number };
export type Project = {
  id: string;
  name: string;
  workers: Worker[];
  weeks: Week[];
  items?: Item[];
  itemsPaid?: number;
};

export const uid = () => Math.random().toString(36).slice(2, 9);

export const workerDays = (w: Week, id: string) => (w.att[id] ?? []).reduce((a, b) => a + (b || 0), 0);
export const weekTotal = (p: Project, w: Week) =>
  p.workers.reduce((s, k) => s + workerDays(w, k.id) * k.rate, 0);
export const itemsTotal = (p: Project) => (p.items ?? []).reduce((s, it) => s + it.total, 0);
export const makeItem = (name: string, qty: number, price: number): Item => ({ name: name.trim(), qty, price, total: qty * price });
export const itemsRemaining = (p: Project) => itemsTotal(p) - (p.itemsPaid ?? 0);
export const weekCombinedTotal = (p: Project, w: Week) => weekTotal(p, w) + itemsRemaining(p);

export const fmt = (n: number) => n.toLocaleString("en-US");

const seed: Project[] = [
  {
    id: "p1",
    name: "صالح تركي",
    workers: [
      { id: "a", name: "سليم", rate: 2000 },
      { id: "b", name: "مسعود", rate: 1500 },
      { id: "c", name: "عمار", rate: 1500 },
      { id: "d", name: "قش", rate: 1000 },
    ],
    weeks: [
      {
        id: "w1",
        start: "2026-02-28",
        paid: 0,
        att: { a: [0, 0, 1, 0, 1, 1], b: [0, 0, 1, 1, 1, 1], c: [0, 0, 1, 1, 0, 1], d: [0, 0, 1, 1, 1, 1] },
      },
    ],
  },
];

const KEY = "a3mali-v1";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(seed);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setProjects(JSON.parse(raw));
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(projects));
  }, [projects, ready]);
  return [projects, setProjects] as const;
}
