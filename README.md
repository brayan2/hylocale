# Hygraph Localisation Checker

Find missing translations across your Hygraph project **before they hit production**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/brayan2/hygraph-localisation-checker)

---

## What it does

Connect your Hygraph project and get an instant visual matrix showing translation coverage across every model and locale — with one-click drill-down to see exactly which entries are missing translations.

- **Overview matrix** — models × locales with % completion, colour coded
- **Drill-down** — see every untranslated entry with a direct link to Hygraph Studio
- **CSV export** — download missing entries to assign to your content team
- **Dark/light mode** — respects your system preference
- **100% read-only** — credentials never leave your browser session

---

## Getting started

### Option 1 — Deploy to Vercel (recommended)

Click the button above. No environment variables needed.

### Option 2 — Run locally

```bash
git clone https://github.com/brayan2/hygraph-localisation-checker
cd hygraph-localisation-checker
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to connect

1. Go to your Hygraph project → **Settings → API Access**
2. Copy your **Content API endpoint**
3. Create a **Permanent Auth Token** with `READ` permission (no write access needed)
4. Paste both into the connect form

---

## Privacy & security

- Credentials stored only in `sessionStorage` — cleared when you close the tab
- All API calls go directly from your browser to Hygraph — no server intermediary
- This tool makes only read requests

---

## Stack

- [Next.js](https://nextjs.org) App Router
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Lucide](https://lucide.dev) icons
- [next-themes](https://github.com/pacocoursey/next-themes)

---

Built with ❤️ by [Hygraph](https://hygraph.com)
