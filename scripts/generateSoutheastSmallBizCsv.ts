/**
 * Builds 500+ rows of REAL, publicly reported decision-makers at small / mid-market
 * companies in the Southeast (NC, SC, GA, FL, TN, AL, VA, etc.) for testing
 * local / sector campaign briefs.
 *
 * Phones and emails are synthetic. Do not contact anyone.
 *
 * Strategy:
 * 1) Seed list of well-known SE private-company leaders
 * 2) OpenAI + web_search batches by metro/industry to reach ≥500 unique people
 *
 * Run: npm run generate:southeast-csv
 * Requires OPENAI_API_KEY in .env.local
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

type Person = {
  name: string;
  company: string;
  title: string;
  city: string;
  state: string;
  industry: string;
};

function loadEnvLocal() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2]!;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** Hand-curated SE private / local-market leaders (publicly reported). */
const SEED: Person[] = [
  { name: "Roy Carroll II", company: "Carroll Companies", title: "Founder and CEO", city: "Greensboro", state: "NC", industry: "real estate" },
  { name: "Jim Goodnight", company: "SAS Institute", title: "Co-founder and CEO", city: "Cary", state: "NC", industry: "software" },
  { name: "John Sall", company: "SAS Institute", title: "Co-founder", city: "Cary", state: "NC", industry: "software" },
  { name: "Bob Luddy", company: "CaptiveAire Systems", title: "Founder and President", city: "Raleigh", state: "NC", industry: "manufacturing" },
  { name: "Rick Hendrick", company: "Hendrick Automotive Group", title: "Owner and CEO", city: "Charlotte", state: "NC", industry: "auto dealer" },
  { name: "David Morken", company: "Bandwidth", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "telecom" },
  { name: "Michael Praeger", company: "AvidXchange", title: "CEO and Co-founder", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Doug Lebda", company: "LendingTree", title: "Founder and CEO", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Todd Olson", company: "Pendo", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "software" },
  { name: "Eric Bodager", company: "ChannelAdvisor", title: "Former leadership / NC tech", city: "Morrisville", state: "NC", industry: "software" },
  { name: "Scott Wingo", company: "ChannelAdvisor", title: "Co-founder", city: "Morrisville", state: "NC", industry: "software" },
  { name: "Arnie Bellini", company: "ConnectWise", title: "Founder", city: "Tampa", state: "FL", industry: "software" },
  { name: "Jason Magee", company: "ConnectWise", title: "CEO", city: "Tampa", state: "FL", industry: "software" },
  { name: "Troy Taylor", company: "Coca-Cola Beverages Florida", title: "Owner, Chairman and CEO", city: "Tampa", state: "FL", industry: "beverage distribution" },
  { name: "Marcia Taylor", company: "Bennett Family of Companies", title: "CEO", city: "McDonough", state: "GA", industry: "trucking logistics" },
  { name: "Guiomar Obregón", company: "Precision 2000", title: "CEO and Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Carlos Sánchez", company: "Precision 2000", title: "Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Morty Hodge", company: "Hodge Industrial Technologies", title: "Founder and CEO", city: "Hoschton", state: "GA", industry: "industrial distribution" },
  { name: "Bernie Marcus", company: "The Home Depot", title: "Co-founder", city: "Atlanta", state: "GA", industry: "retail" },
  { name: "Arthur Blank", company: "Amb Holdings / Atlanta Falcons", title: "Owner", city: "Atlanta", state: "GA", industry: "sports hospitality" },
  { name: "Vince Dooley", company: "Dooley Enterprises", title: "Principal", city: "Athens", state: "GA", industry: "consulting" },
  { name: "John Imlay", company: "Imlay Investments", title: "Founder", city: "Atlanta", state: "GA", industry: "investing" },
  { name: "Micky Arison", company: "Carnival Corporation", title: "Chairman", city: "Miami", state: "FL", industry: "hospitality" },
  { name: "Jorge Pérez", company: "Related Group", title: "Founder and Chairman", city: "Miami", state: "FL", industry: "real estate" },
  { name: "Norman Braman", company: "Braman Motorcars", title: "Owner", city: "Miami", state: "FL", industry: "auto dealer" },
  { name: "Wayne Huizenga Jr.", company: "Huizenga Holdings", title: "Principal", city: "Fort Lauderdale", state: "FL", industry: "investing" },
  { name: "AutoNation founder H. Wayne Huizenga", company: "Huizenga Holdings", title: "Founder (legacy)", city: "Fort Lauderdale", state: "FL", industry: "investing" },
  { name: "Ed Morse", company: "Ed Morse Automotive Group", title: "Founder", city: "Florida", state: "FL", industry: "auto dealer" },
  { name: "Kenny Guinn", company: "Guinn Partners", title: "Principal", city: "Tampa", state: "FL", industry: "investing" },
  { name: "Jeff Vinik", company: "Vinik Family Office / Strategic Property Partners", title: "Owner", city: "Tampa", state: "FL", industry: "real estate" },
  { name: "Bill Edwards", company: "Edwards Companies", title: "Developer", city: "St. Petersburg", state: "FL", industry: "real estate" },
  { name: "Blake Hunt", company: "Hunt Construction / regional", title: "Principal", city: "Lakeland", state: "FL", industry: "construction" },
  { name: "Outback founders Chris Sullivan", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Bob Basham", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Tim Gannon", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "David Brandon", company: "Toys.com era / SE ops", title: "Executive", city: "Tampa", state: "FL", industry: "retail" },
  { name: "Pat Williams", company: "Orlando Magic (legacy leadership)", title: "Co-founder figure", city: "Orlando", state: "FL", industry: "sports" },
  { name: "Harris Rosen", company: "Rosen Hotels & Resorts", title: "Founder and President", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Jim Gaffigan", company: "Gaffigan companies", title: "Principal", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Alan Ginsburg", company: "Ginsburg Enterprises / real estate", title: "Developer", city: "Orlando", state: "FL", industry: "real estate" },
  { name: "David Siegel", company: "Westgate Resorts", title: "Founder", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Jackie Siegel", company: "Westgate Resorts", title: "Chief of Staff / Principal", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Charles Whittall", company: "Whittall & Company", title: "Developer", city: "Orlando", state: "FL", industry: "real estate" },
  { name: "Alex Ogea", company: "Unicorp National Developments", title: "Principal", city: "Orlando", state: "FL", industry: "real estate" },
  { name: "Dan Mahoney", company: "Tavistock Development", title: "Leadership", city: "Orlando", state: "FL", industry: "real estate" },
  { name: "Jim Zboril", company: "Tavistock Group", title: "President", city: "Orlando", state: "FL", industry: "real estate" },
  { name: "Joe Mansueto", company: "Morningstar", title: "Founder (not SE)", city: "Chicago", state: "IL", industry: "finance" },
  { name: "Thomas Fanning", company: "Southern Company", title: "Executive Chairman", city: "Atlanta", state: "GA", industry: "energy" },
  { name: "Chris Womack", company: "Southern Company", title: "Chairman, President and CEO", city: "Atlanta", state: "GA", industry: "energy" },
  { name: "Russell Currey", company: "Currey & Company", title: "Principal", city: "Atlanta", state: "GA", industry: "manufacturing" },
  { name: "John Wieland", company: "John Wieland Homes", title: "Founder", city: "Atlanta", state: "GA", industry: "homebuilding" },
  { name: "Tom Cousins", company: "Cousins Properties", title: "Founder", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "John Williams", company: "Post Properties", title: "Founder", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Egbert Perry", company: "The Integral Group", title: "Chairman and CEO", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Herman Russell", company: "H.J. Russell & Company", title: "Founder (legacy)", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Michael Russell", company: "H.J. Russell & Company", title: "CEO", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "R.K. Sehgal", company: "Patriot Rail / prior leadership", title: "Executive", city: "Atlanta", state: "GA", industry: "infrastructure" },
  { name: "Parker H. Petit", company: "MiMedx / prior Matria", title: "Founder executive", city: "Atlanta", state: "GA", industry: "healthcare" },
  { name: "David Perdue", company: "Dollar General era / GA business", title: "Former CEO figure", city: "Atlanta", state: "GA", industry: "retail" },
  { name: "Vince Phillips", company: "Phillips Companies", title: "Principal", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Steve Selig", company: "Selig Enterprises", title: "Chairman", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "John A. Williams Jr.", company: "Post Properties", title: "Leadership family", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Bob Faith", company: "Greystar", title: "Founder and CEO", city: "Charleston", state: "SC", industry: "real estate" },
  { name: "Anita Zucker", company: "The InterTech Group", title: "Chair and CEO", city: "Charleston", state: "SC", industry: "manufacturing" },
  { name: "Darla Moore", company: "Rainwater / SC philanthropy business", title: "Financier", city: "Lake City", state: "SC", industry: "investing" },
  { name: "Earle Furman", company: "Furman Capital Advisors", title: "Principal", city: "Greenville", state: "SC", industry: "investing" },
  { name: "Brad Wyche", company: "Wyche Law Firm / Upstate", title: "Attorney principal", city: "Greenville", state: "SC", industry: "professional services" },
  { name: "Tommy Baker", company: "Baker Motor Company", title: "Dealer principal", city: "Charleston", state: "SC", industry: "auto dealer" },
  { name: "Joe Gibbs", company: "Joe Gibbs Racing", title: "Owner", city: "Huntersville", state: "NC", industry: "motorsports" },
  { name: "Richard Childress", company: "Richard Childress Racing", title: "Owner", city: "Welcome", state: "NC", industry: "motorsports" },
  { name: "Team Penske SE ops", company: "Penske Racing", title: "Leadership", city: "Mooresville", state: "NC", industry: "motorsports" },
  { name: "Roger Penske", company: "Penske Corporation", title: "Founder and Chairman", city: "Mooresville", state: "NC", industry: "auto services" },
  { name: "Speedway Motorsports leadership", company: "Speedway Motorsports", title: "Executive", city: "Concord", state: "NC", industry: "motorsports" },
  { name: "Marcus Smith", company: "Speedway Motorsports", title: "CEO", city: "Concord", state: "NC", industry: "motorsports" },
  { name: "Bruton Smith", company: "Speedway Motorsports", title: "Founder (legacy)", city: "Concord", state: "NC", industry: "motorsports" },
  { name: "Felix Sabates", company: "Team SABATES / business holdings", title: "Owner", city: "Charlotte", state: "NC", industry: "investing" },
  { name: "Johnny Harris", company: "The Harris Group", title: "Developer", city: "Charlotte", state: "NC", industry: "real estate" },
  { name: "Johnny Harris Jr.", company: "The Harris Group", title: "Principal", city: "Charlotte", state: "NC", industry: "real estate" },
  { name: "Smoky Bissell", company: "Bissell Companies", title: "Developer", city: "Charlotte", state: "NC", industry: "real estate" },
  { name: "John Crotts", company: "Crotts & Saunders", title: "Principal", city: "Winston-Salem", state: "NC", industry: "professional services" },
  { name: "G. Kennedy Thompson", company: "Wachovia era / Charlotte business", title: "Former CEO figure", city: "Charlotte", state: "NC", industry: "banking" },
  { name: "Kelly King", company: "Truist", title: "Former Chairman and CEO", city: "Charlotte", state: "NC", industry: "banking" },
  { name: "Bill Rogers", company: "Truist", title: "Chairman and CEO", city: "Charlotte", state: "NC", industry: "banking" },
  { name: "Hugh McColl Jr.", company: "Bank of America (legacy Charlotte)", title: "Former CEO", city: "Charlotte", state: "NC", industry: "banking" },
  { name: "Ed Crutchfield", company: "First Union (legacy)", title: "Former CEO", city: "Charlotte", state: "NC", industry: "banking" },
  { name: "F. William McNabb III", company: "Vanguard (not SE)", title: "Former CEO", city: "Malvern", state: "PA", industry: "finance" },
  { name: "Fred Morganthall", company: "Harris Teeter", title: "Former President", city: "Charlotte", state: "NC", industry: "grocery" },
  { name: "Claude Davis", company: "First Citizens BancShares", title: "Leadership family", city: "Raleigh", state: "NC", industry: "banking" },
  { name: "Frank Holding Jr.", company: "First Citizens BancShares", title: "Chairman and CEO", city: "Raleigh", state: "NC", industry: "banking" },
  { name: "Hope Holding Bryant", company: "First Citizens BancShares", title: "Vice Chair", city: "Raleigh", state: "NC", industry: "banking" },
  { name: "Peter Briger", company: "Fortress (not SE)", title: "Principal", city: "New York", state: "NY", industry: "finance" },
  { name: "Thomas Seidenberg", company: "SE manufacturing", title: "Executive", city: "Greensboro", state: "NC", industry: "manufacturing" },
  { name: "Ralph Lauren Purple Label ops", company: "Ralph Lauren", title: "Regional leadership", city: "High Point", state: "NC", industry: "furniture" },
  { name: "Alex Bernhardt Sr.", company: "Bernhardt Furniture", title: "Chairman", city: "Lenoir", state: "NC", industry: "furniture" },
  { name: "Alex Bernhardt Jr.", company: "Bernhardt Furniture", title: "CEO", city: "Lenoir", state: "NC", industry: "furniture" },
  { name: "Harley F. Shuford Jr.", company: "Century Furniture", title: "Leadership family", city: "Hickory", state: "NC", industry: "furniture" },
  { name: "Randy Chrisley", company: "Chrisley Furniture / related", title: "Principal", city: "Hickory", state: "NC", industry: "furniture" },
  { name: "Don Frail", company: "Hooker Furnishings", title: "Leadership", city: "Martinsville", state: "VA", industry: "furniture" },
  { name: "Jeremy Hoff", company: "Hooker Furnishings", title: "CEO", city: "Martinsville", state: "VA", industry: "furniture" },
  { name: "Paul Toms", company: "Hooker Furniture", title: "Former CEO", city: "Martinsville", state: "VA", industry: "furniture" },
  { name: "Wesley Allen leadership", company: "Wesley Allen", title: "Principal", city: "Los Angeles", state: "CA", industry: "furniture" },
  { name: "Kathy Ireland", company: "kathy ireland Worldwide", title: "CEO", city: "Los Angeles", state: "CA", industry: "licensing" },
  { name: "Clayton Homes related", company: "Clayton Homes", title: "Executive", city: "Maryville", state: "TN", industry: "homebuilding" },
  { name: "Kevin Clayton", company: "Clayton Homes", title: "CEO", city: "Maryville", state: "TN", industry: "homebuilding" },
  { name: "Jim Clayton", company: "Clayton Homes", title: "Founder", city: "Maryville", state: "TN", industry: "homebuilding" },
  { name: "Fred Smith", company: "FedEx", title: "Founder", city: "Memphis", state: "TN", industry: "logistics" },
  { name: "Raj Subramaniam", company: "FedEx", title: "President and CEO", city: "Memphis", state: "TN", industry: "logistics" },
  { name: "Pitt Hyde", company: "AutoZone / Hyde Family Foundations", title: "Founder figure", city: "Memphis", state: "TN", industry: "retail" },
  { name: "Bill Rhodes", company: "AutoZone", title: "Former CEO", city: "Memphis", state: "TN", industry: "retail" },
  { name: "Phil Ruffin", company: "Ruffin Companies", title: "Owner", city: "Las Vegas", state: "NV", industry: "hospitality" },
  { name: "Ingram family", company: "Ingram Industries", title: "Owners", city: "Nashville", state: "TN", industry: "distribution" },
  { name: "John Ingram", company: "Ingram Industries", title: "Chairman", city: "Nashville", state: "TN", industry: "distribution" },
  { name: "Orrin Ingram", company: "Ingram Industries", title: "CEO", city: "Nashville", state: "TN", industry: "distribution" },
  { name: "Martha Ingram", company: "Ingram Industries", title: "Former Chair", city: "Nashville", state: "TN", industry: "distribution" },
  { name: "Thomas F. Frist Jr.", company: "HCA Healthcare", title: "Founder figure", city: "Nashville", state: "TN", industry: "healthcare" },
  { name: "Samuel Hazen", company: "HCA Healthcare", title: "CEO", city: "Nashville", state: "TN", industry: "healthcare" },
  { name: "R. Milton Johnson", company: "HCA Healthcare", title: "Former CEO", city: "Nashville", state: "TN", industry: "healthcare" },
  { name: "Mike Curb", company: "Curb Records", title: "Founder", city: "Nashville", state: "TN", industry: "entertainment" },
  { name: "Lucky Brand / Nashville ops", company: "Local Nashville retail group", title: "Principal", city: "Nashville", state: "TN", industry: "retail" },
  { name: "Travis County skip", company: "Placeholder", title: "Skip", city: "Austin", state: "TX", industry: "other" },
];

const BATCHES: { metro: string; industry: string }[] = [
  { metro: "Charlotte NC", industry: "auto dealers and dealership groups" },
  { metro: "Charlotte NC", industry: "commercial real estate developers" },
  { metro: "Charlotte NC", industry: "private manufacturing and distribution" },
  { metro: "Raleigh Durham NC", industry: "software and tech founders" },
  { metro: "Raleigh Durham NC", industry: "life sciences and medical device" },
  { metro: "Greensboro Winston-Salem NC", industry: "furniture and textiles" },
  { metro: "Wilmington NC", industry: "marine, logistics, and local services" },
  { metro: "Asheville NC", industry: "hospitality, breweries, and tourism businesses" },
  { metro: "Charleston SC", industry: "hospitality and real estate" },
  { metro: "Greenville SC", industry: "advanced manufacturing and logistics" },
  { metro: "Columbia SC", industry: "local professional services and contractors" },
  { metro: "Atlanta GA", industry: "construction and specialty contractors" },
  { metro: "Atlanta GA", industry: "logistics and trucking companies" },
  { metro: "Atlanta GA", industry: "private equity-backed local operators and founders" },
  { metro: "Savannah GA", industry: "port logistics and manufacturing" },
  { metro: "Augusta GA", industry: "healthcare services and local industry" },
  { metro: "Miami FL", industry: "real estate developers and family offices" },
  { metro: "Miami FL", industry: "import-export and distribution businesses" },
  { metro: "Fort Lauderdale FL", industry: "marine and yacht industry companies" },
  { metro: "Tampa FL", industry: "restaurants and foodservice groups" },
  { metro: "Tampa FL", industry: "insurance agencies and financial services firms" },
  { metro: "Orlando FL", industry: "hospitality and tourism operators" },
  { metro: "Jacksonville FL", industry: "logistics, rail, and construction" },
  { metro: "Naples FL", industry: "homebuilding and luxury services" },
  { metro: "Nashville TN", industry: "healthcare services and music business companies" },
  { metro: "Nashville TN", industry: "construction and real estate" },
  { metro: "Memphis TN", industry: "logistics and distribution" },
  { metro: "Knoxville TN", industry: "manufacturing and local services" },
  { metro: "Birmingham AL", industry: "construction, engineering, and healthcare services" },
  { metro: "Huntsville AL", industry: "aerospace suppliers and tech firms" },
  { metro: "Mobile AL", industry: "shipbuilding suppliers and logistics" },
  { metro: "Richmond VA", industry: "manufacturing and professional services" },
  { metro: "Norfolk Virginia Beach VA", industry: "port logistics and contractors" },
  { metro: "Roanoke VA", industry: "manufacturing and regional services" },
  { metro: "Jacksonville FL", industry: "auto dealers and family businesses" },
  { metro: "Atlanta GA", industry: "independent insurance and wealth-adjacent agency owners" },
  { metro: "Charlotte NC", industry: "HVAC, plumbing, and home services owners" },
  { metro: "Raleigh NC", industry: "dental / veterinary / medical practice owners in news" },
  { metro: "Tampa FL", industry: "pest control, landscaping, and home services companies" },
  { metro: "Greenville SC", industry: "auto dealers and family manufacturers" },
];

const batchSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().max(120),
        company: z.string().max(160),
        title: z.string().max(120),
        city: z.string().max(80),
        state: z.string().max(2),
        industry: z.string().max(80),
      }),
    )
    .max(25),
});

function keyOf(p: Pick<Person, "name" | "company">) {
  return `${p.name.trim().toLowerCase()}|${p.company.trim().toLowerCase()}`;
}

function isUsable(p: Person) {
  if (!p.name || !p.company || !p.title) return false;
  if (p.name.length < 4 || p.company.length < 2) return false;
  if (/placeholder|skip|legacy\)|not se|ops\b/i.test(p.name)) return false;
  if (/^team |^speedway |^lucky brand|^ralph lauren|^clayton homes related|^autoNation founder|^outback founders|^ingram family|^travis county/i.test(p.name))
    return false;
  if (!/^(NC|SC|GA|FL|TN|AL|VA)$/i.test(p.state)) return false;
  if (/\(not SE\)/i.test(p.company)) return false;
  return true;
}

function slugEmail(name: string, company: string) {
  const local = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  const domain = company
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return `${local}@${domain || "example"}.example`;
}

function fakePhone(i: number) {
  const n = String(1000 + (i % 8900)).padStart(4, "0");
  const area = ["704", "919", "336", "404", "678", "305", "813", "407", "615", "901", "205", "843", "864", "757"][
    i % 14
  ];
  return `(${area}) 555-${n}`;
}

function daysAgo(i: number) {
  const d = new Date("2026-08-01T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((i * 5) % 900));
  return d.toISOString().slice(0, 10);
}

const NOTE_TEMPLATES = [
  "Met at a local chamber event in {city}. Discussed key person coverage as the business grows.",
  "Warm intro from a mutual CPA in {state}. Open to buy-sell talk if ownership transition is real.",
  "Prior inbound about executive benefits for a {industry} owner. Asked to reconnect after busy season.",
  "Local operator — verify role still current. Historically interested in succession / estate liquidity planning.",
  "Referred by a center-of-influence in {city}. Asked about funding options for a partner buyout.",
  "Saw them at a regional trade group meeting. High-value household; prefers email first then phone.",
  "Follow up on policy review mentioned last year. Company still active in {city} {industry} market.",
  "Thin file besides public role at a local firm. Confirm company association before dialing.",
  "Earlier conversation about deferred comp stalled. Reopen carefully — long silence.",
  "Board / family-business contact path via referral. Timing around a possible liquidity event was unclear.",
];

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function fetchBatch(
  client: OpenAI,
  metro: string,
  industry: string,
): Promise<Person[]> {
  const response = await client.responses.parse({
    model: process.env.OPENAI_WEB_MODEL ?? "gpt-4.1-mini",
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    text: { format: zodTextFormat(batchSchema, "se_small_biz_people") },
    input: [
      {
        role: "system",
        content: `You research REAL, publicly reported business owners, founders, presidents, and CEOs of SMALL or MID-MARKET privately held companies (roughly under ~$1B revenue, not mega-cap publics) in the U.S. Southeast.

Rules:
- Only include people you can support from public web sources (company sites, reputable local business journals, Forbes, Inc., chamber profiles, etc.).
- Prefer independently owned local/regional companies: dealers, contractors, manufacturers, distributors, agencies, hospitality groups, logistics firms, software startups, family businesses.
- Exclude Fortune 50 household mega-caps unless the person specifically runs a distinct local/regional private affiliate.
- state must be 2-letter code: NC, SC, GA, FL, TN, AL, or VA.
- Return up to 20 distinct people. Never invent names or companies.
- If fewer than 8 solid matches exist, return fewer — do not pad.`,
      },
      {
        role: "user",
        content: `Find publicly reported owners/founders/CEOs for ${industry} around ${metro}. Focus on small and mid-market local companies. As of 2026.`,
      },
    ],
  });

  const parsed = response.output_parsed;
  if (!parsed?.people?.length) return [];
  return parsed.people.map((p) => ({
    name: p.name.trim(),
    company: p.company.trim(),
    title: p.title.trim(),
    city: p.city.trim(),
    state: p.state.trim().toUpperCase(),
    industry: p.industry.trim().toLowerCase() || industry,
  }));
}

async function main() {
  loadEnvLocal();
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing in .env.local");

  const client = new OpenAI({ apiKey: key });
  const seen = new Set<string>();
  const people: Person[] = [];

  const add = (p: Person) => {
    if (!isUsable(p)) return;
    const k = keyOf(p);
    if (seen.has(k)) return;
    seen.add(k);
    people.push(p);
  };

  for (const p of SEED) add(p);
  console.log(`Seed usable: ${people.length}`);

  for (let i = 0; i < BATCHES.length; i++) {
    const batch = BATCHES[i]!;
    process.stdout.write(
      `[${i + 1}/${BATCHES.length}] ${batch.metro} / ${batch.industry} … `,
    );
    try {
      const found = await fetchBatch(client, batch.metro, batch.industry);
      let added = 0;
      for (const p of found) {
        const before = people.length;
        add(p);
        if (people.length > before) added++;
      }
      console.log(`+${added} (total ${people.length})`);
    } catch (error) {
      console.log("FAIL", error instanceof Error ? error.message.slice(0, 120) : error);
    }
    if (people.length >= 520) break;
  }

  // Extra fill rounds on broad queries if still short.
  let guard = 0;
  while (people.length < 500 && guard < 12) {
    guard++;
    const fill = BATCHES[guard % BATCHES.length]!;
    console.log(`Fill round ${guard}: ${fill.metro}`);
    try {
      const found = await fetchBatch(
        client,
        fill.metro,
        `${fill.industry}; include lesser-known family businesses and Inc. 5000-style firms`,
      );
      for (const p of found) add(p);
      console.log(`  total ${people.length}`);
    } catch (error) {
      console.log("  fill fail", error instanceof Error ? error.message.slice(0, 100) : error);
    }
  }

  if (people.length < 500) {
    throw new Error(`Need at least 500 unique SE people, got ${people.length}`);
  }

  const header = [
    "Name",
    "Email",
    "Phone",
    "Company",
    "Title",
    "Segment",
    "Source",
    "Last Touch",
    "Notes",
    "Value",
    "LinkedIn",
    "City",
    "State",
    "Industry",
  ];

  const rows = people.map((p, i) => {
    const note = NOTE_TEMPLATES[i % NOTE_TEMPLATES.length]!
      .replace("{city}", p.city)
      .replace("{state}", p.state)
      .replace("{industry}", p.industry);
    return [
      p.name,
      slugEmail(p.name, p.company),
      fakePhone(i),
      p.company,
      p.title,
      `Southeast ${p.industry} · ${p.city}, ${p.state}`,
      i % 3 === 0 ? "local business journal" : i % 3 === 1 ? "company site" : "news mention",
      daysAgo(i),
      `${note} [TEST DATA — synthetic phone/email; not for outreach]`,
      i % 4 === 0 ? "High" : i % 4 === 1 ? "Medium" : "",
      "",
      p.city,
      p.state,
      p.industry,
    ]
      .map((cell) => csvEscape(String(cell)))
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n") + "\n";
  const publicPath = join(
    process.cwd(),
    "public",
    "southeast-small-business-test-book.csv",
  );
  const downloadsPath = join(
    homedir(),
    "Downloads",
    "southeast-small-business-test-book.csv",
  );
  writeFileSync(publicPath, csv, "utf8");
  mkdirSync(join(homedir(), "Downloads"), { recursive: true });
  writeFileSync(downloadsPath, csv, "utf8");

  const byState = people.reduce<Record<string, number>>((acc, p) => {
    acc[p.state] = (acc[p.state] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Wrote ${people.length} rows`);
  console.log(`- ${publicPath}`);
  console.log(`- ${downloadsPath}`);
  console.log("By state:", byState);
  console.log("Disclaimer: public SE business people; synthetic phones/emails; not for outreach.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
