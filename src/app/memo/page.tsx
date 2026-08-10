import Link from "next/link";
import { runDemoEval } from "@/lib/eval";

export default function MemoPage() {
  const evalScores = runDemoEval(10);

  return (
    <main className="memo">
      <div className="topbar" style={{ margin: "0 0 1.5rem", borderRadius: 0 }}>
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            RD
          </div>
          <div className="brand-text">
            <strong>Reactivation Desk</strong>
            <span>Decision memo</span>
          </div>
        </div>
        <Link className="btn" href="/">
          Back to product
        </Link>
      </div>

      <p className="eyebrow">Round 3 case · one page</p>
      <h1>What Rowan should build first</h1>

      <h2>1. What we built, and for whom</h2>
      <p>
        <strong>Reactivation Desk</strong> for solo / small independent advisors
        (Advisor A-like): upload or load a messy prior-prospect book, get a ranked
        who/why/what-to-say queue with opportunity vs reachability scores, silence
        buckets, cited AI extraction, timeline/contradiction review, and a balanced
        weekly list; work it in call mode, log outcomes, export a durable campaign
        CSV. Optional public-business evidence refresh is review-only. No continuous
        CRM/email access. No auto-send.
      </p>

      <h2>2. Strongest alternatives rejected</h2>
      <ul>
        <li>
          <strong>Compliant content studio (C/H):</strong> real pipeline pain, but
          national marketing owns budget/tools; firms already have unused AI content.
        </li>
        <li>
          <strong>Meeting → tasks / exception ops (A/D/E):</strong> summaries and
          task lists already get ignored; process changes already reduced pain;
          needs integrations.
        </li>
        <li>
          <strong>Continuous public/event relationship alerts (G):</strong> huge
          upside, but privacy-heavy and enterprise-led. We kept only an on-demand,
          cited business-evidence check for shortlisted contacts.
        </li>
        <li>
          <strong>Book transition / succession OS (E/I):</strong> high ARPU, rare,
          often consulting, not an immediate SaaS wedge.
        </li>
        <li>
          <strong>Inbound CRM-lite (F) / CFO analytics (B):</strong> clean products,
          wrong primary ICP for regulated wealth.
        </li>
      </ul>

      <h2>3. Evidence for, against, and the tradeoff</h2>
      <p>
        <strong>For:</strong> A reviewed 20 remembered prospects in ~7h → 3 meetings
        → ~$4k FYC; can buy tools under ~$500/mo; forbids continuous system access. J&apos;s
        digitization sample → meetings and ~$10k commission.{" "}
        <strong>Against:</strong> A has not tested the colder remaining 100; J shows
        long-silence outreach can trigger opt-outs; willingness to pay for SaaS vs
        one-time cleanup is mixed.{" "}
        <strong>Tradeoff accepted:</strong> rules own hard stops; AI interprets only
        shortlisted rows with exact-quote validation. Optimize for an independent
        buyer and export-based workflow; defer firm-wide intelligence and content platforms.
      </p>

      <h2>4. Who pays, substitutes, price, why now</h2>
      <p>
        <strong>Buyer:</strong> independent IA / solo broker with buying authority.{" "}
        <strong>Instead of:</strong> manual cherry-picking, $1.5k/mo appointment
        setters (A stopped), one-off digitization projects (J).{" "}
        <strong>Price:</strong> $499 one-time sprint (one book/week) or $99/mo unlimited.{" "}
        <strong>Why purchase now:</strong> completes a revenue-linked weekly workflow
        from files they already have, without hostage-taking integrations.
      </p>

      <h2>5. Kill assumption, test, and next if true</h2>
      <p>
        <strong>Kill assumption:</strong> advisors will not pay if they must still
        upload data and make the calls themselves.{" "}
        <strong>Test:</strong> five advisors, one uploaded book each; measure meetings
        from model-ranked cold names vs their usual memory cherry-pick
        (precision@10 + meetings/week).{" "}
        <strong>If true:</strong> light CRM import (not continuous inbox), stronger
        outcome learning, then compliant snippet packs and transition add-ons on the
        same ranking engine.
      </p>

      <h2>Demo eval snapshot</h2>
      <p>
        Precision@{evalScores.k} on synthetic labeled priorities:{" "}
        <strong>model {Math.round(evalScores.model * 100)}%</strong>, recency-only{" "}
        {Math.round(evalScores.recency * 100)}%, baseline{" "}
        {Math.round(evalScores.random * 100)}% (label pool {evalScores.relevantCount}).
        Labels are a disclosed proxy used to show measurement habit, not production truth.
      </p>

      <h2>Assumptions disclosed</h2>
      <ul>
        <li>Default demo book is synthetic and labeled as such.</li>
        <li>
          Ranking and hard stops are deterministic; opt-in LLM analysis is additive,
          exact-quote validated, and has a local fallback.
        </li>
        <li>Public evidence is cited, review-only, and never authorizes outreach.</li>
        <li>Persistence is browser localStorage for the case artifact.</li>
      </ul>
    </main>
  );
}
