import * as vscode from 'vscode';
import * as fs from 'fs';
import { validatePaths, getMainJsPath, getAppOutDir } from './paths';
import {
  isPatched,
  hasBackups,
  applyPatch,
  removePatch,
  copyLoaderFiles,
  getDryRunSummary,
  handlePermissionError,
} from './patcher';

let statusBarItem: vscode.StatusBarItem;

type PatchState = 'on' | 'off' | 'update-needed';

function getPatchState(mainJsPath: string): PatchState {
  if (!fs.existsSync(mainJsPath)) return 'off';
  if (isPatched(mainJsPath)) return 'on';
  if (hasBackups(mainJsPath)) return 'update-needed';
  return 'off';
}

function updateStatusBar(state: PatchState): void {
  const config = vscode.workspace.getConfiguration('rtlFixer');
  if (!config.get<boolean>('showStatusBar', true)) {
    statusBarItem.hide();
    return;
  }

  switch (state) {
    case 'on':
      statusBarItem.text = '$(check) RTL: ON';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.tooltip = 'RTL detection is active. Click for options.';
      break;
    case 'off':
      statusBarItem.text = '$(circle-slash) RTL: OFF';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      statusBarItem.tooltip = 'RTL detection is not enabled. Click to enable.';
      break;
    case 'update-needed':
      statusBarItem.text = '$(warning) RTL: UPDATE NEEDED';
      statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      statusBarItem.tooltip = 'The app was updated and the patch needs to be reapplied. Click to reapply.';
      break;
  }
  statusBarItem.command = 'rtlFixer.quickPick';
  statusBarItem.show();
}

async function showQuickPick(): Promise<void> {
  const mainJsPath = getMainJsPath();
  const state = getPatchState(mainJsPath);

  const items: vscode.QuickPickItem[] = [];
  if (state === 'on') {
    items.push({ label: '$(circle-slash) Disable', description: 'Fully restore the original main.js' });
  } else {
    items.push({ label: '$(check) Enable', description: 'Apply the RTL patch' });
  }
  if (state === 'update-needed') {
    items.unshift({ label: '$(refresh) Reapply', description: 'After a Cursor/VSCode update' });
  }
  items.push({ label: '$(info) Status', description: 'Show current status' });

  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'RTL Chat Fixer' });
  if (!picked) return;

  if (picked.label.includes('Enable') && !picked.label.includes('Disable')) {
    await vscode.commands.executeCommand('rtlFixer.enable');
  } else if (picked.label.includes('Disable')) {
    await vscode.commands.executeCommand('rtlFixer.disable');
  } else if (picked.label.includes('Reapply')) {
    await vscode.commands.executeCommand('rtlFixer.reapply');
  } else if (picked.label.includes('Status')) {
    await vscode.commands.executeCommand('rtlFixer.status');
  }
}

async function enableCommand(context: vscode.ExtensionContext): Promise<void> {
  const validation = validatePaths();
  if (!validation.valid) {
    vscode.window.showErrorMessage(`RTL Fixer: ${validation.error}`);
    return;
  }

  const mainJsPath = validation.mainJsPath;
  const outDir = getAppOutDir();
  const dryRun = getDryRunSummary(mainJsPath);
  const detail = dryRun.map((a) => `• ${a}`).join('\n');

  const confirm = await vscode.window.showWarningMessage(
    'This extension modifies the application\'s main.js file so it can inject the CSS/JS needed to right-align the chat panel.\n\n' +
      'This is outside the official extension API and may be undone by every app update (you will need to "Reapply"). A full backup of the original file is made before any change, so you can restore it at any time.\n\n' +
      'No data is collected, stored, or sent anywhere — this extension is entirely local.\n\n' +
      'Continue?',
    { modal: true, detail },
    'Yes, enable it'
  );

  if (confirm !== 'Yes, enable it') return;

  try {
    copyLoaderFiles(outDir, context.extensionPath);
    applyPatch(mainJsPath);
    updateStatusBar('on');

    const restart = await vscode.window.showInformationMessage(
      'Patch applied successfully! Close and reopen all Cursor/VSCode windows to activate it.',
      'Quit App',
      'Later'
    );
    if (restart === 'Quit App') {
      await vscode.commands.executeCommand('workbench.action.quit');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`RTL Fixer: ${handlePermissionError(err)}`);
  }
}

async function disableCommand(): Promise<void> {
  const validation = validatePaths();
  if (!validation.valid) {
    vscode.window.showErrorMessage(`RTL Fixer: ${validation.error}`);
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    'Disable RTL? This will restore the original main.js from backup.',
    { modal: true },
    'Yes, disable it'
  );
  if (confirm !== 'Yes, disable it') return;

  try {
    removePatch(validation.mainJsPath);
    updateStatusBar('off');

    const restart = await vscode.window.showInformationMessage(
      'Patch removed. Close and reopen the app to apply the change.',
      'Quit App',
      'Later'
    );
    if (restart === 'Quit App') {
      await vscode.commands.executeCommand('workbench.action.quit');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`RTL Fixer: ${handlePermissionError(err)}`);
  }
}

async function reapplyCommand(context: vscode.ExtensionContext): Promise<void> {
  const validation = validatePaths();
  if (!validation.valid) {
    vscode.window.showErrorMessage(`RTL Fixer: ${validation.error}`);
    return;
  }
  try {
    copyLoaderFiles(getAppOutDir(), context.extensionPath);
    applyPatch(validation.mainJsPath);
    updateStatusBar('on');
    const restart = await vscode.window.showInformationMessage(
      'Patch reapplied. Close and reopen the app.',
      'Quit App',
      'Later'
    );
    if (restart === 'Quit App') {
      await vscode.commands.executeCommand('workbench.action.quit');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`RTL Fixer: ${handlePermissionError(err)}`);
  }
}

async function statusCommand(): Promise<void> {
  const validation = validatePaths();
  if (!validation.valid) {
    vscode.window.showErrorMessage(`RTL Fixer: ${validation.error}`);
    return;
  }
  const state = getPatchState(validation.mainJsPath);
  if (state === 'on') {
    vscode.window.showInformationMessage('RTL Fixer: Patch is active.');
  } else if (state === 'off') {
    vscode.window.showInformationMessage('RTL Fixer: Disabled. Use "RTL Fixer: Enable RTL Chat" to activate.');
  } else {
    const choice = await vscode.window.showWarningMessage(
      'RTL Fixer: The app was updated and the patch was removed. Reapply now?',
      'Reapply'
    );
    if (choice === 'Reapply') {
      await vscode.commands.executeCommand('rtlFixer.reapply');
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(vscode.commands.registerCommand('rtlFixer.quickPick', showQuickPick));
  context.subscriptions.push(
    vscode.commands.registerCommand('rtlFixer.enable', () => enableCommand(context))
  );
  context.subscriptions.push(vscode.commands.registerCommand('rtlFixer.disable', disableCommand));
  context.subscriptions.push(vscode.commands.registerCommand('rtlFixer.status', statusCommand));
  context.subscriptions.push(
    vscode.commands.registerCommand('rtlFixer.reapply', () => reapplyCommand(context))
  );

  const mainJsPath = getMainJsPath();
  updateStatusBar(getPatchState(mainJsPath));

  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('rtlFixer.showStatusBar')) {
      updateStatusBar(getPatchState(mainJsPath));
    }
  }, null, context.subscriptions);
}

export function deactivate(): void {
  // Nothing to do — the patch stays on disk until the user explicitly disables it
}
