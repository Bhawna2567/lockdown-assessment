// Preload runs in an isolated world before the page loads.
// Exposes a minimal `window.lockdown` bridge the page can use to query
// the Electron main process for environment info (VM detection, etc).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lockdown', {
  isElectron: true,
  // Returns a detection report: { isVm, confidence, reasons, signals, ... }
  detectVm: () => ipcRenderer.invoke('env:detect-vm'),
  // Enter / exit kiosk mode. Called by the student page on Start / Submit.
  enterKiosk: () => ipcRenderer.send('kiosk:enter'),
  exitKiosk:  () => ipcRenderer.send('kiosk:exit'),
  // Belt-and-braces: called by the login/logout pages to make sure the
  // window is always closable and not stuck in kiosk state.
  forceUnlock: () => ipcRenderer.send('kiosk:force-unlock'),
});
