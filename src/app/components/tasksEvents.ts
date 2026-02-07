"use client";

const EVT = "ssepa:tasks:changed";

export function emitTasksChanged() {
  try {
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}

  // também dispara via storage para garantir propagação (inclusive em outros tabs/webviews)
  try {
    window.localStorage.setItem("ssepa.tasks.bump", String(Date.now()));
  } catch {}
}

export function onTasksChanged(handler: () => void) {
  function h() {
    handler();
  }

  function onStorage(e: StorageEvent) {
    if (e.key === "ssepa.tasks.bump") handler();
  }

  window.addEventListener(EVT, h as any);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(EVT, h as any);
    window.removeEventListener("storage", onStorage);
  };
}
