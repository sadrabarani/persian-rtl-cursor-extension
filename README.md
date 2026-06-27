<p align="center">
  <img src="resources/icon.png" width="160" alt="RTL Chat Fixer logo" />
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#فارسی">فارسی</a>
</p>

---

<a id="english"></a>
## English

# Cursor/VSCode RTL Chat Fixer

A fully local extension for smart, automatic right-to-left alignment in the Cursor/VSCode chat panel.

### What this extension does

The Cursor chat panel is a regular Electron UI that can't be reached through the official extension API (which is limited to an extension's own Webview panels). The only way to inject CSS/JS into that panel is to add one `require` line to the main Electron process's `main.js` — the same approach used by well-known extensions like `vscode-custom-css`.

**What this extension never does:**
- No telemetry or data sent to any external server (unlike the project that inspired this one, which had a hardcoded Application Insights Instrumentation Key)
- No automatic update checks or network calls
- No change without explicit user confirmation and a clear, detailed dialog explaining exactly what will happen

### RTL detection logic (`rtl-fixer-inject.js`)

For every text block (paragraph, list item, table cell, etc.):

1. Persian/Arabic letters (Unicode range `\u0600-\u06FF` and related blocks) and Latin letters are counted.
2. If the ratio of Persian/Arabic letters is ≥ 30% of all meaningful letters and outnumbers Latin letters → the block becomes `rtl`.
3. `pre`, `code`, and Monaco editor content → always LTR, no exceptions.
4. Tables: the table structure (column order) stays LTR so data order isn't reversed, but each cell's text is independently right- or left-aligned based on its own content.
5. A `MutationObserver` also processes new/streamed messages live.

### Install and use

```bash
cd cursor-rtl-ext
npm install
npm run compile
```

Then press `F5` in VSCode to debug it, or run `npx vsce package` to build a `.vsix` and install it in Cursor.

Commands (Ctrl+Shift+P):
- **RTL Fixer: Enable RTL Chat**
- **RTL Fixer: Disable and Restore**
- **RTL Fixer: Show Status**
- **RTL Fixer: Reapply After Update**

### Important warning

- This approach is outside the official extension API and may conflict with Cursor's Terms of Service — use at your own risk.
- Every Cursor/VSCode update replaces `main.js`, so you'll need to click "Reapply" again afterward.
- A backup of `main.js` is always made automatically before patching (`main.js.rtl-fixer-backup-<timestamp>`) — to fully restore manually, you can copy this file back over `main.js`.

---

<a id="فارسی"></a>
## فارسی

# Cursor/VSCode RTL Chat Fixer

افزونه‌ای کاملاً محلی (local-only) برای راست‌چین‌کردن هوشمند و خودکار پنجره‌ی چت در Cursor/VSCode.

### این افزونه چه می‌کند

پنجره‌ی چت Cursor یک رابط Electron معمولی است که از مکانیزم رسمی افزونه (Webview API محدود به پنل‌های خودِ افزونه) قابل تزریق نیست. به همین دلیل، تنها راه تزریق CSS/JS به آن پنجره، اضافه‌کردن یک خط `require` به فایل `main.js` پروسه‌ی اصلی Electron است — دقیقاً همان روشی که افزونه‌های شناخته‌شده‌ای مثل `vscode-custom-css` هم استفاده می‌کنند.

**چیزی که این افزونه هرگز انجام نمی‌دهد:**
- هیچ تله‌متری یا ارسال داده به سرور خارجی (برخلاف نسخه‌ی اصلی که الهام گرفته شده، که یک Instrumentation Key ثابت برای Application Insights داشت)
- هیچ بررسی آپدیت خودکار یا تماس شبکه‌ای
- هیچ تغییری بدون تأیید صریح و نمایش جزئیات دقیق به کاربر (دیالوگ مودال با شرح کامل عملیات)

### منطق تشخیص RTL (`rtl-fixer-inject.js`)

برای هر بلوک متنی (پاراگراف، آیتم لیست، سلول جدول و...):

1. تعداد حروف فارسی/عربی (بازه‌ی یونیکد `\u0600-\u06FF` و مشابه) و حروف لاتین شمارش می‌شود.
2. اگر نسبت حروف فارسی/عربی ≥ ۳۰٪ کل حروف بامعنا باشد و از حروف لاتین بیشتر باشد → بلوک `rtl` می‌شود.
3. بلوک‌های `pre`, `code`, محیط موناکو ادیتور → همیشه LTR، بدون استثنا.
4. جدول‌ها: ساختار جدول (ترتیب ستون‌ها) LTR می‌ماند، اما متن داخل هر سلول به‌صورت مجزا بر اساس محتوایش راست‌چین یا چپ‌چین می‌شود.
5. `MutationObserver` پیام‌های جدید/استریم‌شده را هم به‌صورت زنده پردازش می‌کند.

### نصب و استفاده

```bash
cd cursor-rtl-ext
npm install
npm run compile
```

سپس با `F5` در VSCode دیباگ کنید یا با `npx vsce package` یک `.vsix` بسازید و در Cursor نصب کنید.

دستورات (Ctrl+Shift+P):
- **RTL Fixer: Enable RTL Chat**
- **RTL Fixer: Disable and Restore**
- **RTL Fixer: Show Status**
- **RTL Fixer: Reapply After Update**

### هشدار مهم

- این روش خارج از API رسمی افزونه‌هاست و ممکن است با شرایط استفاده‌ی Cursor در تضاد باشد — مسئولیت استفاده با شماست.
- با هر آپدیت Cursor/VSCode، `main.js` جایگزین می‌شود و باید دوباره «اعمال دوباره» را بزنید.
- همیشه قبل از فعال‌سازی یک بکاپ خودکار از `main.js` گرفته می‌شود (`main.js.rtl-fixer-backup-<timestamp>`) — برای بازگردانی کامل دستی هم می‌توانید این فایل را جای `main.js` کپی کنید.
