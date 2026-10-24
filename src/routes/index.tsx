import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, FileUp, Package, Plus, Trash2, Users, CalendarDays } from "lucide-react";
import { DAYS, fmt, uid, useProjects, weekTotal, workerDays, type Project } from "@/lib/store";
import { importSheetFile } from "@/lib/importSheet";
import { InstallButton } from "@/components/InstallButton";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setMsg("جارٍ قراءة الملف…");
    try {
      const { data, summary } = await importSheetFile(projects, f);
      setProjects(data);
      setMsg(
        `تمت الإضافة: ${summary.projects} ورشة، ${summary.workers} عامل، ${summary.weeks} أسبوع، ${summary.items} مادة`,
      );
    } catch {
      setMsg("تعذّر قراءة الملف. جرّب ملف Excel آخر.");
    } finally {
      setBusy(false);
    }
  };
  const open = projects.find((p) => p.id === openId);
  const update = (p: Project) => setProjects(projects.map((x) => (x.id === p.id ? p : x)));

  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-md bg-background pb-24 font-body">
      {open ? (
        <ProjectView p={open} onBack={() => setOpenId(null)} update={update}
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
            <div className="rounded-2xl bg-card p-3 shadow-soft">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-60">
                <FileUp size={16} />
                {busy ? "جارٍ القراءة…" : "استيراد من ملف Excel"}
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
              {msg && <p className="mt-2 text-center text-xs text-muted-foreground">{msg}</p>}
            </div>
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
                      <span className="flex items-center gap-1"><Package size={14} />{p.items!.length} مادة</span>
                    )}
                  </div>
                </button>
              );
            })}
            <InstallButton />
          </main>
          <Fab label="ورشة جديدة" onClick={() => {
            const name = prompt("اسم الورشة / الزبون");
            if (name) setProjects([...projects, { id: uid(), name, workers: [], weeks: [] }]);
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

function ProjectView({ p, onBack, update, remove }: { p: Project; onBack: () => void; update: (p: Project) => void; remove: () => void }) {
  const [tab, setTab] = useState<"weeks" | "workers" | "items">("weeks");
  const weeks = [...p.weeks].reverse();

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
        ) : (
          <>
            {weeks.length === 0 && <p className="text-center text-muted-foreground">لا توجد أسابيع بعد</p>}
            {weeks.map((w, i) => {
              const total = weekTotal(p, w);
              return (
                <section key={w.id} className="rounded-2xl bg-card p-3 shadow-soft">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-bold">الأسبوع {weeks.length - i}</h3>
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
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3">
                    <span className="text-sm">المجموع</span>
                    <b className="font-display text-xl">{fmt(total)} دج</b>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    مدفوع:
                    <input className="field flex-1" type="number" inputMode="numeric" value={w.paid || ""}
                      onChange={(e) => update({ ...p, weeks: p.weeks.map((x) => x.id === w.id ? { ...x, paid: +e.target.value } : x) })} />
                    <span className={total - w.paid > 0 ? "font-bold text-destructive" : "font-bold text-primary"}>باقي {fmt(total - w.paid)}</span>
                  </label>
                </section>
              );
            })}
            <Fab label="أسبوع جديد" onClick={() => {
              const last = p.weeks[p.weeks.length - 1];
              let start = last ? addDays(last.start, 7) : new Date().toISOString().slice(0, 10);
              if (!last) { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); start = d.toISOString().slice(0, 10); }
              update({ ...p, weeks: [...p.weeks, { id: uid(), start, att: {}, paid: 0 }] });
            }} />
          </>
        )}
      </main>
    </>
  );
}
