// rtl-fixer-loader.cjs
// This file does exactly one thing: once the main app window is created,
// it injects the CSS and JS responsible for RTL detection.
// No data is collected or transmitted.

const path = require('path');
const fs = require('fs');

try {
  const { app, BrowserWindow } = require('electron');

  const STYLE_PATH = path.join(__dirname, 'rtl-fixer-style.css');
  const SCRIPT_PATH = path.join(__dirname, 'rtl-fixer-inject.js');

  function injectInto(win) {
    if (!win || win.isDestroyed()) return;
    win.webContents.on('did-finish-load', () => {
      try {
        const css = fs.readFileSync(STYLE_PATH, 'utf-8');
        win.webContents.insertCSS(css);
      } catch (e) {
        console.error('[RTL Fixer] insertCSS failed:', e);
      }
      try {
        const js = fs.readFileSync(SCRIPT_PATH, 'utf-8');
        win.webContents.executeJavaScript(js).catch((e) => {
          console.error('[RTL Fixer] executeJavaScript failed:', e);
        });
      } catch (e) {
        console.error('[RTL Fixer] read script failed:', e);
      }
    });
  }

  app.on('browser-window-created', (_event, win) => {
    injectInto(win);
  });

  // Windows that may already be open
  for (const win of BrowserWindow.getAllWindows()) {
    injectInto(win);
  }
} catch (e) {
  console.error('[RTL Fixer] loader init failed:', e);
}
