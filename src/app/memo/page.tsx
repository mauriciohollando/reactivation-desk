import Link from "next/link";

export default function MemoPage() {
  return (
    <main className="memo">
      <Link className="back" href="/">
        ← Back to product
      </Link>
      <p className="eyebrow">Decision memo · ≤1 page</p>
      <h1>What Rowan should build first</h1>

      <h2>1. What we built, and for whom</h2>
      <p>
        <strong>Reactivation Desk</strong> for solo / small independent advisors
        (Advisor A–like): upload or load a messy prior-prospect book, get a ranked
        who/why/what-to-say queue with citations, select this week&apos;s list, edit
        talk tracks, log outcomes, export a durable campaign CSV. No continuous
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
          <strong>Public/event relationship alerts (G):</strong> huge upside, paused
          for privacy; enterprise sales cycle; advisor cannot buy alone.
        </li>
        <li>
          <strong>Book transition / succession OS (E/I):</strong> high ARPU, rare,
          often consulting — not an immediate SaaS wedge.
        </li>
        <li>
          <strong>Inbound CRM-lite (F) / CFO analytics (B):</strong> clean products,
          wrong primary ICP for regulated wealth.
        </li>
      </ul>

      <h2>3. Evidence for, against, and the tradeoff</h2>
      <p>
        <strong>For:</strong> A reviewed 20 remembered prospects in ~7h → 3 meetings
        → ~$4k FYC; can buy tools &lt;$500/mo; forbids continuous system access. J&apos;s
        digitization sample → meetings and ~$10k commission.{" "}
        <strong>Against:</strong> A has not tested the colder remaining 100; J shows
        long-silence outreach can trigger opt-outs; willingness to pay for SaaS vs
        one-time cleanup is mixed.{" "}
        <strong>Tradeoff accepted:</strong> we optimize for an independent buyer and
        export-based workflow now, and defer firm-wide intelligence and content
        platforms.
      </p>

      <h2>4. Who pays, substitutes, price, why now</h2>
      <p>
        <strong>Buyer:</strong> independent IA / solo broker with buying authority.{" "}
        <strong>Instead of:</strong> manual cherry-picking, $1.5k/mo appointment
        setters (A stopped), one-off digitization projects (J).{" "}
        <strong>Price:</strong> $299/mo or $1,500 cleanup sprint + $99/mo.{" "}
        <strong>Why purchase now:</strong> completes a revenue-linked weekly workflow
        from files they already have, without hostage-taking integrations.
      </p>

      <h2>5. Kill assumption, test, and next if true</h2>
      <p>
        <strong>Kill assumption:</strong> advisors will not pay if they must still
        upload data and make the calls themselves.{" "}
        <strong>Test:</strong> five advisors, one uploaded book each; measure meetings
        from model-ranked &quot;cold&quot; names vs their usual memory cherry-pick
        (precision@10 + meetings/week).{" "}
        <strong>If true:</strong> light CRM import (not continuous inbox), outcome
        learning, then compliant snippet packs and transition add-ons on the same
        ranking engine.
      </p>

      <h2>Assumptions disclosed</h2>
      <ul>
        <li>Default demo book is synthetic and labeled as such.</li>
        <li>Ranking is deterministic evidence scoring (no live LLM required for the demo).</li>
        <li>Persistence is browser localStorage for the case artifact.</li>
      </ul>
    </main>
  );
}
