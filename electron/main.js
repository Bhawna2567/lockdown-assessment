// ClassCurio desktop wrapper — distributable build for students.
//
// This Electron main file connects to the production ClassCurio server
// (your Render URL) instead of starting an embedded one. When students
// download and open this app, they get the full ClassCurio website
// inside a locked-down window: kiosk mode + setContentProtection during
// exams (so screenshots come out black on macOS), with global keyboard
// shortcuts blocked.
//
// To build for distribution:
//   npm install
//   npm run build:mac       (produces dist/*.dmg)
//   npm run build:win       (produces dist/*.exe — best run on Windows)
//
// To change the server URL (e.g., if you redeploy under a different name),
// edit APP_URL below and rebuild.

const { app, BrowserWindow, globalShortcut, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const vmDetect = require('./vm-detect');

// === EDIT ME if your Render URL changes ===
const APP_URL = 'https://lockdown-asessment.onrender.com';

let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

function createWindow() {
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

  // Defensive reset on launch — clears any stuck kiosk/fullscreen state
  // from a previous crash so the student can always close the window
  // before they start an exam.
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

  // Block "open in new window" attempts.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Block right-click menu at the OS level.
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());

  // Block navigation to anywhere outside the ClassCurio domain.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL)) e.preventDefault();
  });

  // Application menu — keep Quit available so the user can always exit
  // the desktop app between exams.
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
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
    { label: 'File', submenu: [isMac ? { role: 'close' } : { role: 'quit' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'reload' }] },
  ]));

  mainWindow.loadURL(APP_URL).catch((e) => {
    dialog.showErrorBox(
      'ClassCurio: cannot reach server',
      `Could not load ${APP_URL}.\n\n` +
      `Check your internet connection and try opening the app again.\n\n` +
      `Error: ${e.message}`
    );
  });
}

function registerGlobalShortcutBlocks() {
  // OS-level shortcut combinations to block during a kiosked exam.
  const shortcutsToBlock = [
    'CommandOrControl+C', 'CommandOrControl+V', 'CommandOrControl+X',
    'CommandOrControl+P', 'CommandOrControl+S', 'CommandOrControl+F',
    'CommandOrControl+U', 'CommandOrControl+R', 'CommandOrControl+N',
    'CommandOrControl+T', 'CommandOrControl+W', 'CommandOrControl+Q',
    'CommandOrControl+Shift+I', 'CommandOrControl+Shift+J', 'CommandOrControl+Shift+C',
    'F5', 'F11', 'F12',
    'Alt+F4', 'Alt+Tab',
    'PrintScreen',
    'CommandOrControl+Shift+3', 'CommandOrControl+Shift+4', 'CommandOrControl+Shift+5',
  ];
  for (const s of shortcutsToBlock) {
    try { globalShortcut.register(s, () => { /* swallow */ }); } catch {}
  }
}

function unregisterGlobalShortcutBlocks() {
  try { globalShortcut.unregisterAll(); } catch {}
}

ipcMain.handle('env:detect-vm', async () => {
  try {
    return vmDetect.detect();
  } catch (e) {
    return { isVm: false, confidence: 0, reasons: [`detection error: ${e.message}`], signals: {} };
  }
});

// Student page calls these on Start / Submit of each exam.
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
    mainWindow.setContentProtection(true); // Screenshots come out black on macOS.
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

app.whenReady().then(createWindow);

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('will-quit', () => {
  unregisterGlobalShortcutBlocks();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
