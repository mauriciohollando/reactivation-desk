# Reactivation Desk

Rowan Round 3 prototype: export-native reactivation for independent advisors.

**Live:** https://reactivation-desk.vercel.app  
**Repo:** https://github.com/mauriciohollando/reactivation-desk  
**Memo:** https://reactivation-desk.vercel.app/memo  
**Sample CSV:** https://reactivation-desk.vercel.app/demo-advisor-book.csv  
**Public-figures test CSV (AI verify):** https://reactivation-desk.vercel.app/public-figures-test-book.csv

## What it does

Turn a messy prospect export into a finishable weekly call list:

1. **Unlock** — one-time sprint or unlimited subscription (promo codes skip payment in the prototype)
2. **Import** — sample book or CSV, with a controlled tag vocabulary AI must respect
3. **Ready** — see callable / careful / off-limits; optionally improve reasons & tags with AI
4. **This week** — short capacity-aware list with cited “call because” lines
5. **Call** — one card at a time; paste human or AI-notetaker notes to update the file
6. **Wrap** — export durable week outcomes

## Monetization (prototype)

| Plan | Price | Access |
|---|---:|---|
| Sprint | $499 | One book / one focused week |
| Unlimited | $99/mo | Import as often as you want |
| Promo | — | `DEMO` / `ROWAN` → sprint · `UNLIMITED` / `ADVISOR` → subscription |

Checkout is simulated in-browser for the assignment demo.

## Differentiator

Rules own safety · AI cites the file · tags stay under advisor control · notes compound over time · no CRM hostage · no auto-send

## Public-figures test book

`public/public-figures-test-book.csv` (~500 rows) uses **real, publicly known** executives at real companies for testing AI person/company verification. Phones and emails are synthetic. Regenerated with:

```bash
npm run generate:public-figures-csv
```

Do not contact anyone in that file.

## Develop

```bash
npm install
npm run dev
```

Set `OPENAI_API_KEY` for AI import enrichment and note updates. Override model with `OPENAI_ANALYSIS_MODEL` (default `gpt-4.1-mini`).
