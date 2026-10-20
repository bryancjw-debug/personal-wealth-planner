(() => {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const script = document.currentScript;
  const base = new URL("./", script.src);
  let pendingPrompt = null;
  let registration;
  const tools = document.createElement("div");
  tools.className = "pwa-tools";
  const install = document.createElement("button");
  install.type = "button";
  install.textContent = "Install app";
  install.title = "Install on this device";
  const offline = document.createElement("span");
  offline.setAttribute("role", "status");
  const update = document.createElement("button");
  update.type = "button";
  update.textContent = "Update available";
  update.hidden = true;
  tools.append(offline, update, install);
  document.body.append(tools);
  const dialog = document.createElement("dialog");
  dialog.className = "pwa-dialog";
  dialog.setAttribute("aria-label", "Install this app");
  dialog.innerHTML = '<h2>Install on your device</h2><p>On iPhone or iPad, open the browser Share menu and choose Add to Home Screen, then Open as Web App if offered.</p><p>On Android or Windows, open the browser menu and choose Install app or Add to Home screen. Availability depends on your browser.</p><p>Offline calculations use the last downloaded app version. Reconnect for the latest assumptions. Installing does not back up your financial entries.</p><button type="button">Close</button>';
  dialog.querySelector("button").onclick = () => dialog.close();
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  install.onclick = async () => {
    if (!pendingPrompt) { dialog.showModal(); return; }
    await pendingPrompt.prompt();
    await pendingPrompt.userChoice;
    pendingPrompt = null;
  };
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); pendingPrompt = event; });
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  function status() {
    offline.textContent = navigator.onLine ? "" : "Offline - saved app version";
    install.hidden = true; // Retired prototype: keep update support, not new installations.
  }
  window.addEventListener("online", status);
  window.addEventListener("offline", status);
  window.addEventListener("appinstalled", status);
  status();
  update.onclick = () => {
    if (registration?.waiting && confirm("Reload to update? Finish or save your entries first. Unsaved changes may be lost.")) {
      navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };
  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register(new URL("sw.js", base), { scope: base.pathname, updateViaCache: "none" });
      update.hidden = !registration.waiting;
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) update.hidden = false; });
      });
    } catch (error) { console.warn("Offline installation is unavailable.", error); }
  };
  if (document.readyState === "complete") void register();
  else window.addEventListener("load", register, { once: true });
})();
