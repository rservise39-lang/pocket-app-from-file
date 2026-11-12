import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { backupSummary, parseBackup, persistRestore, PROJECTS_STORAGE_KEY, serializeBackup } from "./backup";
import { useProjects, type Project } from "./store";

const data: Project[] = [{
  id: "old", name: "ورشة قديمة", workers: [{ id: "w", name: "سليم", rate: 2000 }],
  weeks: [{ id: "week", start: "2025-01-04", att: { w: [1, 0.5, 0, 1, 0, 1], removed: [1, 0, 0, 0, 0, 0] }, paid: 2000 }],
  items: [{ name: "إسمنت", qty: 3, price: 1000, total: 3000 }], itemsPaid: 2000,
}];

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("local JSON backup", () => {
  it("keeps the exact a3mali-v1 project array, dates, orphan attendance and payments", () => {
    const text = serializeBackup(data);
    expect(JSON.parse(text)).toEqual(data);
    expect(parseBackup(text)).toEqual(data);
    expect(PROJECTS_STORAGE_KEY).toBe("a3mali-v1");
  });
  it("retains additional fields and does not recalculate existing totals", () => {
    const extended = [{ ...data[0], extra: { note: "keep" }, items: [{ name: "old", qty: 3, price: 2, total: 7 }] }];
    expect(parseBackup(JSON.stringify(extended))).toEqual(extended);
  });
  it("accepts empty backups and missing optional materials", () => {
    expect(parseBackup("[]")).toEqual([]);
    const minimal = [{ id: "p", name: "", workers: [], weeks: [] }];
    expect(parseBackup(JSON.stringify(minimal))).toEqual(minimal);
  });
  it("counts preview records without modifying them", () => {
    expect(backupSummary(data)).toEqual({ projects: 1, workers: 1, weeks: 1, items: 1 });
    expect(data[0]?.itemsPaid).toBe(2000);
  });
  it.each(["{broken", "null", "{}", '{"projects":[]}', '[{"id":"p"}]', '[{"__proto__":{}}]'])
    ("rejects invalid or unsafe JSON %s without changing local data", (text) => {
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(data));
      expect(() => persistRestore(text, localStorage)).toThrow();
      expect(JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) ?? "null")).toEqual(data);
    });
  it.each([
    { workers: [{ id: "w", name: "bad", rate: "2000" }] },
    { workers: [{ id: "w", name: "a", rate: 1 }, { id: "w", name: "b", rate: 2 }] },
    { weeks: [{ id: "week", start: "2025-02-30", paid: 0, att: {} }] },
    { weeks: [{ id: "week", start: "2025-01-04", paid: 0, att: { w: [1, 0] } }] },
    { weeks: [{ id: "week", start: "2025-01-04", paid: 0, att: { w: [2, 0, 0, 0, 0, 0] } }] },
    { items: [{ name: "bad", qty: 1, price: 1 }] },
    { itemsPaid: "2000" },
  ])("rejects malformed nested records %j", (change) => {
    expect(() => parseBackup(JSON.stringify([{ ...data[0], ...change }]))).toThrow();
  });
  it("rejects duplicate project IDs", () => {
    expect(() => parseBackup(JSON.stringify([...data, ...data]))).toThrow();
  });
  it("replaces only the existing key after validation succeeds", () => {
    localStorage.setItem("other", "untouched");
    expect(persistRestore(JSON.stringify(data), localStorage)).toEqual(data);
    expect(JSON.parse(localStorage.getItem("a3mali-v1") ?? "null")).toEqual(data);
    expect(localStorage.getItem("other")).toBe("untouched");
  });
  it("leaves stored and rendered projects unchanged on a quota failure", async () => {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(data));
    const { result } = renderHook(() => useProjects());
    await waitFor(() => expect(result.current[2]).toBe(true));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    expect(() => act(() => result.current[3]("[]"))).toThrow();
    expect(result.current[0]).toEqual(data);
    expect(JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) ?? "null")).toEqual(data);
  });
  it("restores state and reads it back on a fresh mount", async () => {
    const first = renderHook(() => useProjects());
    await waitFor(() => expect(first.result.current[2]).toBe(true));
    act(() => first.result.current[3](JSON.stringify(data)));
    expect(first.result.current[0]).toEqual(data);
    first.unmount();
    const next = renderHook(() => useProjects());
    await waitFor(() => expect(next.result.current[2]).toBe(true));
    expect(next.result.current[0]).toEqual(data);
  });
});