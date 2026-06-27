import * as fs from 'fs';
import * as path from 'path';
import { PATCH_LINE, PATCH_MARKER, BACKUP_PREFIX, LOADER_FILENAME } from './constants';

export function isPatched(mainJsPath: string): boolean {
  try {
    const content = fs.readFileSync(mainJsPath, 'utf-8');
    return content.includes(PATCH_MARKER);
  } catch {
    return false;
  }
}

function formatTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    'T' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

export function backup(mainJsPath: string): string {
  const dir = path.dirname(mainJsPath);
  const backupPath = path.join(dir, BACKUP_PREFIX + formatTimestamp());
  fs.copyFileSync(mainJsPath, backupPath);
  return backupPath;
}

function findLatestBackup(mainJsDir: string): string | null {
  try {
    const files = fs.readdirSync(mainJsDir);
    const backups = files.filter((f) => f.startsWith(BACKUP_PREFIX)).sort().reverse();
    return backups.length > 0 ? path.join(mainJsDir, backups[0]) : null;
  } catch {
    return null;
  }
}

export function hasBackups(mainJsPath: string): boolean {
  return findLatestBackup(path.dirname(mainJsPath)) !== null;
}

/**
 * The only thing this patch does: add one require line to a loader file,
 * which injects RTL-only CSS/JS into the chat webview.
 * No telemetry, no data transmission, no other changes.
 */
export function applyPatch(mainJsPath: string): void {
  const content = fs.readFileSync(mainJsPath, 'utf-8');

  if (!content.includes('Copyright (C) Microsoft Corporation')) {
    throw new Error(
      'main.js does not contain the expected Microsoft copyright signature. This may be an unsupported version or a corrupted file.'
    );
  }

  if (content.includes(PATCH_MARKER)) {
    return; // already applied
  }

  const backupPath = backup(mainJsPath);

  try {
    const copyrightEnd = content.indexOf('*/');
    if (copyrightEnd === -1) {
      throw new Error('Could not find the end of the copyright comment in main.js.');
    }
    const insertPos = copyrightEnd + 2;
    const patched =
      content.substring(0, insertPos) + '\n' + PATCH_LINE + content.substring(insertPos);
    fs.writeFileSync(mainJsPath, patched, 'utf-8');
  } catch (err) {
    try {
      fs.copyFileSync(backupPath, mainJsPath);
    } catch (rollbackErr) {
      throw new Error(
        `Patch failed and rollback also failed. Backup is at: ${backupPath}. Original error: ${err}. Rollback error: ${rollbackErr}`
      );
    }
    throw err;
  }
}

export function removePatch(mainJsPath: string): void {
  const dir = path.dirname(mainJsPath);
  const latestBackup = findLatestBackup(dir);

  if (latestBackup) {
    fs.copyFileSync(latestBackup, mainJsPath);
  } else {
    const content = fs.readFileSync(mainJsPath, 'utf-8');
    if (!content.includes(PATCH_MARKER)) {
      return;
    }
    const lines = content.split('\n').filter((line) => !line.includes(PATCH_MARKER));
    fs.writeFileSync(mainJsPath, lines.join('\n'), 'utf-8');
  }

  removeLoaderFiles(dir);
}

export function copyLoaderFiles(outDir: string, extensionPath: string): void {
  const files = ['rtl-fixer-loader.cjs', 'rtl-fixer-inject.js', 'rtl-fixer-style.css'];
  for (const f of files) {
    const src = path.join(extensionPath, 'resources', f);
    const dest = path.join(outDir, f);
    fs.copyFileSync(src, dest);
  }
}

export function removeLoaderFiles(outDir: string): void {
  const files = ['rtl-fixer-loader.cjs', 'rtl-fixer-inject.js', 'rtl-fixer-style.css'];
  for (const f of files) {
    try {
      const p = path.join(outDir, f);
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch {
      // best-effort
    }
  }
}

export function getDryRunSummary(mainJsPath: string): string[] {
  const actions: string[] = [];
  if (isPatched(mainJsPath)) {
    actions.push('Patch is already applied.');
  } else {
    actions.push(`A backup of main.js will be created → ${BACKUP_PREFIX}<timestamp>`);
    actions.push('One require line will be added to the start of main.js (after the copyright comment)');
  }
  actions.push(`${LOADER_FILENAME}, rtl-fixer-inject.js, and rtl-fixer-style.css will be copied into the out folder`);
  actions.push('No telemetry, network requests, or data collection of any kind');
  actions.push('Must be reapplied after every Cursor/VSCode update (use the Reapply button)');
  return actions;
}

export function handlePermissionError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EPERM' || code === 'EACCES') {
    if (process.platform === 'win32') {
      return 'Permission denied. Try running Cursor/VSCode as Administrator.';
    } else if (process.platform === 'darwin') {
      return 'Permission denied. Try running: sudo chown -R $USER "/Applications/Cursor.app/Contents/Resources/app/out/"';
    } else {
      return 'Permission denied. Try running with sudo or fixing file permissions.';
    }
  }
  return `Unexpected error: ${err}`;
}
