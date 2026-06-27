// rtl-fixer-inject.js
// Runs inside the renderer window (not the main process) and only operates
// on the chat panel's DOM: adds the rtl-fixer-rtl or rtl-fixer-ltr-forced
// class based on the actual content of each text block.
// No data ever leaves this window.

(function () {
  if (window.__rtlFixerInstalled) return;
  window.__rtlFixerInstalled = true;

  // Unicode ranges for Persian/Arabic letters
  const RTL_CHAR_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  // Latin letters (used to detect fully English text)
  const LATIN_CHAR_RE = /[A-Za-z]/g;

  const CODE_LIKE_SELECTOR = 'pre, code, kbd, samp, .monaco-editor, [class*="codeblock"], [class*="code-block"]';
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'SVG', 'PATH', 'CANVAS']);

  function countMatches(re, str) {
    const m = str.match(re);
    return m ? m.length : 0;
  }

  /**
   * Detects the direction of a text block based on the ratio of
   * Persian/Arabic letters to total meaningful letters.
   * Threshold: if at least 30% of letters are Persian/Arabic and they
   * outnumber Latin letters, the block is considered RTL.
   */
  function detectDirection(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const rtlCount = countMatches(RTL_CHAR_RE, trimmed);
    const latinCount = countMatches(LATIN_CHAR_RE, trimmed);
    const total = rtlCount + latinCount;

    if (total === 0) return null; // only digits/punctuation/whitespace — don't decide, inherit from parent

    const rtlRatio = rtlCount / total;

    if (rtlCount > 0 && rtlRatio >= 0.3 && rtlCount >= latinCount) {
      return 'rtl';
    }
    if (latinCount > 0 && rtlCount === 0) {
      return 'ltr';
    }
    // Mixed/near-tie case: decide by whichever letter set dominates
    return rtlCount > latinCount ? 'rtl' : 'ltr';
  }

  function isInsideCodeContext(el) {
    return !!el.closest(CODE_LIKE_SELECTOR);
  }

  function isTableCell(el) {
    return el.tagName === 'TD' || el.tagName === 'TH';
  }

  const INLINE_CODE_TAGS = new Set(['CODE', 'KBD', 'SAMP']);

  function isInlineCodeElement(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (INLINE_CODE_TAGS.has(node.tagName)) return true;
    const cls = node.className || '';
    return typeof cls === 'string' && /inline-code|codeblock|code-block/.test(cls);
  }

  function getDirectText(el) {
    // Only this element's direct text, not nested block children
    // (keeps decisions for nested blocks independent).
    // Text inside inline code/kbd/samp is excluded on purpose: a code term
    // or English identifier sitting inside an otherwise Persian sentence
    // should not be allowed to flip that sentence's detected direction.
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE && isInlineCodeElement(node)) {
        continue; // excluded from direction detection, still rendered untouched visually
      } else if (node.nodeType === Node.ELEMENT_NODE && !isBlockElement(node)) {
        // Other inline elements (span, b, i, a, strong) still count
        text += node.textContent;
      }
    }
    return text;
  }

  const BLOCK_TAGS = new Set([
    'DIV', 'P', 'LI', 'UL', 'OL', 'TABLE', 'TR', 'TD', 'TH',
    'SECTION', 'ARTICLE', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  ]);

  function isBlockElement(node) {
    return node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(node.tagName);
  }

  function clearPreviousClasses(el) {
    el.classList.remove('rtl-fixer-rtl', 'rtl-fixer-ltr-forced', 'rtl-fixer-cell-rtl');
  }

  function processTable(table) {
    // Table structure always stays LTR so column order isn't reversed
    table.classList.add('rtl-fixer-table-ltr-structure');
    const cells = table.querySelectorAll('td, th');
    cells.forEach((cell) => {
      if (SKIP_TAGS.has(cell.tagName)) return;
      const text = getDirectText(cell) || cell.textContent || '';
      const dir = detectDirection(text);
      clearPreviousClasses(cell);
      if (dir === 'rtl') {
        cell.classList.add('rtl-fixer-cell-rtl');
      }
    });
  }

  function processBlock(el) {
    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.tagName === 'TABLE') {
      processTable(el);
      return;
    }
    if (isTableCell(el)) {
      // Cells are handled by processTable
      return;
    }
    if (isInsideCodeContext(el)) {
      clearPreviousClasses(el);
      el.classList.add('rtl-fixer-ltr-forced');
      return;
    }

    const text = getDirectText(el);
    const dir = detectDirection(text);
    clearPreviousClasses(el);

    if (dir === 'rtl') {
      el.classList.add('rtl-fixer-rtl');
    } else if (dir === 'ltr') {
      // If the parent is RTL but this block is fully English, force it LTR explicitly
      el.classList.add('rtl-fixer-ltr-forced');
    }
    // dir === null means direction-neutral content (digits/punctuation only) —
    // leave untouched, inherit from parent
  }

  // Likely chat message roots — kept generic on purpose so it keeps working
  // as much as possible across Cursor/VSCode internal class name changes.
  const MESSAGE_ROOT_SELECTOR =
    '[class*="message"], [class*="chat-"], [class*="markdown"], [role="article"]';

  function findTextBlocks(root) {
    const selector = 'p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, div';
    const blocks = [];
    root.querySelectorAll(selector).forEach((el) => {
      // Only process "leaf-like" blocks that have no block-level children
      // (avoids re-processing wrapper divs with no direct text of their own)
      const hasBlockChild = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName));
      if (el.tagName === 'TABLE' || isTableCell(el) || !hasBlockChild) {
        blocks.push(el);
      }
    });
    // Add tables separately too
    root.querySelectorAll('table').forEach((t) => blocks.push(t));
    return blocks;
  }

  let pending = false;
  function scheduleProcess(root) {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try {
        const blocks = findTextBlocks(root || document.body);
        blocks.forEach(processBlock);
      } catch (e) {
        console.error('[RTL Fixer] processing error:', e);
      }
    });
  }

  // Initial pass
  scheduleProcess(document.body);

  // Watch for changes to catch new/streamed messages
  const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0 || m.type === 'characterData') {
        shouldProcess = true;
        break;
      }
    }
    if (shouldProcess) scheduleProcess(document.body);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  console.log('[RTL Fixer] enabled — smart Persian/Arabic vs. code/English detection');
})();
