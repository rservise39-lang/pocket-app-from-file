import { useRef, useState } from "react";
import { Download, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { backupSummary, parseBackup, PROJECTS_STORAGE_KEY, serializeBackup } from "@/lib/backup";
import type { Project } from "@/lib/store";

type Preview = { projects: Project[]; text: string; filename: string; previous: string | null };

export function BackupControls({ projects, ready, restore }: {
  projects: Project[]; ready: boolean; restore: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : "تعذرت العملية؛ لم تُستبدل بياناتك.");
  const download = () => {
    setError(""); setMessage("");
    try {
      const raw = localStorage.getItem(PROJECTS_STORAGE_KEY);
      const text = serializeBackup(raw === null ? projects : parseBackup(raw));
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `a3mali-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { fail(cause); }
  };
  const read = async (file: File) => {
    setReading(true); setError(""); setMessage(""); setPreview(null);
    try {
      const previous = localStorage.getItem(PROJECTS_STORAGE_KEY);
      const text = await file.text();
      setPreview({ projects: parseBackup(text), text, filename: file.name, previous });
    } catch (cause) { fail(cause); }
    finally { setReading(false); }
  };
  const confirmRestore = () => {
    if (!preview) return;
    setError("");
    try {
      if (localStorage.getItem(PROJECTS_STORAGE_KEY) !== preview.previous) {
        throw new Error("تغيرت بيانات الجهاز أثناء المعاينة؛ ألغِ وافتح الملف مجددًا قبل الاستعادة.");
      }
      restore(preview.text);
      setPreview(null); setMessage("تمت استعادة البيانات وحفظها على هذا الجهاز.");
    } catch (cause) { fail(cause); }
  };
  const summary = preview ? backupSummary(preview.projects) : null;
  const existing = backupSummary(projects);
  return (
    <section className="space-y-2 border-t pt-3" aria-label="النسخ الاحتياطي والاستعادة">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={!ready || reading} onClick={download}><Download />نسخ احتياطي JSON</Button>
        <Button variant="outline" size="sm" disabled={!ready || reading} onClick={() => { setError(""); setMessage(""); input.current?.click(); }}><Upload />استعادة JSON</Button>
      </div>
      <input ref={input} type="file" accept=".json,application/json" className="hidden" aria-label="ملف النسخة الاحتياطية"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void read(file); }} />
      {reading && <p role="status" className="text-sm text-muted-foreground">جارٍ فحص الملف…</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {!preview && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) { setPreview(null); setError(""); } }}>
        <DialogContent dir="rtl" className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-lg font-body">
          <DialogTitle className="text-right tracking-normal">معاينة النسخة الاحتياطية</DialogTitle>
          <DialogDescription className="text-right">ستستبدل هذه النسخة جميع بيانات أعمالي على هذا الجهاز. لا يمكن التراجع؛ احتفظ بنسخة من بياناتك الحالية أولًا.</DialogDescription>
          {preview && summary && <>
            <p className="break-words text-sm" dir="auto">{preview.filename}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <b>البيانات</b><b>الحالية</b><b>من الملف</b>
              <span>الورشات</span><span>{existing.projects}</span><span>{summary.projects}</span>
              <span>العمال</span><span>{existing.workers}</span><span>{summary.workers}</span>
              <span>الأسابيع</span><span>{existing.weeks}</span><span>{summary.weeks}</span>
              <span>المواد</span><span>{existing.items}</span><span>{summary.items}</span>
            </div>
            {preview.projects.length === 0 && <p className="text-sm text-destructive">النسخة فارغة؛ التأكيد سيزيل جميع الورشات الحالية.</p>}
            <ul className="space-y-2 border-t pt-2 text-sm">
              {preview.projects.map((project) => <li key={project.id} className="break-words">
                <b>{project.name || "ورشة بدون اسم"}</b>
                <p className="text-muted-foreground">{project.workers.length} عمال · {project.weeks.length} أسابيع · {project.items?.length ?? 0} مواد</p>
              </li>)}
            </ul>
          </>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setPreview(null); setError(""); }}>إلغاء</Button>
            <Button variant="destructive" onClick={confirmRestore}><Check />تأكيد استبدال البيانات</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}