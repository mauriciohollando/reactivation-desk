/**
 * Advisor A classic book: life/benefits reopen for business owners.
 * Buy-sell, key person, succession notes. ~100–140 rows.
 *
 * Phones/emails synthetic. Do not contact.
 * Run: npm run generate:advisor-a-csv
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

type Person = {
  name: string;
  company: string;
  title: string;
  city: string;
  state: string;
  industry: string;
};

const SEED: Person[] = [
  { name: "Bob Luddy", company: "CaptiveAire Systems", title: "Founder and President", city: "Raleigh", state: "NC", industry: "manufacturing" },
  { name: "Jim Goodnight", company: "SAS Institute", title: "Co-founder and CEO", city: "Cary", state: "NC", industry: "software" },
  { name: "John Sall", company: "SAS Institute", title: "Co-founder", city: "Cary", state: "NC", industry: "software" },
  { name: "Roy Carroll II", company: "Carroll Companies", title: "Founder and CEO", city: "Greensboro", state: "NC", industry: "real estate" },
  { name: "Rick Hendrick", company: "Hendrick Automotive Group", title: "Owner and CEO", city: "Charlotte", state: "NC", industry: "auto dealer" },
  { name: "David Morken", company: "Bandwidth", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "telecom" },
  { name: "Michael Praeger", company: "AvidXchange", title: "CEO and Co-founder", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Doug Lebda", company: "LendingTree", title: "Founder and CEO", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Todd Olson", company: "Pendo", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "software" },
  { name: "Joe Gibbs", company: "Joe Gibbs Racing", title: "Owner", city: "Huntersville", state: "NC", industry: "motorsports" },
  { name: "Richard Childress", company: "Richard Childress Racing", title: "Owner", city: "Welcome", state: "NC", industry: "motorsports" },
  { name: "J. Frank Harrison III", company: "Coca-Cola Consolidated", title: "Chairman and CEO", city: "Charlotte", state: "NC", industry: "beverage" },
  { name: "Anita Zucker", company: "The InterTech Group", title: "Chair and CEO", city: "Charleston", state: "SC", industry: "manufacturing" },
  { name: "Robert Faith", company: "Greystar", title: "Founder and CEO", city: "Charleston", state: "SC", industry: "real estate" },
  { name: "Tommy Baker", company: "Baker Motor Company", title: "Dealer principal", city: "Charleston", state: "SC", industry: "auto dealer" },
  { name: "Earle Furman", company: "Furman Capital Advisors", title: "Principal", city: "Greenville", state: "SC", industry: "advisory" },
  { name: "Marcia Taylor", company: "Bennett Family of Companies", title: "CEO", city: "McDonough", state: "GA", industry: "logistics" },
  { name: "Guiomar Obregón", company: "Precision 2000", title: "CEO and Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Carlos Sánchez", company: "Precision 2000", title: "Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Morty Hodge", company: "Hodge Industrial Technologies", title: "Founder and CEO", city: "Hoschton", state: "GA", industry: "distribution" },
  { name: "Michael Russell", company: "H.J. Russell & Company", title: "CEO", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Egbert Perry", company: "The Integral Group", title: "Chairman and CEO", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "John Wieland", company: "John Wieland Homes", title: "Founder", city: "Atlanta", state: "GA", industry: "homebuilding" },
  { name: "Steve Selig", company: "Selig Enterprises", title: "Chairman", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Tope Awotona", company: "Calendly", title: "Founder and CEO", city: "Atlanta", state: "GA", industry: "software" },
  { name: "Arnie Bellini", company: "ConnectWise", title: "Founder", city: "Tampa", state: "FL", industry: "software" },
  { name: "Jason Magee", company: "ConnectWise", title: "CEO", city: "Tampa", state: "FL", industry: "software" },
  { name: "Troy Taylor", company: "Coca-Cola Beverages Florida", title: "Owner, Chairman and CEO", city: "Tampa", state: "FL", industry: "beverage" },
  { name: "Harris Rosen", company: "Rosen Hotels & Resorts", title: "Founder and President", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "David Siegel", company: "Westgate Resorts", title: "Founder", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Jorge Pérez", company: "Related Group", title: "Founder and Chairman", city: "Miami", state: "FL", industry: "real estate" },
  { name: "Norman Braman", company: "Braman Motorcars", title: "Owner", city: "Miami", state: "FL", industry: "auto dealer" },
  { name: "Ed Morse", company: "Ed Morse Automotive Group", title: "Founder", city: "Fort Lauderdale", state: "FL", industry: "auto dealer" },
  { name: "Tilman Fertitta", company: "Landry's", title: "Owner and CEO", city: "Houston", state: "TX", industry: "hospitality" },
  { name: "Jim Crane", company: "Crane Worldwide Logistics", title: "Owner", city: "Houston", state: "TX", industry: "logistics" },
  { name: "Ross Perot Jr.", company: "Hillwood", title: "Chairman", city: "Dallas", state: "TX", industry: "real estate" },
  { name: "Paul Sarvadi", company: "Insperity", title: "Chairman and CEO", city: "Kingwood", state: "TX", industry: "PEO" },
  { name: "Hamdi Ulukaya", company: "Chobani", title: "Founder and CEO", city: "Norwich", state: "NY", industry: "food manufacturing" },
  { name: "Jim Davis", company: "New Balance", title: "Owner and Chairman", city: "Boston", state: "MA", industry: "manufacturing" },
  { name: "Joe Preston", company: "New Balance", title: "CEO", city: "Boston", state: "MA", industry: "manufacturing" },
  { name: "Aman Narang", company: "Toast", title: "CEO and Co-founder", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Steve Fredette", company: "Toast", title: "Co-founder and President", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Tooey Courtemanche", company: "Procore", title: "Founder and CEO", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Ara Mahdessian", company: "ServiceTitan", title: "Co-founder and CEO", city: "Glendale", state: "CA", industry: "field service" },
  { name: "Vaughn Hovanessian", company: "ServiceTitan", title: "Co-founder", city: "Glendale", state: "CA", industry: "field service" },
  { name: "Andrew Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Peggy Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Lynsi Snyder", company: "In-N-Out Burger", title: "Owner and President", city: "Irvine", state: "CA", industry: "restaurants" },
  { name: "Gary Erickson", company: "Clif Bar", title: "Co-founder", city: "Emeryville", state: "CA", industry: "CPG" },
  { name: "Kit Crawford", company: "Clif Bar", title: "Co-owner", city: "Emeryville", state: "CA", industry: "CPG" },
  { name: "Bayard Winthrop", company: "American Giant", title: "Founder", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Michael Preysman", company: "Everlane", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Josh Reeves", company: "Gusto", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Parker Conrad", company: "Rippling", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Isaac Oates", company: "Justworks", title: "Founder and CEO", city: "New York", state: "NY", industry: "PEO" },
  { name: "Neil Blumenthal", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "DTC" },
  { name: "Dave Gilboa", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "DTC" },
  { name: "Jennifer Hyman", company: "Rent the Runway", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "DTC" },
  { name: "Daniel Lubetzky", company: "KIND Snacks", title: "Founder", city: "New York", state: "NY", industry: "CPG" },
  { name: "Gary Vaynerchuk", company: "VaynerMedia", title: "Chairman", city: "New York", state: "NY", industry: "agency" },
  { name: "AJ Vaynerchuk", company: "VaynerMedia", title: "CEO", city: "New York", state: "NY", industry: "agency" },
  { name: "Jason Fried", company: "37signals", title: "Co-founder", city: "Chicago", state: "IL", industry: "software" },
  { name: "David Heinemeier Hansson", company: "37signals", title: "Co-founder", city: "Chicago", state: "IL", industry: "software" },
  { name: "Dick Portillo", company: "Portillo's", title: "Founder", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Michael Osanloo", company: "Portillo's", title: "CEO", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Craig Culver", company: "Culver's", title: "Co-founder", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Joe Koss", company: "Culver's", title: "CEO", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Judy Faulkner", company: "Epic Systems", title: "Founder and CEO", city: "Verona", state: "WI", industry: "health IT" },
  { name: "John Menard Jr.", company: "Menards", title: "Founder and President", city: "Eau Claire", state: "WI", industry: "retail" },
  { name: "David Green", company: "Hobby Lobby", title: "Founder and CEO", city: "Oklahoma City", state: "OK", industry: "retail" },
  { name: "Steve Green", company: "Hobby Lobby", title: "President", city: "Oklahoma City", state: "OK", industry: "retail" },
  { name: "Johnny Morris", company: "Bass Pro Shops", title: "Founder", city: "Springfield", state: "MO", industry: "retail" },
  { name: "Todd Graves", company: "Raising Cane's Chicken Fingers", title: "Founder and CEO", city: "Baton Rouge", state: "LA", industry: "restaurants" },
  { name: "Travis Boersma", company: "Dutch Bros Coffee", title: "Co-founder", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Joth Ricci", company: "Dutch Bros Coffee", title: "CEO", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Chris Gheysens", company: "Wawa", title: "President and CEO", city: "Media", state: "PA", industry: "convenience retail" },
  { name: "Joe Sheetz", company: "Sheetz", title: "CEO", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Travis Sheetz", company: "Sheetz", title: "President", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Roger Penske", company: "Penske Corporation", title: "Founder and Chairman", city: "Bloomfield Hills", state: "MI", industry: "transportation" },
  { name: "Ben Peterson", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Ryan Sanders", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Justin Gold", company: "Justin’s", title: "Founder", city: "Boulder", state: "CO", industry: "CPG" },
  { name: "Brett Schulman", company: "Cava", title: "CEO and Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ike Grigoropoulos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ted Xenohristos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Chris Sullivan", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Bob Basham", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Tim Gannon", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Jerry Morgan", company: "Texas Roadhouse", title: "CEO", city: "Louisville", state: "KY", industry: "restaurants" },
  { name: "Steve Scheel", company: "Scheels", title: "CEO", city: "Fargo", state: "ND", industry: "retail" },
  { name: "Paul Downs", company: "Paul Downs Cabinetmakers", title: "Owner", city: "Bridgeport", state: "PA", industry: "manufacturing" },
  { name: "Jesse Cole", company: "Fans First Entertainment", title: "Owner", city: "Savannah", state: "GA", industry: "entertainment" },
  { name: "René Lacerte", company: "BILL", title: "Founder and CEO", city: "San Jose", state: "CA", industry: "fintech" },
  { name: "Eric Glyman", company: "Ramp", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Karim Atiyeh", company: "Ramp", title: "Co-founder and CTO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Wade Foster", company: "Zapier", title: "Co-founder and CEO", city: "Remote", state: "CA", industry: "software" },
  { name: "Bryan Helmig", company: "Zapier", title: "Co-founder", city: "Remote", state: "CA", industry: "software" },
  { name: "Mike Knoop", company: "Zapier", title: "Co-founder", city: "Remote", state: "CA", industry: "software" },
  { name: "Steli Efti", company: "Close", title: "CEO and Co-founder", city: "San Francisco", state: "CA", industry: "software" },
  { name: "Rand Fishkin", company: "SparkToro", title: "Co-founder and CEO", city: "Seattle", state: "WA", industry: "software" },
  { name: "Casey Henry", company: "SparkToro", title: "Co-founder", city: "Seattle", state: "WA", industry: "software" },
  { name: "Noah Kagan", company: "AppSumo", title: "Founder", city: "Austin", state: "TX", industry: "software" },
  { name: "Sahil Lavingia", company: "Gumroad", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "software" },
  { name: "Tony Chen", company: "Boba Guys", title: "Co-founder", city: "San Francisco", state: "CA", industry: "restaurants" },
  { name: "Bin Chen", company: "Boba Guys", title: "Co-founder", city: "San Francisco", state: "CA", industry: "restaurants" },
  { name: "Kara Goldin", company: "hint", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "beverage" },
  { name: "Seth Goldman", company: "Eat the Change", title: "Founder", city: "Bethesda", state: "MD", industry: "CPG" },
  { name: "Gary Hirshberg", company: "Stonyfield Farm", title: "Co-founder", city: "Londonderry", state: "NH", industry: "CPG" },
  { name: "Brian Halligan", company: "HubSpot", title: "Co-founder", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Dharmesh Shah", company: "HubSpot", title: "Co-founder", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Yamini Rangan", company: "HubSpot", title: "CEO", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Scott Wingo", company: "ChannelAdvisor", title: "Co-founder", city: "Morrisville", state: "NC", industry: "software" },
  { name: "John Williams", company: "Post Properties", title: "Founder", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Tom Cousins", company: "Cousins Properties", title: "Founder", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Russell Brunson", company: "ClickFunnels", title: "Co-founder", city: "Boise", state: "ID", industry: "software" },
  { name: "Todd Dickerson", company: "ClickFunnels", title: "Co-founder", city: "Boise", state: "ID", industry: "software" },
  { name: "Ezra Firestone", company: "Smart Marketer", title: "Founder", city: "Boulder", state: "CO", industry: "agency" },
  { name: "Ryan Deiss", company: "DigitalMarketer", title: "Founder", city: "Austin", state: "TX", industry: "education" },
  { name: "Mike Michalowicz", company: "Profit First Professionals", title: "Founder", city: "Boonton", state: "NJ", industry: "advisory" },
  { name: "Gino Wickman", company: "EOS Worldwide", title: "Founder", city: "Detroit", state: "MI", industry: "advisory" },
  { name: "Verne Harnish", company: "Scaling Up", title: "Founder", city: "Ashburn", state: "VA", industry: "advisory" },
  { name: "Norm Brodsky", company: "CitiStorage", title: "Founder", city: "New York", state: "NY", industry: "logistics" },
  { name: "Jim Coudal", company: "Coudal Partners", title: "Founder", city: "Chicago", state: "IL", industry: "creative" },
  { name: "Aaron Draplin", company: "Draplin Design Co.", title: "Founder", city: "Portland", state: "OR", industry: "design" },
  { name: "Chris Do", company: "The Futur", title: "Founder", city: "Los Angeles", state: "CA", industry: "education" },
  { name: "Whitney Wolfe Herd", company: "Bumble", title: "Founder", city: "Austin", state: "TX", industry: "tech" },
  { name: "Lidiane Jones", company: "Bumble", title: "CEO", city: "Austin", state: "TX", industry: "tech" },
  { name: "Jack Altman", company: "Lattice", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Robert Lynch", company: "Shake Shack", title: "CEO", city: "New York", state: "NY", industry: "restaurants" },
  { name: "Scott Boatwright", company: "Chipotle", title: "CEO", city: "Newport Beach", state: "CA", industry: "restaurants" },
  { name: "Steve Ells", company: "Chipotle", title: "Founder", city: "Newport Beach", state: "CA", industry: "restaurants" },
  { name: "Ron Shaich", company: "Panera Bread (legacy founder)", title: "Founder executive", city: "Boston", state: "MA", industry: "restaurants" },
  { name: "Kat Cole", company: "Focus Brands", title: "President and COO figure", city: "Atlanta", state: "GA", industry: "restaurants" },
  { name: "Jim Holthouser", company: "Focus Brands", title: "CEO", city: "Atlanta", state: "GA", industry: "restaurants" },
];

const NOTES = [
  "Met at chamber breakfast. Interested in buy-sell funding if co-owner transition is real. [TEST DATA — synthetic phone/email; not for outreach]",
  "Notes mention key-person coverage as the business grows — production manager is hard to replace. [TEST DATA — synthetic phone/email; not for outreach]",
  "Sons taking larger roles. Open to succession / estate liquidity planning conversation. [TEST DATA — synthetic phone/email; not for outreach]",
  "Prior inbound about executive benefits for owners. Asked to reconnect after busy season. [TEST DATA — synthetic phone/email; not for outreach]",
  "CPA intro — thinks ownership change talk is timely. Thin on personal details. [TEST DATA — synthetic phone/email; not for outreach]",
  "Discussed buy-sell agreement funding years ago; no follow-up logged. Worth a careful reopen. [TEST DATA — synthetic phone/email; not for outreach]",
  "Liquidity event chatter in notes (minority stake interest). Confirm before pitching. [TEST DATA — synthetic phone/email; not for outreach]",
  "Family business — next gen in operations. Soft succession planning angle only. [TEST DATA — synthetic phone/email; not for outreach]",
  "High priority if referral is real. Warm intro from mutual client. [TEST DATA — synthetic phone/email; not for outreach]",
  "Policy anniversary window coming up on group disability; also open to key-person review. [TEST DATA — synthetic phone/email; not for outreach]",
  "Owner said 'not now' last year on buy-sell. Business grew — try again gently. [TEST DATA — synthetic phone/email; not for outreach]",
  "Notes thin. Title suggests decision maker. Do not cold-pitch product; ask what changed. [TEST DATA — synthetic phone/email; not for outreach]",
  "Partner retirement rumor in file — verify. Classic buy-sell / key person reopen. [TEST DATA — synthetic phone/email; not for outreach]",
  "Interested in protecting income if a key operator left. No quote on file. [TEST DATA — synthetic phone/email; not for outreach]",
  "Long silence. Handle with care — last touch was a holiday card only. [TEST DATA — synthetic phone/email; not for outreach]",
];

const SOURCES = ["CRM", "CPA intro", "chamber event", "referral", "prior meeting", "LinkedIn", "center of influence"];
const VALUES = ["High", "Medium", "High", "", "Medium", "High", ""];

function slugEmail(name: string, company: string) {
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 40);
  const domain = company.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28);
  return `${local}@${domain || "advisora"}.example`;
}

function phoneFor(i: number) {
  const area = [704, 919, 404, 305, 512, 617, 312, 415, 206, 615][i % 10];
  return `(${area}) 555-${String(3000 + (i % 7000)).padStart(4, "0")}`;
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const seen = new Set<string>();
  const people = SEED.filter((p) => {
    const k = `${p.name}|${p.company}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (people.length < 80) throw new Error(`Need 80+, got ${people.length}`);

  const header = ["Name", "Email", "Phone", "Company", "Title", "Segment", "Source", "Last Touch", "Notes", "Value", "LinkedIn", "City", "State", "Industry"];
  const start = Date.UTC(2024, 0, 10);
  const rows = people.map((p, i) =>
    [
      p.name,
      slugEmail(p.name, p.company),
      phoneFor(i),
      p.company,
      p.title,
      `Business owner book · ${p.industry} · ${p.city}, ${p.state}`,
      SOURCES[i % SOURCES.length]!,
      new Date(start + i * 86400000 * 4).toISOString().slice(0, 10),
      NOTES[i % NOTES.length]!,
      VALUES[i % VALUES.length]!,
      "",
      p.city,
      p.state,
      p.industry,
    ]
      .map((c) => csvEscape(String(c)))
      .join(","),
  );

  const out = join(process.cwd(), "public", "advisor-a-life-benefits-test-book.csv");
  writeFileSync(out, [header.join(","), ...rows].join("\n") + "\n");
  console.log(`Wrote ${people.length} rows → ${out}`);
}

main();
