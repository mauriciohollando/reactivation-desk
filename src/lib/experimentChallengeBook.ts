import type { Prospect } from "./types";

export type ChallengeExpectedAction =
  | "call_now"
  | "verify_first"
  | "wait"
  | "exclude";

export type ChallengeTrapType =
  | "keyword_miss"
  | "timing_trap"
  | "consent_conflict"
  | "stale_role"
  | "duplicate_conflict"
  | "thin_high_value"
  | "none";

export type ChallengeLabel = {
  prospectId: string;
  expectedAction: ChallengeExpectedAction;
  commercialTheme: string;
  trapType: ChallengeTrapType;
  judgeNote: string;
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function row(
  partial: Omit<Prospect, "raw" | "id"> & { id: string },
): Prospect {
  const p: Prospect = {
    ...partial,
    raw: {},
  };
  p.raw = {
    Name: p.name,
    Email: p.email ?? "",
    Phone: p.phone ?? "",
    Company: p.company ?? "",
    Title: p.title ?? "",
    Segment: p.segment ?? "",
    Source: p.source ?? "",
    "Last Touch": p.lastTouch ?? "",
    Notes: p.notes ?? "",
    Value: p.estimatedValue ?? "",
    LinkedIn: p.linkedin ?? "",
  };
  return p;
}

/**
 * Adversarial experiment book with human labels independent of rankProspects.
 * Designed to expose keyword-only ranking failures and timing/consent traps.
 */
export function buildExperimentChallengeBook(): {
  prospects: Prospect[];
  labels: ChallengeLabel[];
} {
  const labeled: Array<{ prospect: Prospect; label: Omit<ChallengeLabel, "prospectId"> }> = [
    {
      prospect: row({
        id: "chal-01",
        name: "Diane Holbrook",
        email: "diane@holbrookfab.com",
        phone: "(512) 555-2201",
        company: "Holbrook Fabrication",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(48),
        notes:
          "If either owner dies, the remaining partner has no funded way to buy the other out. She asked for numbers before year-end.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "buy_sell",
        trapType: "keyword_miss",
        judgeNote: "Buy-sell need without the words buy-sell or key person.",
      },
    },
    {
      prospect: row({
        id: "chal-02",
        name: "Raj Mehta",
        email: "raj@mehtalogistics.com",
        phone: "(713) 555-2202",
        company: "Mehta Logistics",
        title: "CEO",
        segment: "Business owner",
        source: "referral",
        lastTouch: isoDaysAgo(33),
        notes:
          "Plant manager carries most customer relationships. Raj said the company would struggle for months if that person left suddenly.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "key_person",
        trapType: "keyword_miss",
        judgeNote: "Key-person exposure described in plain language only.",
      },
    },
    {
      prospect: row({
        id: "chal-03",
        name: "Claire Fontaine",
        email: "claire@fontainepartners.com",
        phone: "(416) 555-2203",
        company: "Fontaine Partners",
        title: "Managing Partner",
        segment: "Professional",
        source: "CRM",
        lastTouch: isoDaysAgo(61),
        notes:
          "She is taking on a minority investor next spring. Conversation paused until paperwork is signed; call after the round closes.",
        estimatedValue: "High — liquidity event",
      }),
      label: {
        expectedAction: "wait",
        commercialTheme: "liquidity",
        trapType: "timing_trap",
        judgeNote: "Strong commercial theme, but file says wait until after close.",
      },
    },
    {
      prospect: row({
        id: "chal-04",
        name: "Owen Brandt",
        email: "owen@brandtsteel.com",
        phone: "(303) 555-2204",
        company: "Brandt Steelworks",
        title: "President",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(74),
        notes:
          "Acquisition already closed in May. He said the planning conversation can reopen now that the deal is done.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "liquidity",
        trapType: "timing_trap",
        judgeNote: "Looks like a wait-after-X note, but the event already happened.",
      },
    },
    {
      prospect: row({
        id: "chal-05",
        name: "Helena Ortiz",
        email: "helena@ortizdental.com",
        phone: "(602) 555-2205",
        company: "Ortiz Dental Group",
        title: "Managing Partner",
        segment: "Professional",
        source: "seminar attendee",
        lastTouch: isoDaysAgo(27),
        notes:
          "Coverage review window opens next month. Prefers morning calls. Do not email — phone only.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "policy_window",
        trapType: "consent_conflict",
        judgeNote: "Phone-ready opportunity, but email channel is restricted.",
      },
    },
    {
      prospect: row({
        id: "chal-06",
        name: "Victor Lang",
        email: "vlang@langholdings.com",
        phone: "(206) 555-2206",
        company: "Lang Holdings",
        title: "CEO",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(90),
        notes:
          "Title still says CEO. Notes from CSA: Victor retired last fall; daughter now runs day-to-day.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "succession",
        trapType: "stale_role",
        judgeNote: "Role on file conflicts with retirement note.",
      },
    },
    {
      prospect: row({
        id: "chal-07",
        name: "Nora Ellison",
        email: "nora@ellisonvet.com",
        phone: "(919) 555-2207",
        company: "Ellison Vet Partners",
        title: "Owner",
        segment: "Business owner",
        source: "email",
        lastTouch: isoDaysAgo(19),
        notes:
          "Asked about disability coverage for herself and the associate doctor after clinic expansion.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "policy_window",
        trapType: "none",
        judgeNote: "Clear recent inbound planning need.",
      },
    },
    {
      prospect: row({
        id: "chal-08a",
        name: "Patrick Shaw",
        email: "patrick@shawfleet.com",
        phone: "(214) 555-2208",
        company: "Shaw Fleet Services",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(41),
        notes: "Strong ownership transition talk. Ready for a short call.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "succession",
        trapType: "none",
        judgeNote: "Clean primary record for the Shaw duplicate pair.",
      },
    },
    {
      prospect: row({
        id: "chal-08b",
        name: "Patrick Shaw",
        email: "pshaw@gmail.com",
        phone: "(214) 555-2208",
        company: "Shaw Fleet",
        title: "Owner",
        segment: "Business owner",
        source: "spreadsheet",
        lastTouch: isoDaysAgo(210),
        notes: "Possible duplicate. Wrong number recorded on last attempt?",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "succession",
        trapType: "duplicate_conflict",
        judgeNote: "Same phone as cleaner Shaw record; should not win the week list.",
      },
    },
    {
      prospect: row({
        id: "chal-09",
        name: "Gina Torres",
        email: "gina.torres@outlook.com",
        phone: "(305) 555-2209",
        company: "Torres Family Office",
        title: "Principal",
        segment: "HNW family",
        source: "prior inbound",
        lastTouch: isoDaysAgo(55),
        notes: "High potential. File has almost no planning detail.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "high_value",
        trapType: "thin_high_value",
        judgeNote: "High value alone is not a cited commercial reason.",
      },
    },
    {
      prospect: row({
        id: "chal-10",
        name: "Benjamin Crowe",
        email: "ben@crowepackaging.com",
        phone: "(973) 555-2210",
        company: "Crowe Packaging",
        title: "Owner",
        segment: "Business owner",
        source: "referral",
        lastTouch: isoDaysAgo(36),
        notes:
          "Introduced by client Alvarez. Benjamin wanted a short ownership-protection conversation for the plant.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "referral",
        trapType: "keyword_miss",
        judgeNote: "Warm referral plus ownership protection without keyword tags.",
      },
    },
    {
      prospect: row({
        id: "chal-11",
        name: "Iris Chen",
        email: "iris@chenclinics.com",
        phone: "(404) 555-2211",
        company: "Chen Clinics",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(120),
        notes:
          "Sons are taking over operations this winter. She wants a clean handoff conversation.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "succession",
        trapType: "none",
        judgeNote: "Explicit succession language.",
      },
    },
    {
      prospect: row({
        id: "chal-12",
        name: "Marcus Bell",
        email: "marcus@bellmarine.com",
        phone: "(251) 555-2212",
        company: "Bell Marine",
        title: "Founder",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(88),
        notes:
          "Said revisit after Q4 audit. Do not force a planning pitch before then.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "wait",
        commercialTheme: "general",
        trapType: "timing_trap",
        judgeNote: "Future timing instruction should keep this out of call-now.",
      },
    },
    {
      prospect: row({
        id: "chal-13",
        name: "Paula Nguyen",
        email: "paula@nguyenortho.com",
        phone: "(614) 555-2213",
        company: "Nguyen Orthopedics",
        title: "CFO",
        segment: "Professional",
        source: "CRM",
        lastTouch: isoDaysAgo(44),
        notes:
          "Partner retirement funding still unfinished. Paula is the economic buyer for the conversation.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "buy_sell",
        trapType: "keyword_miss",
        judgeNote: "Partner retirement funding is buy-sell economics without the label.",
      },
    },
    {
      prospect: row({
        id: "chal-14",
        name: "Harvey Dean",
        email: "harvey.dean@gmail.com",
        phone: "(860) 555-2214",
        company: "Dean Imports",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(1180),
        notes: "No contact in years. High opt-out risk if cold-called.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "exclude",
        commercialTheme: "none",
        trapType: "none",
        judgeNote: "Should be removed by the safety gate before ranking.",
      },
    },
    {
      prospect: row({
        id: "chal-15",
        name: "Lydia Park",
        email: "lydia@parkandco.com",
        phone: "(628) 555-2215",
        company: "Park & Co CPA",
        title: "Partner",
        segment: "Referral",
        source: "referral",
        lastTouch: isoDaysAgo(29),
        notes: "Referred two clients historically. Due for a courtesy check-in.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "referral",
        trapType: "none",
        judgeNote: "Warm relationship reopen.",
      },
    },
    {
      prospect: row({
        id: "chal-16",
        name: "Theo Abrams",
        email: "theo@abramsbuild.com",
        phone: "(503) 555-2216",
        company: "Abrams Builders",
        title: "Owner",
        segment: "Business owner",
        source: "old campaign",
        lastTouch: isoDaysAgo(430),
        notes:
          "Long silence after prior advisor change. Soft reopen only if a specific reason exists.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "high_value",
        trapType: "thin_high_value",
        judgeNote: "Careful gap with no concrete commercial cite.",
      },
    },
    {
      prospect: row({
        id: "chal-17",
        name: "Sofia Reyes",
        email: "sofia@reyescargo.com",
        phone: "(915) 555-2217",
        company: "Reyes Cargo",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(52),
        notes:
          "She wants protection if her brother, who runs dispatch, is unavailable for a quarter.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "key_person",
        trapType: "keyword_miss",
        judgeNote: "Operational dependency = key person, no keyword.",
      },
    },
    {
      prospect: row({
        id: "chal-18",
        name: "Neil Cartwright",
        email: "neil@cartwrightlabs.com",
        phone: "(919) 555-2218",
        company: "Cartwright Labs",
        title: "Founder",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(67),
        notes:
          "Anniversary of the disability policy is next month per spreadsheet.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "policy_window",
        trapType: "none",
        judgeNote: "Clear policy window.",
      },
    },
    {
      prospect: row({
        id: "chal-19",
        name: "Amber Soto",
        linkedin: "linkedin.com/in/ambersoto",
        source: "LinkedIn",
        lastTouch: isoDaysAgo(40),
        notes: "Interesting company sale rumor. No phone or email captured.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "exclude",
        commercialTheme: "liquidity",
        trapType: "none",
        judgeNote: "No reachable channel; safety gate should drop this.",
      },
    },
    {
      prospect: row({
        id: "chal-20",
        name: "Jonah Price",
        email: "jonah@priceequip.com",
        phone: "(616) 555-2220",
        company: "Price Equipment",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(58),
        notes:
          "Selling a minority stake conversation unfinished. He said the LOI is signed and outreach can resume.",
        estimatedValue: "High — liquidity",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "liquidity",
        trapType: "timing_trap",
        judgeNote: "Liquidity event already progressed; reopen is appropriate.",
      },
    },
    {
      prospect: row({
        id: "chal-21",
        name: "Ruth Kim",
        email: "ruth@kimfamilytrust.com",
        phone: "(215) 555-2221",
        company: "Kim Family Trust",
        title: "Trustee",
        segment: "HNW family",
        source: "CRM",
        lastTouch: isoDaysAgo(39),
        notes:
          "Estate attorney meeting completed. Warm to a planning conversation this month.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "estate",
        trapType: "none",
        judgeNote: "Recent warm reopen with timing.",
      },
    },
    {
      prospect: row({
        id: "chal-22",
        name: "Greg Holtz",
        email: "greg@holtzprinting.com",
        phone: "(414) 555-2222",
        company: "Holtz Printing",
        title: "Owner",
        segment: "Business owner",
        source: "CRM",
        lastTouch: isoDaysAgo(95),
        notes: "Angry about prior carrier. Soft touch only.",
        estimatedValue: "Medium",
      }),
      label: {
        expectedAction: "verify_first",
        commercialTheme: "general",
        trapType: "consent_conflict",
        judgeNote: "Relationship friction requires care before dialing.",
      },
    },
    {
      prospect: row({
        id: "chal-23",
        name: "Camila Duarte",
        email: "camila@duarteclinics.com",
        phone: "(305) 555-2223",
        company: "Duarte Clinics",
        title: "Owner",
        segment: "Business owner",
        source: "seminar attendee",
        lastTouch: isoDaysAgo(24),
        notes:
          "Multi-location expansion. Asked whether coverage gaps follow the new site openings.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "policy_window",
        trapType: "none",
        judgeNote: "Expansion plus coverage-gap question.",
      },
    },
    {
      prospect: row({
        id: "chal-24",
        name: "Elliot Grant",
        email: "elliot@grantcapital.com",
        phone: "(312) 555-2224",
        company: "Grant Capital Partners",
        title: "Managing Partner",
        segment: "HNW family",
        source: "CRM",
        lastTouch: isoDaysAgo(49),
        notes:
          "Interested in executive benefits for portfolio CEOs. Follow up while the conversation is still open.",
        estimatedValue: "High",
      }),
      label: {
        expectedAction: "call_now",
        commercialTheme: "executive_benefits",
        trapType: "none",
        judgeNote: "Clear professional opportunity.",
      },
    },
  ];

  // Fill to ~60 records so a 50-candidate shortlist is realistic after exclusions.
  const filler: Prospect[] = Array.from({ length: 36 }, (_, i) => {
    const n = i + 25;
    const warm = i % 3 !== 0;
    return row({
      id: `chal-fill-${String(n).padStart(2, "0")}`,
      name: [
        "Ada Brooks",
        "Bruno Silva",
        "Cora Hale",
        "Drew Patel",
        "Eden Walsh",
        "Felix Ortiz",
        "Greta Moon",
        "Hugo Lane",
        "Ivy Santos",
        "Joel Hart",
        "Kara Bloom",
        "Leon Pike",
        "Mira Cole",
        "Nate Quinn",
        "Olive West",
        "Pete Sharp",
        "Quinn Adler",
        "Rita Vance",
        "Saul York",
        "Tess Rowan",
        "Uri Mandel",
        "Vera Snow",
        "Wade Frost",
        "Xena Pitt",
        "Yuri Nash",
        "Zara Holt",
        "Alan Moss",
        "Bea Cruz",
        "Colt Reed",
        "Dana Fox",
        "Eli Marsh",
        "Fay Knox",
        "Gus Blair",
        "Hana Reed",
        "Ian Cobb",
        "Jade Orr",
      ][i]!,
      email: warm ? `chal${n}@example.com` : i % 5 === 0 ? undefined : `c${n}@mail.com`,
      phone: i % 6 === 0 ? undefined : `(555) 220-${1000 + n}`,
      company: i % 7 === 0 ? undefined : `Challenge Co ${n}`,
      title: i % 2 === 0 ? "Owner" : "Manager",
      segment: warm ? "Business owner" : "Professional",
      source: "CRM",
      lastTouch: isoDaysAgo(warm ? 40 + i * 2 : 180 + i * 11),
      notes: warm
        ? "General planning follow-up with usable contact details."
        : "Light notes only. Recoverable if a better reason appears.",
      estimatedValue: warm ? "Medium" : "Low",
    });
  });

  const fillerLabels: ChallengeLabel[] = filler.map((p) => ({
    prospectId: p.id,
    expectedAction:
      !p.phone && !p.email
        ? "exclude"
        : (p.notes ?? "").includes("Light notes")
          ? "verify_first"
          : "call_now",
    commercialTheme: "general",
    trapType: "none",
    judgeNote: "Filler control record for shortlist size.",
  }));

  const prospects = [...labeled.map((item) => item.prospect), ...filler];
  const labels: ChallengeLabel[] = [
    ...labeled.map((item) => ({
      prospectId: item.prospect.id,
      ...item.label,
    })),
    ...fillerLabels,
  ];

  return { prospects, labels };
}

export function challengeLabelMap(labels: ChallengeLabel[]) {
  return new Map(labels.map((label) => [label.prospectId, label]));
}
