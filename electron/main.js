// Electron main process — provides the "real" lockdown layer.
// It launches the embedded Express server, opens a kiosk window, blocks
// global shortcuts, and enables OS-level screenshot protection.
const { app, BrowserWindow, globalShortcut, ipcMain, session, Menu, dialog } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const vmDetect = require('./vm-detect');

let mainWindow = null;
let serverProcess = null;
const SERVER_URL = 'http://localhost:3000';

// Single-instance lock — prevents students from launching multiple windows.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

function startEmbeddedServer() {
  const serverPath = path.join(__dirname, '..', 'server', 'server.js');
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, PORT: '3000' },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  });
  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
  serverProcess.on('exit', (code) => {
    console.log('[server] exited with code', code);
  });
}

function stopEmbeddedServer() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Server did not start in time');
}

function createWindow() {
  // Start in a NORMAL window. Teachers stay in this mode the whole time;
  // students drop into kiosk mode only between Start and Submit.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      spellcheck: false,
    },
  });

  // Defensive reset: if a previous run crashed mid-exam, kiosk-related window
  // flags can leak across launches. Force the window into a known unlocked
  // state on every startup so the teacher can always close it.
  try {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setClosable(true);
    mainWindow.setMovable(true);
    mainWindow.setMinimizable(true);
    mainWindow.setMaximizable(true);
    mainWindow.setContentProtection(false);
  } catch {}
  unregisterGlobalShortcutBlocks();

  // Block new windows (ctrl+click, window.open, etc.) — applies always.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Block navigations to non-local URLs.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(SERVER_URL)) {
      e.preventDefault();
    }
  });

  // Suppress right-click menu at the OS layer too.
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Provide a minimal application menu so Quit / Close / Reload always work
  // for the teacher, even when no-one's taking an exam. (Removing the menu
  // entirely was the source of the "I can't close the app" bug — on macOS
  // the only way out was to force-restart.)
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    // Edit menu is REQUIRED on macOS — without it, Cmd+C / Cmd+V / Cmd+X
    // / Cmd+Z silently fail to work inside the app. Mac binds those
    // keyboard shortcuts to menu items, not the keyboard directly.
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'reload' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : []),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // If the OS tries to close the window during an active exam, refuse it
  // unless the student has already submitted. (The student page sets
  // closable:false during kiosk mode, so this is a backup.)
  mainWindow.on('close', () => {
    // No-op: closable flag is the source of truth.
  });

  mainWindow.loadURL(SERVER_URL);
}

function registerGlobalShortcutBlocks() {
  // Block OS-level shortcut combinations while the app is focused.
  // (Electron registers these globally — we unregister on blur so
  // teachers/students can still use their computer between assessments.)
  const shortcutsToBlock = [
    'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
    'CommandOrControl+P', 'CommandOrControl+S', 'CommandOrControl+F',
    'CommandOrControl+U', 'CommandOrControl+R', 'CommandOrControl+N',
    'CommandOrControl+T', 'CommandOrControl+W', 'CommandOrControl+Q',
    'CommandOrControl+Shift+I', 'CommandOrControl+Shift+J', 'CommandOrControl+Shift+C',
    'F5', 'F11', 'F12',
    'Alt+F4', 'Alt+Tab',
    'PrintScreen',
    'CommandOrControl+Shift+3', 'CommandOrControl+Shift+4', 'CommandOrControl+Shift+5', // macOS screenshot
  ];
  for (const s of shortcutsToBlock) {
    try { globalShortcut.register(s, () => { /* swallow */ }); } catch {}
  }
}

function unregisterGlobalShortcutBlocks() {
  try { globalShortcut.unregisterAll(); } catch {}
}

// IPC: renderer asks for a fresh VM detection report.
ipcMain.handle('env:detect-vm', async () => {
  try {
    return vmDetect.detect();
  } catch (e) {
    return { isVm: false, confidence: 0, reasons: [`detection error: ${e.message}`], signals: {} };
  }
});

// IPC: student page asks to enter / exit kiosk mode for the duration of an exam.
ipcMain.on('kiosk:enter', () => {
  if (!mainWindow) return;
  try {
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setClosable(false);
    mainWindow.setMovable(false);
    mainWindow.setMinimizable(false);
    mainWindow.setMaximizable(false);
    mainWindow.setContentProtection(true);
    registerGlobalShortcutBlocks();
  } catch (e) { console.error('kiosk:enter failed', e); }
});

ipcMain.on('kiosk:exit', () => {
  if (!mainWindow) return;
  try {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setClosable(true);
    mainWindow.setMovable(true);
    mainWindow.setMinimizable(true);
    mainWindow.setMaximizable(true);
    mainWindow.setContentProtection(false);
    unregisterGlobalShortcutBlocks();
  } catch (e) { console.error('kiosk:exit failed', e); }
});

// Belt-and-braces: explicit "unlock everything right now" call. The login /
// logout pages call this on load so a stuck-locked window can recover even
// if the original kiosk:exit was missed (e.g., student force-killed the tab).
ipcMain.on('kiosk:force-unlock', () => {
  if (!mainWindow) return;
  try {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setClosable(true);
    mainWindow.setMovable(true);
    mainWindow.setMinimizable(true);
    mainWindow.setMaximizable(true);
    mainWindow.setContentProtection(false);
    unregisterGlobalShortcutBlocks();
  } catch (e) { console.error('kiosk:force-unlock failed', e); }
});

app.whenReady().then(async () => {
  startEmbeddedServer();
  try {
    await waitForServer(SERVER_URL);
  } catch (e) {
    dialog.showErrorBox('Server failed to start', String(e));
    app.quit();
    return;
  }
  createWindow();
  // Note: global shortcuts are only registered while a student is taking an
  // exam (see ipcMain.on('kiosk:enter') above). When the app is just being
  // used by a teacher, all OS shortcuts work normally.

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcutBlocks();
  stopEmbeddedServer();
});

app.on('window-all-closed', () => {
  stopEmbeddedServer();
  if (process.platform !== 'darwin') app.quit();
});
