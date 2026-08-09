# Reactivation Desk

Rowan Round 3 case prototype: **immediately monetizable** reactivation workbench for independent financial advisors.

**Live:** (set after deploy)  
**Workflow:** messy export / synthetic book → ranked queue with evidence → human campaign → outcomes → CSV export

## Hard nos

- No continuous CRM / email access  
- No auto-send  
- No invented certainty without row evidence  

## Develop

```bash
npm install
npm run dev
```

## Panel path

1. Open app → **Load synthetic 120-prospect book**  
2. Filter / inspect evidence + risks  
3. **Select top 10** → **Create this week’s campaign**  
4. Edit talk tracks, log outcomes, **Export campaign CSV**  
5. Read **/memo**

## Stack

Next.js · Zustand · Papa Parse · Vercel
