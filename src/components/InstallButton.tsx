import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function InstallButton() {
  const [deferred, setDeferred] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as PromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIOS()) setIosHint(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (deferred) {
    return (
      <button
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          if (outcome === "accepted") {
            setInstalled(true);
            setDeferred(null);
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-card px-4 py-3 text-sm font-bold text-primary shadow-soft transition active:scale-[0.98]"
      >
        <Download size={16} /> ثبّت أعمالي على الهاتف
      </button>
    );
  }

  if (iosHint) {
    return (
      <p className="flex items-start gap-2 rounded-2xl bg-card px-4 py-3 text-xs leading-6 text-muted-foreground shadow-soft">
        <Share size={14} className="mt-1 shrink-0" />
        لحفظ التطبيق على هاتفك: افتح قائمة المشاركة في أعلى المتصفح ثم اختر «إضافة إلى الشاشة
        الرئيسية».
      </p>
    );
  }

  return null;
}
