"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { today, shiftDay } from "@/lib/dates";
import type { Settings } from "@/lib/types";
import { DragProvider, type DropPayload } from "./DragContext";
import { ThemeProvider } from "./ThemeContext";
import { CardList } from "./CardList";
import { DateNavBar } from "./DateNavBar";
import { DayGrid } from "./DayGrid";
import { ExportDialog } from "./ExportDialog";
import { SettingsDialog } from "./SettingsDialog";

const FALLBACK: Settings = { dayStartMinute: 480, dayEndMinute: 1440 };

export function Scheduler() {
  const qc = useQueryClient();
  const [windowStart, setWindowStart] = useState(today());
  const days: [string, string] = [windowStart, shiftDay(windowStart, 1)];
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [theme, setTheme] = useState<"night" | "day">("night");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "day" || saved === "night") setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const cardsQ = useQuery({ queryKey: ["cards"], queryFn: api.getCards, retry: false });
  const settingsQ = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const windowQ = useQuery({
    queryKey: ["window", days[0], days[1]],
    queryFn: () => api.getWindow(days[0], days[1]),
  });

  const settings = settingsQ.data ?? FALLBACK;
  const invalidateWindow = () => qc.invalidateQueries({ queryKey: ["window"] });
  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 2800);
  };
  const onError = (e: Error) => showToast(e.message);

  const place = useMutation({ mutationFn: api.postPlacement, onSuccess: invalidateWindow, onError });
  const edit = useMutation({
    mutationFn: (v: { id: string; patch: { startMinute: number; endMinute: number } }) =>
      api.patchPlacement(v.id, v.patch),
    onSuccess: invalidateWindow,
    onError,
  });
  const del = useMutation({ mutationFn: api.deletePlacement, onSuccess: invalidateWindow, onError });
  const out = useMutation({
    mutationFn: (v: { day: string; outMinute: number | null }) => api.putOut(v.day, v.outMinute),
    onSuccess: invalidateWindow,
    onError,
  });
  const saveSettings = useMutation({
    mutationFn: api.putSettings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      invalidateWindow();
      setSettingsOpen(false);
    },
    onError,
  });
  const exportSheets = useMutation({
    mutationFn: api.postExportSheets,
    onSuccess: (r) => {
      showToast(
        r.taskCount ? `Exported ${r.taskCount} tasks → "${r.title}"` : "No tasks plotted in that range",
      );
      setExportOpen(false);
    },
    onError,
  });

  const onDrop = (p: DropPayload) => place.mutate(p);

  return (
    <ThemeProvider theme={theme}>
    <DragProvider onDrop={onDrop} onReject={showToast}>
      <div className="flex h-screen overflow-hidden">
        <CardList
          cards={cardsQ.data ?? []}
          plottedIds={windowQ.data?.plottedCardIds ?? []}
          loading={cardsQ.isLoading}
          error={cardsQ.isError ? (cardsQ.error as Error).message : undefined}
          onRefresh={() => qc.invalidateQueries({ queryKey: ["cards"] })}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <DateNavBar
            days={days}
            onPrev={() => setWindowStart((d) => shiftDay(d, -1))}
            onNext={() => setWindowStart((d) => shiftDay(d, 1))}
            onToday={() => setWindowStart(today())}
            onOpenExport={() => setExportOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          {windowQ.data ? (
            <DayGrid
              days={days}
              data={windowQ.data}
              settings={settings}
              onSetOut={(day, outMinute) => out.mutate({ day, outMinute })}
              onCommit={(id, patch) => edit.mutate({ id, patch })}
              onDelete={(id) => del.mutate(id)}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-faint)]">
              {windowQ.isError ? "Failed to load — is the database running?" : "Loading…"}
            </div>
          )}
        </div>
      </div>

      {exportOpen && (
        <ExportDialog
          open
          defaultFrom={days[0]}
          defaultTo={days[1]}
          pending={exportSheets.isPending}
          onClose={() => setExportOpen(false)}
          onConfirm={(from, to) => exportSheets.mutate({ from, to })}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          open
          settings={settings}
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setSettingsOpen(false)}
          onSave={(s) => saveSettings.mutate(s)}
          onResync={() => {
            qc.invalidateQueries({ queryKey: ["cards"] });
            setSettingsOpen(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3.5 py-2 text-xs text-[var(--color-text)] shadow-lg shadow-black/40">
          {toast}
        </div>
      )}
    </DragProvider>
    </ThemeProvider>
  );
}
