// uninstall.ts — intended to run automatically when the extension is uninstalled
// (wire up via an "uninstallHook" in package.json if needed).
// In the current simple setup, the user should click "Disable" before uninstalling
// to fully restore main.js. This file is just a best-effort fallback.

import * as fs from 'fs';
import * as path from 'path';
import { PATCH_MARKER, BACKUP_PREFIX } from './constants';

function findLatestBackup(dir: string): string | null {
  try {
    const files = fs.readdirSync(dir);
    const backups = files.filter((f) => f.startsWith(BACKUP_PREFIX)).sort().reverse();
    return backups.length > 0 ? path.join(dir, backups[0]) : null;
  } catch {
    return null;
  }
}

export function bestEffortRestore(mainJsPath: string): void {
  try {
    const content = fs.readFileSync(mainJsPath, 'utf-8');
    if (!content.includes(PATCH_MARKER)) return;

    const dir = path.dirname(mainJsPath);
    const backupPath = findLatestBackup(dir);
    if (backupPath) {
      fs.copyFileSync(backupPath, mainJsPath);
    }
  } catch {
    // best-effort — uninstall should not crash
  }
}
