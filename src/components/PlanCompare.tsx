"use client";

import {
  SPRINT_MAX_BOOKS,
  SPRINT_MAX_WEEK_SIZE,
  SPRINT_MAX_WEEKS,
  SPRINT_PRICE,
  SUBSCRIPTION_PRICE,
  type AccessPlan,
} from "@/lib/access";

type Props = {
  focus: "sprint" | "subscription";
  onPurchase: (plan: AccessPlan) => void;
  onBack: () => void;
};

const ROWS: {
  label: string;
  sprint: string;
  unlimited: string;
}[] = [
  {
    label: "Book imports",
    sprint: `${SPRINT_MAX_BOOKS} full book`,
    unlimited: "Unlimited imports",
  },
  {
    label: "Polished weeks",
    sprint: `${SPRINT_MAX_WEEKS} week builds`,
    unlimited: "Unlimited weeks",
  },
  {
    label: "People per week",
    sprint: `Up to ${SPRINT_MAX_WEEK_SIZE}`,
    unlimited: "Up to 40",
  },
  {
    label: "Call polish",
    sprint: "Every contact in the week",
    unlimited: "Every contact, every week",
  },
  {
    label: "Campaign brief + ranking",
    sprint: "Included",
    unlimited: "Included",
  },
  {
    label: "Best for",
    sprint: "Prove the desk on one book",
    unlimited: "Run reactivation every week",
  },
];

export function PlanCompare({ focus, onPurchase, onBack }: Props) {
  return (
    <section className="plan-compare">
      <button type="button" className="btn ghost plan-compare-back" onClick={onBack}>
        ← Back
      </button>

      <header className="plan-compare-hero">
        <p className="plan-compare-kicker">Choose how you run the desk</p>
        <h2>Finish real reactivation weeks — not another CRM report</h2>
        <p>
          Import a messy book, get a finishable call list, and open every name with polished talk
          tracks grounded in your file. Pick the Sprint to prove it, or Unlimited to keep going.
        </p>
      </header>

      <div className="plan-compare-grid">
        <article
          className={
            focus === "sprint" ? "plan-offer plan-offer-sprint focus" : "plan-offer plan-offer-sprint"
          }
        >
          <div className="plan-offer-top">
            <span className="plan-offer-name">Sprint</span>
            <p className="plan-offer-price">
              <strong>${SPRINT_PRICE}</strong>
              <span>one-time</span>
            </p>
            <p className="plan-offer-pitch">
              One book. Three polished weeks. Up to {SPRINT_MAX_WEEK_SIZE} people each week — enough
              to reopen a slice of your book and see if the desk earns its keep.
            </p>
          </div>
          <ul className="plan-offer-list">
            <li>1 book import with your tags and ranking</li>
            <li>{SPRINT_MAX_WEEKS} AI week builds with call polish on every contact</li>
            <li>Up to {SPRINT_MAX_WEEK_SIZE} people per week — finishable, not a dump</li>
            <li>File-grounded reasons, sale highlights, and approach notes</li>
          </ul>
          <button
            type="button"
            className={focus === "sprint" ? "btn primary lg" : "btn lg"}
            onClick={() => onPurchase("sprint")}
          >
            Get Sprint · ${SPRINT_PRICE}
          </button>
        </article>

        <article
          className={
            focus === "subscription"
              ? "plan-offer plan-offer-unlimited focus"
              : "plan-offer plan-offer-unlimited"
          }
        >
          <div className="plan-offer-badge">Most advisors stay here</div>
          <div className="plan-offer-top">
            <span className="plan-offer-name">Unlimited</span>
            <p className="plan-offer-price">
              <strong>${SUBSCRIPTION_PRICE}</strong>
              <span>/month</span>
            </p>
            <p className="plan-offer-pitch">
              Keep importing books and building polished weeks without counting attempts. The desk
              becomes your weekly reactivation habit.
            </p>
          </div>
          <ul className="plan-offer-list">
            <li>Unlimited book imports</li>
            <li>Unlimited polished week builds</li>
            <li>Up to 40 people per week when you want a bigger push</li>
            <li>Same call polish, briefs, and exports — every week</li>
          </ul>
          <button
            type="button"
            className={focus === "subscription" ? "btn primary lg" : "btn lg"}
            onClick={() => onPurchase("subscription")}
          >
            Start Unlimited · ${SUBSCRIPTION_PRICE}/mo
          </button>
        </article>
      </div>

      <div className="plan-compare-table-wrap">
        <h3>Side by side</h3>
        <table className="plan-compare-table">
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col" className={focus === "sprint" ? "on" : undefined}>
                Sprint
              </th>
              <th scope="col" className={focus === "subscription" ? "on" : undefined}>
                Unlimited
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className={focus === "sprint" ? "on" : undefined}>{row.sprint}</td>
                <td className={focus === "subscription" ? "on" : undefined}>{row.unlimited}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted tiny plan-compare-note">
        Prototype checkout — purchase unlocks the desk immediately. Prefer a code? Go back and use
        the promo field on the main page.
      </p>
    </section>
  );
}
