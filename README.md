# Reactivation Desk

Rowan Round 3 case prototype: **immediately monetizable** reactivation workbench for independent financial advisors.

**Live:** https://reactivation-desk.vercel.app  
**Repo:** https://github.com/mauriciohollando/reactivation-desk  
**Memo:** https://reactivation-desk.vercel.app/memo

## Workflow

1. **Start demo (2 min)** or upload CSV  
2. Review import summary + ranked queue (opportunity × reachability)  
3. Build this week’s callable list  
4. **Call mode** (one card, log outcomes)  
5. Export durable CSV  

## Product judgment

- No continuous CRM / email access  
- No auto-send  
- Silence buckets: safe reopen / handle with care / do not cold-call  
- Scores cite row evidence or ask for review  
- Demo eval precision@10 vs recency / random  

## Develop

```bash
npm install
npm run dev
```

## Stack

Next.js · Zustand · Papa Parse · Vercel
