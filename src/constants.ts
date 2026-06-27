// All constants are transparent and grep-able.
// The patch marker is clearly identifiable inside main.js so anyone can see what changed.

export const PATCH_MARKER = 'rtl-fixer-loader.cjs';
export const LOADER_FILENAME = 'rtl-fixer-loader.cjs';
export const STYLE_FILENAME = 'rtl-fixer-style.css';
export const SCRIPT_FILENAME = 'rtl-fixer-inject.js';

export const PATCH_LINE =
  'import{createRequire}from"module";try{createRequire(import.meta.url)("./rtl-fixer-loader.cjs")}catch(e){console.error("[RTL Fixer] error loading ./rtl-fixer-loader.cjs: ", e)}';

export const BACKUP_PREFIX = 'main.js.rtl-fixer-backup-';
