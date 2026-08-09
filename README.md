# Reactivation Desk

Rowan Round 3 prototype: export-native reactivation for independent advisors.

**Live:** https://reactivation-desk.vercel.app  
**Repo:** https://github.com/mauriciohollando/reactivation-desk  
**Memo:** https://reactivation-desk.vercel.app/memo  
**Sample CSV:** https://reactivation-desk.vercel.app/demo-advisor-book.csv

Meeting import demo: generate a local CRM export with `npm run generate:meeting-csv`, then use **Upload CSV** (do not serve it from the site).

## Guided funnel

1. **Import** — sample book or CSV  
2. **Diagnosis** — callable / careful / off-limits + portfolio patterns  
3. **Deep analysis (opt-in)** — structured facts, timeline, contradictions, confidence, next action  
4. **This week** — diversified capacity-aware list + excluded drawer  
5. **Call** — one card, discovery prep, optional cited public evidence, hard stops  
6. **Wrap** — export durable week report  

Full-book rankings are optional under **Full book**.

## Differentiator

Rules own safety · AI must cite the file · public evidence is review-only · no CRM hostage · no auto-send

## AI architecture

- Deterministic analysis runs locally for every row.
- Opt-in deep analysis sends only the top 25 rows directly to OpenAI.
- Extracted facts, timelines, contradictions, and next-action evidence must match an exact source quote.
- Optional web refresh searches public business evidence for one contact at a time; it never changes hard stops automatically.
- Set `OPENAI_ANALYSIS_MODEL` / `OPENAI_WEB_MODEL` to override the default model.

## Develop

```bash
npm install
npm run dev
```
