import type { Prospect } from "./types";

/** Disclosed synthetic book (~120) — messy on purpose, Advisor A–like. */
const FIRST = [
  "James", "Maria", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
];
const LAST = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
];
const COMPANIES = [
  "Northline Manufacturing", "Cedar Ridge Holdings", "Summit Dental Group",
  "Harbor Freight Logistics", "Blue Oak Construction", "Pinnacle Vet Partners",
  "Lakeside Orthopedics", "Ironwood Capital Partners", "Prairie Grain Co-op",
  "Atlas HVAC Services", "BrightPath Clinics", "Oak & Stone Realty",
  "Vertex Packaging", "Silver Creek Winery", "Metro Fleet Services",
  "", // missing company on purpose
];
const TITLES = [
  "Owner", "CEO", "President", "CFO", "Managing Partner", "Founder",
  "VP Operations", "Principal", "", "?",
];
const SEGMENTS = [
  "Business owner", "HNW family", "Professional", "Prior inbound",
  "Seminar attendee", "Referral", "Policy lapse review", "",
];
const SOURCES = [
  "CRM", "spreadsheet", "LinkedIn", "email", "CSA notes", "old campaign",
];
const NOTE_FRAGMENTS = [
  "Met at chamber breakfast. Interested in buy-sell funding.",
  "Wife handles finances. Prefers morning calls.",
  "Selling minority stake? Unclear. Follow up Q3.",
  "Do not email — phone only.",
  "Kids in college. Cash flow tight this year.",
  "Asked about key person coverage then went quiet.",
  "Duplicate of another row? Check phone.",
  "Very thin file. Name from LinkedIn only.",
  "Anniversary of policy next month per spreadsheet.",
  "Said call back after acquisition closes.",
  "Angry about prior advisor. Warm to us.",
  "No notes.",
  "Wrong number last attempt.",
  "Referred by client Martinez — high priority if real.",
  "Long silence — last touch years ago.",
];

function pad(n: number) {
  return String(n).padStart(3, "0");
}

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]!;
}

export function buildSyntheticBook(count = 120): Prospect[] {
  const out: Prospect[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${pick(FIRST, i)} ${pick(LAST, i * 3)}`;
    const company = pick(COMPANIES, i * 2);
    const title = pick(TITLES, i * 5);
    const segment = pick(SEGMENTS, i * 7);
    const source = pick(SOURCES, i);
    const notes = pick(NOTE_FRAGMENTS, i * 11);

    // Mess patterns
    const missingEmail = i % 5 === 0;
    const missingPhone = i % 4 === 0;
    const linkedinOnly = i % 9 === 0;
    const lastTouchDays =
      i % 11 === 0 ? 900 + (i % 200) :
      i % 3 === 0 ? 40 + (i % 80) :
      120 + (i % 400);

    const email = missingEmail
      ? undefined
      : `${name.toLowerCase().replace(/ /g, ".")}${i % 7 === 0 ? "" : i}@${i % 2 === 0 ? "gmail.com" : "companymail.com"}`;

    const phone = missingPhone
      ? i % 8 === 0 ? "555-????" : undefined
      : `(${200 + (i % 700)}) ${100 + (i % 800)}-${1000 + (i % 9000)}`;

    const estimatedValue =
      i % 6 === 0 ? undefined :
      i % 10 === 0 ? "$130M exit rumor (unverified)" :
      i % 4 === 0 ? "High — business owner" :
      "Medium";

    // Intentional duplicate cluster
    const dupName = i === 41 || i === 42 ? "Maria Garcia" : name;
    const dupPhone = i === 42 ? out[41]?.phone : phone;

    const p: Prospect = {
      id: `syn-${pad(i + 1)}`,
      name: i === 42 ? dupName : name,
      email: linkedinOnly ? undefined : email,
      phone: i === 42 ? dupPhone : phone,
      company: linkedinOnly ? undefined : company || undefined,
      title: title || undefined,
      segment: segment || undefined,
      source,
      lastTouch: dateDaysAgo(lastTouchDays),
      notes: notes === "No notes." ? undefined : notes,
      estimatedValue,
      linkedin: linkedinOnly || i % 3 === 0
        ? `linkedin.com/in/${name.toLowerCase().replace(/ /g, "")}${i}`
        : undefined,
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
    out.push(p);
  }
  return out;
}
