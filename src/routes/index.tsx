import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Package, Plus, Trash2, Users, CalendarDays } from "lucide-react";
import { applyPayment, DAYS, fmt, itemsRemaining, itemsTotal, makeItem, uid, useProjects, weekTotal, weekCombinedTotal, workerDays, type Project } from "@/lib/store";
import { InstallButton } from "@/components/InstallButton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أعمالي — حضور وأجور العمال" },
      { name: "description", content: "سجل أيام عمل العمال وأجورهم الأسبوعية لكل ورشة من هاتفك." },
      { property: "og:title", content: "أعمالي — حضور وأجور العمال" },
      { property: "og:description", content: "سجل أيام عمل العمال وأجورهم الأسبوعية لكل ورشة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: App,
});

const addDays = (d: string, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};

function App() {
  const [projects, setProjects] = useProjects();
  const [openId, setOpenId] = useState<string | null>(null);
  const known = (() => {
    const seen = new Set<string>();
    const list: { name: string; rate: number }[] = [];
    for (const pr of projects) for (const w of pr.workers) {
      const k = w.name.trim();
      if (k && !seen.has(k)) { seen.add(k); list.push({ name: k, rate: w.rate }); }
    }
    return list;
  })();
  const open = projects.find((p) => p.id === openId);
  const update = (p: Project) => setProjects(projects.map((x) => (x.id === p.id ? p : x)));

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-md bg-background pb-24 font-body">
      {open ? (
        <ProjectView key={open.id} p={open} known={known} onBack={() => setOpenId(null)} update={update}
          remove={() => { if (confirm("حذف الورشة؟")) { setProjects(projects.filter((x) => x.id !== open.id)); setOpenId(null); } }} />
      ) : (
        <>
          <header className="hero px-5 pb-8 pt-10">
            <p className="text-sm opacity-80">دفتر العمال</p>
            <h1 className="font-display text-4xl font-bold">أعمالي</h1>
            <p className="mt-3 text-sm opacity-80">
              المستحق الكلي: <b className="text-lg">{fmt(projects.reduce((s, p) => s + p.weeks.reduce((a, w) => a + weekTotal(p, w) - w.paid, 0), 0))}</b> دج
            </p>
          </header>
          <main className="-mt-4 space-y-3 px-4">
            {projects.map((p) => {
              const total = p.weeks.reduce((a, w) => a + weekTotal(p, w), 0);
              return (
                <button key={p.id} onClick={() => setOpenId(p.id)}
                  className="w-full rounded-2xl bg-card p-4 text-right shadow-soft transition active:scale-[0.98]">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">{p.name}</h2>
                    <span className="font-display text-xl font-bold text-primary">{fmt(total)}</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users size={14} />{p.workers.length} عمال</span>
                    <span className="flex items-center gap-1"><CalendarDays size={14} />{p.weeks.length} أسابيع</span>
                    {(p.items?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1"><Package size={14} />{p.items?.length ?? 0} مادة</span>
                    )}
                  </div>
                </button>
              );
            })}
            <InstallButton />
          </main>
          <Fab label="ورشة جديدة" onClick={() => {
            const name = prompt("اسم الورشة / الزبون");
            if (!name) return;
            setProjects([...projects, { id: uid(), name, workers: [], weeks: [] }]);
          }} />
        </>
      )}
    </div>
  );
}

function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-soft">
      <Plus size={18} />{label}
    </button>
  );
}

function PayRow({ total, paid, onChange }: { total: number; paid: number; onChange: (paid: number) => void }) {
  const [amount, setAmount] = useState("");
  const remaining = total - (paid || 0);
  const pay = () => {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) return;
    onChange(applyPayment(paid, n));
    setAmount("");
  };
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span>مدفوع:</span>
        <input className="field min-w-0 flex-1" type="number" inputMode="numeric" min="0" step="any" placeholder="المبلغ"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pay(); } }} />
        <Button type="button" size="sm" onClick={pay} disabled={!amount}><Check />تم الدفع</Button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">
          المدفوع: <b className="text-foreground">{fmt(paid || 0)}</b>
          {(paid || 0) > 0 && (
            <button type="button" className="ms-2 text-xs underline" onClick={() => { if (confirm("إلغاء كل المدفوعات؟")) onChange(0); }}>إلغاء</button>
          )}
        </span>
        <span className={remaining > 0 ? "font-bold text-destructive" : "font-bold text-primary"}>الباقي: {fmt(remaining)} دج</span>
      </div>
    </div>
  );
}

function ProjectView({ p, known, onBack, update, remove }: { p: Project; known: { name: string; rate: number }[]; onBack: () => void; update: (p: Project) => void; remove: () => void }) {
  const [tab, setTab] = useState<"weeks" | "workers" | "items">("weeks");
  const weeks = [...p.weeks].sort((a, b) => a.start.localeCompare(b.start));
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const selectedIndex = selectedWeekId ? weeks.findIndex((w) => w.id === selectedWeekId) : weeks.length - 1;
  const currentIndex = selectedIndex < 0 ? weeks.length - 1 : selectedIndex;
  const currentWeek = weeks[currentIndex];
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");

  const setAtt = (wid: string, kid: string, d: number) => {
    update({ ...p, weeks: p.weeks.map((w) => {
      if (w.id !== wid) return w;
      const arr = [...(w.att[kid] ?? [0, 0, 0, 0, 0, 0])];
      arr[d] = arr[d] === 1 ? 0.5 : arr[d] === 0.5 ? 0 : 1;
      return { ...w, att: { ...w.att, [kid]: arr } };
    }) });
  };

  return (
    <>
      <header className="hero px-4 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <button onClick={onBack} aria-label="رجوع"><ArrowRight /></button>
          <button onClick={remove} aria-label="حذف" className="opacity-70"><Trash2 size={18} /></button>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold">{p.name}</h1>
        <div className="mt-4 flex gap-2">
          {(["weeks", "workers", "items"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === t ? "bg-card text-foreground" : "bg-primary-foreground/15"}`}>
              {t === "weeks" ? "الأسابيع" : t === "workers" ? "العمال" : "المواد"}
            </button>
          ))}
        </div>
      </header>

      <main className="space-y-4 p-4">
        {tab === "workers" ? (
          <>
            {(() => {
              const available = known.filter((k) => !p.workers.some((x) => x.name.trim() === k.name));
              if (available.length === 0) return null;
              return (
                <div className="rounded-2xl bg-card p-3 shadow-soft">
                  <p className="mb-2 text-xs text-muted-foreground">أضف من عمالك السابقين:</p>
                  <div className="flex flex-wrap gap-2">
                    {available.map((k) => (
                      <button key={k.name} onClick={() => update({ ...p, workers: [...p.workers, { id: uid(), name: k.name, rate: k.rate }] })}
                        className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-sm font-bold">
                        {k.name}<Plus size={14} className="text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {p.workers.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
                <input className="field flex-1" value={k.name}
                  onChange={(e) => update({ ...p, workers: p.workers.map((x) => x.id === k.id ? { ...x, name: e.target.value } : x) })} />
                <input className="field w-24 text-center" type="number" inputMode="numeric" value={k.rate}
                  onChange={(e) => update({ ...p, workers: p.workers.map((x) => x.id === k.id ? { ...x, rate: +e.target.value } : x) })} />
                <span className="text-xs text-muted-foreground">دج/يوم</span>
                <button onClick={() => update({ ...p, workers: p.workers.filter((x) => x.id !== k.id) })} className="text-destructive"><Trash2 size={16} /></button>
              </div>
            ))}
            {p.workers.length === 0 && <p className="text-center text-muted-foreground">أضف العمال وأجرتهم اليومية</p>}
            <Fab label="عامل جديد" onClick={() => {
              const name = prompt("اسم العامل");
              if (name) update({ ...p, workers: [...p.workers, { id: uid(), name, rate: 1500 }] });
            }} />
          </>
        ) : tab === "items" ? (
          <>
            <form className="space-y-3 border-b pb-4" onSubmit={(e) => {
              e.preventDefault();
              const qty = Number(itemQty), price = Number(itemPrice);
              if (!itemName.trim() || !itemQty || !itemPrice || !Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0) return;
              update({ ...p, items: [...(p.items ?? []), makeItem(itemName, qty, price)] });
              setItemName(""); setItemQty("1"); setItemPrice("");
            }}>
              <label className="block text-sm">اسم المادة
                <input className="field mt-1 w-full" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">الكمية
                  <input className="field mt-1 w-full" type="number" inputMode="decimal" min="0.001" step="any" value={itemQty} onChange={(e) => setItemQty(e.target.value)} required />
                </label>
                <label className="block text-sm">السعر للوحدة (دج)
                  <input className="field mt-1 w-full" type="number" inputMode="decimal" min="0" step="any" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} required />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm">مجموع المادة: <b>{fmt((Number(itemQty) || 0) * (Number(itemPrice) || 0))} دج</b></span>
                <Button type="submit"><Plus />إضافة مادة</Button>
              </div>
            </form>
            {(p.items?.length ?? 0) === 0 && (
              <p className="text-center text-muted-foreground">لا توجد مواد مسجّلة لهذه الورشة</p>
            )}
            {(p.items ?? []).map((it, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 shadow-soft">
                <span className="min-w-0 flex-1 break-words text-sm font-bold">{it.name}</span>
                <span className="text-xs text-muted-foreground">{fmt(it.qty)} × {fmt(it.price)}</span>
                <b className="font-display text-sm">{fmt(it.total)}</b>
                <Button variant="ghost" size="icon"
                  onClick={() => update({ ...p, items: (p.items ?? []).filter((_, j) => j !== i) })}
                   className="text-destructive" aria-label="حذف المادة"><Trash2 size={16} /></Button>
              </div>
            ))}
            {(p.items?.length ?? 0) > 0 && (
              <div className="space-y-2 rounded-2xl bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between text-sm">
                  <span>مجموع المواد</span>
                  <b className="font-display text-lg">{fmt(itemsTotal(p))} دج</b>
                </div>
                <PayRow total={itemsTotal(p)} paid={p.itemsPaid ?? 0} onChange={(paid) => update({ ...p, itemsPaid: paid })} />
              </div>
            )}
          </>
        ) : (
          <>
            {weeks.length === 0 && <p className="text-center text-muted-foreground">لا توجد أسابيع بعد</p>}
            {currentWeek && (
              <nav aria-label="التنقل بين الأسابيع" className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => {
                  const previous = weeks[currentIndex - 1];
                  if (previous) setSelectedWeekId(previous.id);
                }}><ChevronRight />الأقدم</Button>
                <span className="text-sm font-bold">الأسبوع {currentIndex + 1} من {weeks.length}</span>
                <Button variant="outline" size="sm" disabled={currentIndex === weeks.length - 1} onClick={() => {
                  const next = weeks[currentIndex + 1];
                  if (next) setSelectedWeekId(next.id);
                }}>الأحدث<ChevronLeft /></Button>
              </nav>
            )}
            {(currentWeek ? [currentWeek] : []).map((w) => {
              const total = weekTotal(p, w);
              return (
                <section key={w.id} className="rounded-2xl bg-card p-3 shadow-soft">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-bold">الأسبوع {currentIndex + 1}</h3>
                    <span className="text-xs text-muted-foreground">{w.start} ← {addDays(w.start, 5)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-center text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground">
                          <th className="p-1 text-right">اليوم</th>
                          {p.workers.map((k) => <th key={k.id} className="p-1">{k.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map((d, di) => (
                          <tr key={d}>
                            <td className="p-1 text-right text-xs">{d}</td>
                            {p.workers.map((k) => {
                              const v = w.att[k.id]?.[di] ?? 0;
                              return (
                                <td key={k.id} className="p-0.5">
                                  <button onClick={() => setAtt(w.id, k.id, di)}
                                    className={`h-9 w-full rounded-lg font-bold transition ${v === 1 ? "bg-primary text-primary-foreground" : v === 0.5 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {v === 1 ? "✓" : v === 0.5 ? "½" : "—"}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr className="border-t text-xs">
                          <td className="p-1 text-right">الأيام</td>
                          {p.workers.map((k) => <td key={k.id} className="p-1 font-bold">{workerDays(w, k.id)}</td>)}
                        </tr>
                        <tr className="text-xs">
                          <td className="p-1 text-right">الأجرة</td>
                          {p.workers.map((k) => <td key={k.id} className="p-1 font-bold text-primary">{fmt(workerDays(w, k.id) * k.rate)}</td>)}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 space-y-2 rounded-xl bg-muted p-3">
                    <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">مجموع أجرة العمال</span>
                    <b className="font-display text-xl">{fmt(total)} دج</b>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>مجموع السلع</span><b>{fmt(itemsRemaining(p))} دج</b>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t pt-2">
                      <span className="font-bold">المجموع الكلي</span>
                      <b className="font-display text-xl text-primary">{fmt(weekCombinedTotal(p, w))} دج</b>
                    </div>
                  </div>
                  <div className="mt-2">
                    <PayRow key={w.id} total={weekCombinedTotal(p, w)} paid={w.paid}
                      onChange={(paid) => update({ ...p, weeks: p.weeks.map((x) => x.id === w.id ? { ...x, paid } : x) })} />
                  </div>
                </section>
              );
            })}
            <Fab label="أسبوع جديد" onClick={() => {
              const last = weeks[weeks.length - 1];
              let start = last ? addDays(last.start, 7) : new Date().toISOString().slice(0, 10);
              if (!last) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); start = d.toISOString().slice(0, 10); }
              const id = uid();
              update({ ...p, weeks: [...p.weeks, { id, start, att: {}, paid: 0 }] });
              setSelectedWeekId(id);
            }} />
          </>
        )}
      </main>
    </>
  );
}
