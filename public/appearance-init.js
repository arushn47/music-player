// Blocking same-origin startup script also works under Tauri's production CSP.
(() => {
  let mode = "dark";
  try {
    const saved = JSON.parse(
      localStorage.getItem("lumaire:appearance:v1") || "null",
    );
    if (saved?.themeMode === "light") mode = "light";
  } catch {}
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
})();
