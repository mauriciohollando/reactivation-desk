/**
 * Generates a messy ~1000-row CRM export for the live Upload CSV demo.
 * Writes to ~/Downloads by default so you can import a local file in the meeting
 * (not served from the site).
 *
 * Run: npm run generate:meeting-csv
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HEADERS = [
  "Record ID",
  "Owner",
  "Status",
  "Contact Name",
  "Email Address",
  "Mobile",
  "Organization",
  "Job Title",
  "Type",
  "Channel",
  "Last Activity",
  "Comments",
  "Potential",
  "LinkedIn URL",
  "Created Date",
  "Stage",
  "Do Not Call",
] as const;

type Row = Record<(typeof HEADERS)[number], string>;

const FIRST = [
  "James", "Maria", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda",
  "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Timothy", "Deborah", "Ronald", "Stephanie", "Edward", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Angela", "Eric", "Shirley", "Jonathan", "Anna", "Stephen", "Brenda",
  "Larry", "Pamela", "Justin", "Emma", "Scott", "Nicole", "Brandon", "Helen",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Carolyn", "Patrick", "Janet", "Jack", "Catherine",
  "Dennis", "Maria", "Jerry", "Heather", "Tyler", "Diane", "Aaron", "Julie",
];

const LAST = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill",
  "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell",
  "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz",
  "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales",
  "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward",
  "Richardson", "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray",
  "Mendoza", "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel",
  "Myers", "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry",
];

const COMPANIES = [
  "Northline Manufacturing", "Cedar Ridge Holdings", "Summit Dental Group",
  "Harbor Freight Logistics", "Blue Oak Construction", "Pinnacle Vet Partners",
  "Lakeside Orthopedics", "Ironwood Capital Partners", "Prairie Grain Co-op",
  "Atlas HVAC Services", "BrightPath Clinics", "Oak & Stone Realty",
  "Vertex Packaging", "Silver Creek Winery", "Metro Fleet Services",
  "Red Rock Masonry", "Alvarez Fleet Services", "Desert View Dental",
  "Sunbelt Warehouse Co", "Callahan Steel Fabrication", "Ridge Veterinary Group",
  "Midwest Ortho Partners", "Lakeview Capital", "Coastal Clinics Network",
  "Brooks Mechanical", "Northern Ag Co-op", "Romero Logistics", "Meridian Law Group",
  "Dietrich Custom Homes", "Ortiz Dental Associates", "Cho & Co Advisors",
  "Trent Construction", "Marsh Properties LLC", "Benson Auto Group",
  "Ruiz Plastics", "Pacific Marine Supply", "Delgado Medical Group",
  "Fitzgerald Builders", "Shah Law Partners", "Grant & Sons Distribution",
  "Bright Fork Restaurants", "Johansson Manufacturing US", "Crowe Oilfield Services",
  "Peck Accounting", "Valley Print & Mail", "Horizon Staffing", "Anchor Marina",
  "Twin Peaks Roofing", "Capitol Janitorial", "Greenfield Nursery",
  "Bayview Optometry", "Summit CPA Group", "Iron Gate Security",
  "Lone Star Plumbing", "Cascade Timber", "Heartland Bakery",
  "Urban Loft Design", "Prairie Wind Energy", "Gulf Coast Marine",
  "",
];

const TITLES = [
  "Owner", "CEO", "President", "CFO", "Managing Partner", "Founder",
  "VP Operations", "Principal", "COO", "GM", "Practice Manager", "Partner",
  "Board Chair", "Trustee", "", "?",
];

const TYPES = [
  "Business owner", "HNW family", "Professional", "Referral", "Other", "",
];

const CHANNELS = [
  "CRM", "referral", "seminar attendee", "prior inbound", "inbound email",
  "old campaign", "LinkedIn", "spreadsheet", "CSA notes",
];

const STAGES = [
  "New", "Nurture", "Qualified", "Opportunity", "Stale", "Closed Lost",
];

const OWNERS = ["Mauricio H", "Mauricio H", "Mauricio H", "Unassigned", "Import batch"];

const NOTES = [
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
  "Gatekeeper screens calls. Ask for ops manager.",
  "Policy lapse review flagged in spreadsheet.",
  "Expansion financing closed. Revisit benefits.",
  "Centers of influence. Better for intros than direct sale.",
  "Seasonal business. Prefer call after peak season.",
  "Soft reopen only after prior advisor change.",
  "Multi-location expansion. Coverage gaps unfinished.",
  "Recent inbound. Easy reopen.",
  "Succession conversation started with kids taking over.",
  "Cash tight but still engaged.",
];

const POTENTIALS = [
  "High", "Medium", "Low", "Unknown", "High — business owner",
  "High — liquidity", "$130M exit rumor (unverified)", "",
];

const AREA_CODES = [
  212, 312, 404, 415, 480, 503, 512, 602, 614, 619, 628, 646, 701, 704, 713,
  737, 757, 808, 815, 859, 901, 915, 916, 919, 956, 972, 303, 206, 215, 248,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]!;
}

function isoDaysAgo(days: number): string {
  const d = new Date("2026-08-09T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function rowToLine(row: Row): string {
  return HEADERS.map((h) => csvEscape(row[h] ?? "")).join(",");
}

/** Curated front of book — clear demo moments for the panel. */
function curatedRows(): Row[] {
  const curated: Array<Partial<Row> & Pick<Row, "Contact Name">> = [
    {
      "Contact Name": "Rachel Kwon",
      "Email Address": "rachel.kwon@redrockmasonry.com",
      Mobile: "(602) 555-2201",
      Organization: "Red Rock Masonry",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(28),
      Comments:
        "Met at AGC lunch. Asked about key person on her production manager. Brother may buy in.",
      Potential: "High",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Victor Alvarez",
      "Email Address": "victor@alvarezfleet.com",
      Mobile: "(915) 555-2288",
      Organization: "Alvarez Fleet Services",
      "Job Title": "President",
      Type: "Business owner",
      Channel: "referral",
      "Last Activity": isoDaysAgo(42),
      Comments:
        "Referred by Lopez. Warm. Wants buy-sell quotes before Q4 board meeting.",
      Potential: "High",
      Stage: "Qualified",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Dr. Leah Simmons",
      "Email Address": "lsimmons@desertviewdental.com",
      Mobile: "(480) 555-2144",
      Organization: "Desert View Dental",
      "Job Title": "Managing Partner",
      Type: "Professional",
      Channel: "seminar attendee",
      "Last Activity": isoDaysAgo(10),
      Comments:
        "Anniversary window next month. Prefers texts to schedule then phone.",
      Potential: "Medium",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Omar Haddad",
      "Email Address": "omar@sunbeltware.com",
      Mobile: "(713) 555-2099",
      Organization: "Sunbelt Warehouse Co",
      "Job Title": "Founder",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(82),
      Comments:
        "Acquisition of competitor unfinished. Said call after close. Liquidity event possible.",
      Potential: "High — liquidity",
      Stage: "Opportunity",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Catherine Nguyen",
      "Email Address": "cathy.nguyen@familymail.net",
      Mobile: "(206) 555-2310",
      Organization: "Nguyen Family Holdings",
      "Job Title": "Principal",
      Type: "HNW family",
      Channel: "prior inbound",
      "Last Activity": isoDaysAgo(50),
      Comments:
        "Husband is day-to-day. Estate attorney meeting done; open to planning.",
      Potential: "High",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Dorothy Finch",
      "Email Address": "",
      Mobile: "(901) 555-4032",
      Organization: "Finch Family Office",
      "Job Title": "Advisor contact",
      Type: "HNW family",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(1200),
      Comments: "1100+ days silent. High opt-out risk. Do not cold call.",
      Potential: "High",
      Stage: "Closed Lost",
      "Do Not Call": "Yes",
    },
    {
      "Contact Name": "Harold Pike",
      "Email Address": "harold.pike@hotmail.com",
      Mobile: "(757) 555-4143",
      Organization: "",
      "Job Title": "Retired owner",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(1450),
      Comments:
        "1400d silence. Requested no unsolicited outreach in old note.",
      Potential: "Low",
      Stage: "Closed Lost",
      "Do Not Call": "Yes",
    },
    {
      "Contact Name": "Wendy Zhou",
      "Email Address": "wendy.zhou@gmail.com",
      Mobile: "(408) 555-4254",
      Organization: "Zhou Consulting",
      "Job Title": "Consultant",
      Type: "Professional",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(990),
      Comments: "980d silence. Prior complaint about email cadence.",
      Potential: "Low",
      Stage: "Stale",
      "Do Not Call": "Yes",
    },
    {
      "Contact Name": "Jordan Lee",
      "Email Address": "",
      Mobile: "",
      Organization: "Lee Consulting Group",
      "Job Title": "Independent",
      Type: "Other",
      Channel: "LinkedIn",
      "Last Activity": isoDaysAgo(25),
      Comments: "LinkedIn only, thin contact file. No phone or email on record.",
      Potential: "Unknown",
      "LinkedIn URL": "https://linkedin.com/in/jordanlee-example",
      Stage: "New",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Taylor Brooks",
      "Email Address": "",
      Mobile: "",
      Organization: "Brooks Advisory",
      "Job Title": "Advisor",
      Type: "Other",
      Channel: "LinkedIn",
      "Last Activity": isoDaysAgo(69),
      Comments: "LinkedIn only. Met once at conference. Thin file.",
      Potential: "Unknown",
      "LinkedIn URL": "https://linkedin.com/in/taylorbrooks-example",
      Stage: "New",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Angela Ruiz",
      "Email Address": "angela.ruiz@ruizplastics.com",
      Mobile: "(956) 555-4365",
      Organization: "Ruiz Plastics",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(38),
      Comments:
        "Duplicate of Angela R. below — same company, slightly different email. Keep better record.",
      Potential: "High",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Angela R.",
      "Email Address": "a.ruiz@ruizplastics.com",
      Mobile: "(956) 555-4365",
      Organization: "Ruiz Plastics Inc",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(55),
      Comments: "Same person as Angela Ruiz. Older note: plant expansion.",
      Potential: "High",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Brett Callahan",
      "Email Address": "brett@callahansteel.com",
      Mobile: "(303) 555-2177",
      Organization: "Callahan Steel Fabrication",
      "Job Title": "President",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(93),
      Comments:
        "Key person conversation started then quiet. Still reachable by phone.",
      Potential: "Medium",
      Stage: "Nurture",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Sofia Mendes",
      "Email Address": "sofia@ridgevet.com",
      Mobile: "(919) 555-2440",
      Organization: "Ridge Veterinary Group",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "inbound email",
      "Last Activity": isoDaysAgo(8),
      Comments: "Recent inbound on group disability. Easy reopen.",
      Potential: "Medium",
      Stage: "New",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Patrick O'Neill",
      "Email Address": "poneill@midwestortho.net",
      Mobile: "(614) 555-2502",
      Organization: "Midwest Ortho Partners",
      "Job Title": "CFO",
      Type: "Professional",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(115),
      Comments: "Partner retirement buy-sell in ~18 months. Strong file.",
      Potential: "High",
      Stage: "Qualified",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Greg Thorson",
      "Email Address": "greg@northernag.coop",
      Mobile: "(701) 555-3131",
      Organization: "Northern Ag Co-op",
      "Job Title": "Board Chair",
      Type: "Business owner",
      Channel: "old campaign",
      "Last Activity": isoDaysAgo(513),
      Comments:
        "Do not email — phone only. Frustrated with prior carrier. Soft touch.",
      Potential: "Medium",
      Stage: "Stale",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Helen Morris",
      "Email Address": "helen.morris@outlook.com",
      Mobile: "(215) 555-3020",
      Organization: "Vogel Family Trust",
      "Job Title": "Trustee",
      Type: "HNW family",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(434),
      Comments: "Long silence after prior advisor change. Soft reopen only.",
      Potential: "High",
      Stage: "Stale",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Carl Benson",
      "Email Address": "cbenson@bensonauto.com",
      Mobile: "(248) 555-3921",
      Organization: "Benson Auto Group",
      "Job Title": "President",
      Type: "Business owner",
      Channel: "old campaign",
      "Last Activity": isoDaysAgo(982),
      Comments:
        "Very long silence. Prefer not cold-call until warm signal.",
      Potential: "Low",
      Stage: "Stale",
      "Do Not Call": "Yes",
    },
    {
      "Contact Name": "Ryan Fitzgerald",
      "Email Address": "ryan.fitz@fitzbuilders.com",
      Mobile: "(512) 555-4698",
      Organization: "Fitzgerald Builders",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "referral",
      "Last Activity": isoDaysAgo(22),
      Comments: "Referred by CPA. New construction boom. Buy-sell intro.",
      Potential: "High",
      Stage: "New",
      "Do Not Call": "No",
    },
    {
      "Contact Name": "Louis Grant",
      "Email Address": "louis@grantandsons.com",
      Mobile: "(314) 555-4810",
      Organization: "Grant & Sons Distribution",
      "Job Title": "Owner",
      Type: "Business owner",
      Channel: "CRM",
      "Last Activity": isoDaysAgo(87),
      Comments: "Sons taking over ops. Succession conversation started.",
      Potential: "High",
      Stage: "Opportunity",
      "Do Not Call": "No",
    },
  ];

  return curated.map((c, i) => ({
    "Record ID": `CRM-${10482 + i}`,
    Owner: "Mauricio H",
    Status: "Open",
    "Contact Name": c["Contact Name"],
    "Email Address": c["Email Address"] ?? "",
    Mobile: c.Mobile ?? "",
    Organization: c.Organization ?? "",
    "Job Title": c["Job Title"] ?? "",
    Type: c.Type ?? "",
    Channel: c.Channel ?? "CRM",
    "Last Activity": c["Last Activity"] ?? "",
    Comments: c.Comments ?? "",
    Potential: c.Potential ?? "",
    "LinkedIn URL": c["LinkedIn URL"] ?? "",
    "Created Date": isoDaysAgo(400 + i * 17),
    Stage: c.Stage ?? "Nurture",
    "Do Not Call": c["Do Not Call"] ?? "No",
  }));
}

function syntheticRow(i: number, recordId: number): Row {
  const first = pick(FIRST, i);
  const last = pick(LAST, i * 3 + 7);
  const name = `${first} ${last}`;
  const company = pick(COMPANIES, i * 2);
  const title = pick(TITLES, i * 5);
  const type = pick(TYPES, i * 7);
  const channel = pick(CHANNELS, i);
  const notes = pick(NOTES, i * 11);
  const potential = pick(POTENTIALS, i * 13);
  const stage = pick(STAGES, i * 3);
  const owner = pick(OWNERS, i);

  const missingEmail = i % 5 === 0;
  const missingPhone = i % 4 === 0;
  const linkedinOnly = i % 17 === 0;
  const doNotCall = i % 41 === 0 || i % 53 === 0;

  const lastTouchDays =
    doNotCall ? 900 + (i % 500) :
    i % 11 === 0 ? 450 + (i % 300) :
    i % 3 === 0 ? 20 + (i % 90) :
    100 + (i % 400);

  const area = pick(AREA_CODES, i);
  const phone = linkedinOnly || missingPhone
    ? i % 8 === 0 && !linkedinOnly ? "555-????" : ""
    : `(${area}) 555-${String(1000 + (i % 9000)).padStart(4, "0")}`;

  const email = linkedinOnly || missingEmail
    ? ""
    : `${first.toLowerCase()}.${last.toLowerCase()}${i % 7 === 0 ? "" : i}@${
        i % 2 === 0 ? "gmail.com" : "companymail.com"
      }`;

  const linkedin = linkedinOnly || i % 23 === 0
    ? `https://linkedin.com/in/${first.toLowerCase()}${last.toLowerCase()}-ex`
    : "";

  let comments = notes;
  if (linkedinOnly) comments = "LinkedIn only, thin contact file.";
  if (doNotCall) comments = `${notes} Long silence — do not cold call.`;
  if (i % 29 === 0) comments = "No notes.";

  // Intentional near-duplicate cluster every ~200 rows
  const contactName =
    i % 200 === 50 ? `${first} ${last.charAt(0)}.` :
    i % 200 === 51 ? `${first} ${last}` :
    name;

  return {
    "Record ID": `CRM-${recordId}`,
    Owner: owner,
    Status: doNotCall ? "Open" : pick(["Open", "Open", "Open", "Inactive"], i),
    "Contact Name": contactName,
    "Email Address": email,
    Mobile: phone,
    Organization: linkedinOnly && i % 2 === 0 ? "" : company,
    "Job Title": title,
    Type: type,
    Channel: linkedinOnly ? "LinkedIn" : channel,
    "Last Activity": isoDaysAgo(lastTouchDays),
    Comments: comments,
    Potential: potential,
    "LinkedIn URL": linkedin,
    "Created Date": isoDaysAgo(600 + (i % 1500)),
    Stage: doNotCall ? "Stale" : stage,
    "Do Not Call": doNotCall ? "Yes" : "No",
  };
}

const TARGET = 1050;

function main() {
  const rows: Row[] = [...curatedRows()];
  let recordId = 11000;
  let i = 0;
  while (rows.length < TARGET) {
    rows.push(syntheticRow(i, recordId));
    recordId += 1;
    i += 1;
  }

  const body = [HEADERS.join(","), ...rows.map(rowToLine)].join("\n") + "\n";
  const downloads = join(homedir(), "Downloads");
  mkdirSync(downloads, { recursive: true });
  const out = join(downloads, "advisor-book-crm-export.csv");
  writeFileSync(out, body, "utf8");
  console.log(`Wrote ${rows.length} contacts → ${out}`);
  console.log("In the meeting: Upload CSV → pick this file from Downloads.");
}

main();
