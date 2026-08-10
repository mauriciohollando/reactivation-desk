# Meeting talking points

**Rowan · Round 3 · Founding AI Product Engineer**  
*Reactivation Desk — judgment, product, demo, questions*

## 1. What Rowan is (context)

Rowan is building systems that **carry consequential work across the finish line** for financial-services firms — a firm-safe relationship execution layer, not another AI answer box.

Themes they named: missed follow-through, meaningful changes across clients/prospects, safe handoffs, correct forms/records, compliant growth opportunities, and **keeping the advisor in control**.

Round 3 does **not** prescribe the first product. Discovery evidence → decide the wedge → ship something monetizable now → defend the judgment.

## 2. Decision in one breath

I wasn’t picking the coolest AI idea. I was picking the first thing that can **sell now**.

Five things have to line up:

1. **Pain** — felt every week
2. **Buyer** — same person can say yes
3. **Price** — no committee
4. **Workflow** — input → decision → action → result
5. **Pay now** — no year of integrations first

**Advisor A** is the only interview where all five lined up. **C** and **J** echoed the same reactivation / prioritize-the-book need.

> **Tradeoff I’m accepting:** narrow wedge now; broaden later only if A-like buyers pay.

## 3. Assumptions along the way

Needs differ by advisor role, purchase cycle, and ultimately **what product they would buy**. One platform that “covers all ten interviews” is a slow enterprise bet, not a founding wedge.

## 4. Why this product — and what I ignored

### Wrong customer — B / D / F

Some interviews weren’t independent wealth advisors at all (CFO reporting, bank/CU ops, tech brokerage). Good problems, different company. Building for them means abandoning the Rowan advisor thesis.

| ID | Who | Why not first |
|----|-----|----------------|
| **B** | Fractional CFO | Different job and market |
| **D** | Bank / CU client engagement | Enterprise ops; long procurement |
| **F** | Tech broker (not RIA) | Adjacent sales problem, wrong ICP |

### Right world, wrong shape — E / I

Book transitions and succession can be big money — rare projects, home office often buys or blocks. Consulting-shaped, not a tool someone buys this month and uses every Monday.

| ID | Who | Why not first |
|----|-----|----------------|
| **E** | Indie practice acquiring books | High $, every few years |
| **I** | Senior BD / succession | Firm decides; often internal / $0 |

### Real pain, advisor can’t buy — C / G / H

Content, compliance, and firm-wide intel — advisors want it, but marketing or the bank owns budget and approval. Year-long cycle. Not a founding wedge.

| ID | Who | Why not first |
|----|-----|----------------|
| **C** | Mutual-co advisor | National marketing owns tools/budget |
| **G** | Bank brokerage HNW | Privacy + national approval; advisor can’t buy alone |
| **H** | Newer bank advisor | Same compliance / approval wall |

**Say it out loud:**  
“Across the interviews, needs split by role, purchase cycle, and who holds the budget. Only one path lined up pain, buyer, price, weekly workflow, and ‘buy now’ — independent advisors with a messy dormant book. So I shipped a reactivation desk for that.”

If they push “but X was bigger $”:  
“Bigger check ≠ better first product. I optimized for speed to a paying user, not max theoretical ACV.”

## 5. Which Rowan themes this product tackles

**Mainly these two**

- **Surfacing compliant growth opportunities** — core job. Rank dormant prospects, say why to call them, give a talk track, turn a cold book into meetings.
- **Keeping the advisor in control** — never auto-email or auto-dial. Human picks, calls, logs, exports. AI recommends; advisor decides.

**Partially / lightly**

- **Catching follow-through that would otherwise be missed** — ranked weekly list + outcome log so names don’t die in a spreadsheet. Not full meeting → commitment tracking.

**Not claiming as the wedge today**

- Detecting meaningful changes across clients/prospects (ongoing alerts)
- Moving work safely between people and systems
- Preparing forms, records, and follow-up correctly

**Notes / note-takers (honest long-run)**  
Notes today make reactivation smarter at call time — not a living change monitor. Same ranking engine can later ingest note-takers or CRM feeds as change signals. I started with export + dormant book because A can buy that **now**, without firm-wide monitoring.

## 6. What I built

**Reactivation Desk** — export a messy CSV → finishable weekly call list → polished call tips → log outcomes → next week.

**Live path**

1. Unlock (Sprint / Unlimited or promo)
2. Import a book → AI guesses who you sell to / what you reopen → user corroborates
3. Build a short week (budget you can finish)
4. Open a name → call polish grounded in the file (+ light public context)
5. Wrap → leftovers / next week

**Why it’s sellable now**  
Completes one workflow end-to-end with a real input (CSV), no CRM integration, priced as **Sprint ($499)** or **Unlimited ($99/mo)** against A’s proven reactivation math and failed setter spend.

## 7. Questions for the panel

1. For Advisor A–like buyers, is **Sprint vs monthly** the right packaging — or should the first SKU be a done-with-you “first week” service?
2. Where’s the line on **public web enrichment** vs compliance comfort for broker-dealer affiliated advisors?
3. If this works, what’s the next wedge you’d want: **deeper call coaching**, **CSA workflow**, or **book-of-business import beyond CSV**?
4. Who should we put this in front of first — **independents like A**, or **mutual-company advisors like C** with heavier compliance?
5. What would make this a clear “no” in diligence — accuracy, hallucination risk, or “they won’t upload the book”?

---

*Prototype: https://reactivation-desk.vercel.app · Decision memo also at /memo on the same site.*
