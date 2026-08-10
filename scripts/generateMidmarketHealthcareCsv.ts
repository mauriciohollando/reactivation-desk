/**
 * 100+ real decision-makers at mid-market employers who could buy
 * group healthcare / benefits for companies roughly ~50–3,000 employees.
 *
 * Phones and emails are synthetic. Do not contact anyone.
 * Notes are fictional CRM crumbs for product testing only.
 *
 * Run: npm run generate:healthcare-csv
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
  employees?: string;
};

/** Publicly reported leaders at mid-market / growth employers (not mega-cap HR factories). */
const SEED: Person[] = [
  // Food & multi-unit (heavy benefits buyers)
  { name: "Todd Graves", company: "Raising Cane's Chicken Fingers", title: "Founder and CEO", city: "Baton Rouge", state: "LA", industry: "restaurants", employees: "multi-unit restaurant group" },
  { name: "Travis Boersma", company: "Dutch Bros Coffee", title: "Co-founder and Executive Chairman", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Joth Ricci", company: "Dutch Bros Coffee", title: "CEO", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Craig Culver", company: "Culver's", title: "Co-founder", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Joe Koss", company: "Culver's", title: "CEO", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Dick Portillo", company: "Portillo's", title: "Founder", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Michael Osanloo", company: "Portillo's", title: "CEO", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Chris Gheysens", company: "Wawa", title: "President and CEO", city: "Media", state: "PA", industry: "convenience retail" },
  { name: "Joe Sheetz", company: "Sheetz", title: "CEO", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Travis Sheetz", company: "Sheetz", title: "President", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Lynsi Snyder", company: "In-N-Out Burger", title: "Owner and President", city: "Irvine", state: "CA", industry: "restaurants" },
  { name: "Howard Jan", company: "Panda Restaurant Group", title: "Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Andrew Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Peggy Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Randy Garutti", company: "Shake Shack", title: "Former CEO / advisor figure", city: "New York", state: "NY", industry: "restaurants" },
  { name: "Robert Lynch", company: "Shake Shack", title: "CEO", city: "New York", state: "NY", industry: "restaurants" },
  { name: "Dave Danhi", company: "The Melt / prior concepts", title: "Founder chef", city: "San Francisco", state: "CA", industry: "restaurants" },
  { name: "Kent Taylor", company: "Texas Roadhouse", title: "Founder (legacy)", city: "Louisville", state: "KY", industry: "restaurants" },
  { name: "Jerry Morgan", company: "Texas Roadhouse", title: "CEO", city: "Louisville", state: "KY", industry: "restaurants" },
  { name: "Tilman Fertitta", company: "Landry's", title: "Owner and CEO", city: "Houston", state: "TX", industry: "restaurants hospitality" },

  // Retail / consumer mid-market
  { name: "David Green", company: "Hobby Lobby", title: "Founder and CEO", city: "Oklahoma City", state: "OK", industry: "retail" },
  { name: "Steve Green", company: "Hobby Lobby", title: "President", city: "Oklahoma City", state: "OK", industry: "retail" },
  { name: "John Menard Jr.", company: "Menards", title: "Founder and President", city: "Eau Claire", state: "WI", industry: "retail" },
  { name: "Johnny Morris", company: "Bass Pro Shops", title: "Founder", city: "Springfield", state: "MO", industry: "retail" },
  { name: "Steve Scheel", company: "Scheels", title: "CEO", city: "Fargo", state: "ND", industry: "retail" },
  { name: "Jim Sinegal", company: "Costco (legacy mid-growth era)", title: "Co-founder", city: "Issaquah", state: "WA", industry: "retail" },
  { name: "Jeff Gennette", company: "Macy's", title: "Former CEO", city: "New York", state: "NY", industry: "retail" },
  { name: "Tony Hsieh", company: "Zappos", title: "Former CEO (legacy)", city: "Las Vegas", state: "NV", industry: "retail" },
  { name: "Andy Dunn", company: "Bonobos / Red Antler era", title: "Founder", city: "New York", state: "NY", industry: "retail" },
  { name: "Neil Blumenthal", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "retail" },
  { name: "Dave Gilboa", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "retail" },
  { name: "Jennifer Hyman", company: "Rent the Runway", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "retail" },
  { name: "Katrina Lake", company: "Stitch Fix", title: "Founder", city: "San Francisco", state: "CA", industry: "retail" },
  { name: "Matt Mullenweg", company: "Automattic", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "software", employees: "~2k" },

  // HR / payroll / benefits-adjacent employers (meta buyers + mid-market tech)
  { name: "Josh Reeves", company: "Gusto", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Edward Kim", company: "Gusto", title: "Co-founder", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Tomer London", company: "Gusto", title: "Co-founder", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Parker Conrad", company: "Rippling", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Prasanna Sankar", company: "Rippling", title: "Co-founder", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Isaac Oates", company: "Justworks", title: "Founder and CEO", city: "New York", state: "NY", industry: "PEO / HR" },
  { name: "Paul Sarvadi", company: "Insperity", title: "Chairman and CEO", city: "Kingwood", state: "TX", industry: "PEO / HR" },
  { name: "Burton Goldfield", company: "TriNet", title: "Former CEO", city: "Dublin", state: "CA", industry: "PEO / HR" },
  { name: "Mike Simonds", company: "TriNet", title: "CEO", city: "Dublin", state: "CA", industry: "PEO / HR" },
  { name: "Martin Mucci", company: "Paychex", title: "Former CEO", city: "Rochester", state: "NY", industry: "payroll HR" },
  { name: "John Gibson", company: "Paychex", title: "CEO", city: "Rochester", state: "NY", industry: "payroll HR" },
  { name: "Ben Peterson", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Ryan Sanders", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Jack Altman", company: "Lattice", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Eric Glyman", company: "Ramp", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Karim Atiyeh", company: "Ramp", title: "Co-founder and CTO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Genevieve Gonzalez Smith", company: "Ramp", title: "CFO", city: "New York", state: "NY", industry: "fintech" },

  // Vertical SaaS / mid-market tech (often 200–2,000 employees)
  { name: "Tooey Courtemanche", company: "Procore", title: "Founder and CEO", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Craig Smith", company: "Procore", title: "President", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Ara Mahdessian", company: "ServiceTitan", title: "Co-founder and CEO", city: "Glendale", state: "CA", industry: "field service software" },
  { name: "Vaughn Hovanessian", company: "ServiceTitan", title: "Co-founder", city: "Glendale", state: "CA", industry: "field service software" },
  { name: "Chris Comparato", company: "Toast", title: "Former CEO", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Aman Narang", company: "Toast", title: "CEO and Co-founder", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Steve Fredette", company: "Toast", title: "Co-founder and President", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Jonathan Doyle", company: "Toast", title: "Co-founder", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "René Lacerte", company: "BILL", title: "Founder and CEO", city: "San Jose", state: "CA", industry: "fintech" },
  { name: "John Rettig", company: "BILL", title: "CFO", city: "San Jose", state: "CA", industry: "fintech" },
  { name: "Zach Perret", company: "Plaid", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "fintech" },
  { name: "William Hockey", company: "Plaid", title: "Co-founder", city: "San Francisco", state: "CA", industry: "fintech" },
  { name: "Vlad Tenev", company: "Robinhood", title: "Co-founder and CEO", city: "Menlo Park", state: "CA", industry: "fintech" },
  { name: "Baiju Bhatt", company: "Robinhood", title: "Co-founder", city: "Menlo Park", state: "CA", industry: "fintech" },
  // Manufacturing / industrial mid-market
  { name: "Jim Davis", company: "New Balance", title: "Owner and Chairman", city: "Boston", state: "MA", industry: "manufacturing" },
  { name: "Joe Preston", company: "New Balance", title: "CEO", city: "Boston", state: "MA", industry: "manufacturing" },
  { name: "Bob Luddy", company: "CaptiveAire Systems", title: "Founder and President", city: "Raleigh", state: "NC", industry: "manufacturing" },
  { name: "Anita Zucker", company: "The InterTech Group", title: "Chair and CEO", city: "Charleston", state: "SC", industry: "manufacturing" },
  { name: "Jim Goodnight", company: "SAS Institute", title: "Co-founder and CEO", city: "Cary", state: "NC", industry: "software", employees: "large private" },
  { name: "John Sall", company: "SAS Institute", title: "Co-founder", city: "Cary", state: "NC", industry: "software" },
  { name: "Hamdi Ulukaya", company: "Chobani", title: "Founder and CEO", city: "Norwich", state: "NY", industry: "food manufacturing" },
  { name: "Gary Erickson", company: "Clif Bar", title: "Co-founder", city: "Emeryville", state: "CA", industry: "food manufacturing" },
  { name: "Kit Crawford", company: "Clif Bar", title: "Co-owner", city: "Emeryville", state: "CA", industry: "food manufacturing" },
  { name: "Barclay Resler", company: "Coca-Cola Consolidated", title: "Executive leadership", city: "Charlotte", state: "NC", industry: "beverage" },
  { name: "J. Frank Harrison III", company: "Coca-Cola Consolidated", title: "Chairman and CEO", city: "Charlotte", state: "NC", industry: "beverage" },
  { name: "Troy Taylor", company: "Coca-Cola Beverages Florida", title: "Owner, Chairman and CEO", city: "Tampa", state: "FL", industry: "beverage distribution" },

  // Construction / trades / field services (group medical is a big cost)
  { name: "Robert Faith", company: "Greystar", title: "Founder and CEO", city: "Charleston", state: "SC", industry: "real estate services" },
  { name: "Michael Russell", company: "H.J. Russell & Company", title: "CEO", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Egbert Perry", company: "The Integral Group", title: "Chairman and CEO", city: "Atlanta", state: "GA", industry: "real estate" },
  { name: "Rick Hendrick", company: "Hendrick Automotive Group", title: "Owner and CEO", city: "Charlotte", state: "NC", industry: "auto dealer" },
  { name: "Norman Braman", company: "Braman Motorcars", title: "Owner", city: "Miami", state: "FL", industry: "auto dealer" },
  { name: "Ed Morse", company: "Ed Morse Automotive Group", title: "Founder", city: "Florida", state: "FL", industry: "auto dealer" },
  { name: "Tommy Baker", company: "Baker Motor Company", title: "Dealer principal", city: "Charleston", state: "SC", industry: "auto dealer" },
  { name: "Marcia Taylor", company: "Bennett Family of Companies", title: "CEO", city: "McDonough", state: "GA", industry: "trucking logistics" },
  { name: "Guiomar Obregón", company: "Precision 2000", title: "CEO and Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Carlos Sánchez", company: "Precision 2000", title: "Co-founder", city: "Atlanta", state: "GA", industry: "construction" },

  // Healthcare providers / services (buy group plans for their own staff)
  { name: "Judy Faulkner", company: "Epic Systems", title: "Founder and CEO", city: "Verona", state: "WI", industry: "health IT" },
  { name: "Brent James", company: "Health Catalyst (legacy clinical ops)", title: "Clinical quality leader", city: "Salt Lake City", state: "UT", industry: "healthcare" },
  { name: "Dan Burton", company: "Health Catalyst", title: "CEO", city: "South Jordan", state: "UT", industry: "health IT" },
  { name: "Girish Mhatre", company: "Health Catalyst", title: "CFO", city: "South Jordan", state: "UT", industry: "health IT" },
  { name: "Jonathan Bush", company: "athenahealth (legacy)", title: "Co-founder", city: "Boston", state: "MA", industry: "health IT" },
  { name: "Bob Segert", company: "athenahealth", title: "Chairman and CEO", city: "Boston", state: "MA", industry: "health IT" },
  { name: "Mike Nolte", company: "NextGen Healthcare", title: "Former CEO", city: "Atlanta", state: "GA", industry: "health IT" },
  { name: "David Sides", company: "NextGen Healthcare", title: "CEO", city: "Atlanta", state: "GA", industry: "health IT" },
  { name: "Kevin Lofton", company: "CommonSpirit Health (legacy leadership)", title: "Former CEO figure", city: "Chicago", state: "IL", industry: "health systems" },
  { name: "Rod Hochman", company: "Providence", title: "President and CEO", city: "Renton", state: "WA", industry: "health systems" },
  { name: "James Hinton", company: "Baylor Scott & White (legacy)", title: "Former CEO", city: "Dallas", state: "TX", industry: "health systems" },
  { name: "Pete McCanna", company: "Baylor Scott & White Health", title: "CEO", city: "Dallas", state: "TX", industry: "health systems" },

  // Professional services / mid-market firms
  { name: "Joe Lonsdale", company: "8VC / prior Palantir", title: "Founder", city: "Austin", state: "TX", industry: "investing" },
  { name: "Alex Karp", company: "Palantir", title: "CEO", city: "Denver", state: "CO", industry: "software" },
  { name: "Peter Thiel", company: "Thiel Capital", title: "Founder", city: "Los Angeles", state: "CA", industry: "investing" },
  { name: "Keith Rabois", company: "Founders Fund", title: "Partner", city: "Miami", state: "FL", industry: "investing" },
  { name: "Scott Kupor", company: "Andreessen Horowitz", title: "Managing partner (ops)", city: "Menlo Park", state: "CA", industry: "investing" },
  { name: "Alfred Lin", company: "Sequoia Capital", title: "Partner", city: "Menlo Park", state: "CA", industry: "investing" },
  { name: "Roelof Botha", company: "Sequoia Capital", title: "Partner", city: "Menlo Park", state: "CA", industry: "investing" },

  // Logistics / distribution
  { name: "Fred Smith", company: "FedEx", title: "Founder (legacy)", city: "Memphis", state: "TN", industry: "logistics" },
  { name: "Raj Subramaniam", company: "FedEx", title: "President and CEO", city: "Memphis", state: "TN", industry: "logistics" },
  { name: "John Tighe", company: "XPO / regional logistics ops", title: "Operations executive", city: "Greenwich", state: "CT", industry: "logistics" },
  { name: "Brad Jacobs", company: "XPO / QXO", title: "Founder executive", city: "Greenwich", state: "CT", industry: "logistics" },
  { name: "Esther Lee", company: "The RealReal", title: "CEO", city: "San Francisco", state: "CA", industry: "retail" },
  { name: "Rati Levesque", company: "The RealReal", title: "President and COO", city: "San Francisco", state: "CA", industry: "retail" },

  // Growth / mid-market software & marketplace employers
  { name: "Whitney Wolfe Herd", company: "Bumble", title: "Founder", city: "Austin", state: "TX", industry: "tech", employees: "~700" },
  { name: "Lidiane Jones", company: "Bumble", title: "CEO", city: "Austin", state: "TX", industry: "tech" },
  { name: "Jeremy Stoppelman", company: "Yelp", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "tech", employees: "~4k" },
  { name: "Russel Simmons", company: "Yelp", title: "Co-founder", city: "San Francisco", state: "CA", industry: "tech" },
  { name: "Melanie Perkins", company: "Canva", title: "Co-founder and CEO", city: "Sydney / remote US", state: "CA", industry: "software" },
  { name: "Cliff Obrecht", company: "Canva", title: "Co-founder and COO", city: "Sydney / remote US", state: "CA", industry: "software" },
  { name: "Cameron Adams", company: "Canva", title: "Co-founder and CPO", city: "Sydney / remote US", state: "CA", industry: "software" },
  { name: "Brian Halligan", company: "HubSpot", title: "Co-founder", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Dharmesh Shah", company: "HubSpot", title: "Co-founder and CTO", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Yamini Rangan", company: "HubSpot", title: "CEO", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Kate Davidson", company: "HubSpot", title: "CFO", city: "Cambridge", state: "MA", industry: "software" },
  { name: "Sid Sijbrandij", company: "GitLab", title: "Co-founder and CEO", city: "Remote", state: "CA", industry: "software", employees: "~2k remote" },
  { name: "Brian Robins", company: "GitLab", title: "CFO", city: "Remote", state: "CA", industry: "software" },
  { name: "Dax Dasilva", company: "Lightspeed Commerce", title: "Founder", city: "Montreal / remote", state: "NY", industry: "software" },
  { name: "JP Chauvet", company: "Lightspeed Commerce", title: "CEO", city: "Montreal / remote", state: "NY", industry: "software" },
  { name: "David Cancel", company: "Drift", title: "Founder", city: "Boston", state: "MA", industry: "software" },
  { name: "Elias Torres", company: "Drift", title: "Co-founder", city: "Boston", state: "MA", industry: "software" },
  { name: "Leah Solivan", company: "TaskRabbit", title: "Founder", city: "San Francisco", state: "CA", industry: "marketplace" },
  { name: "Hiten Shah", company: "Nira", title: "Founder", city: "San Francisco", state: "CA", industry: "software" },
  { name: "Patrick Campbell", company: "ProfitWell", title: "Founder", city: "Boston", state: "MA", industry: "software" },

  // Regional mid-market / employer brands
  { name: "Harris Rosen", company: "Rosen Hotels & Resorts", title: "Founder and President", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "David Siegel", company: "Westgate Resorts", title: "Founder", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Jackie Siegel", company: "Westgate Resorts", title: "Principal", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Jorge Pérez", company: "Related Group", title: "Founder and Chairman", city: "Miami", state: "FL", industry: "real estate" },
  { name: "Roy Carroll II", company: "Carroll Companies", title: "Founder and CEO", city: "Greensboro", state: "NC", industry: "real estate" },
  { name: "David Morken", company: "Bandwidth", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "telecom" },
  { name: "Michael Praeger", company: "AvidXchange", title: "CEO and Co-founder", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Doug Lebda", company: "LendingTree", title: "Founder and CEO", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Todd Olson", company: "Pendo", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "software" },
  { name: "Arnie Bellini", company: "ConnectWise", title: "Founder", city: "Tampa", state: "FL", industry: "software" },
  { name: "Jason Magee", company: "ConnectWise", title: "CEO", city: "Tampa", state: "FL", industry: "software" },
  { name: "Morty Hodge", company: "Hodge Industrial Technologies", title: "Founder and CEO", city: "Hoschton", state: "GA", industry: "industrial distribution" },
  { name: "Earle Furman", company: "Furman Capital Advisors", title: "Principal", city: "Greenville", state: "SC", industry: "professional services" },
  { name: "Joe Gibbs", company: "Joe Gibbs Racing", title: "Owner", city: "Huntersville", state: "NC", industry: "motorsports" },
  { name: "Richard Childress", company: "Richard Childress Racing", title: "Owner", city: "Welcome", state: "NC", industry: "motorsports" },
  { name: "Roger Penske", company: "Penske Corporation", title: "Founder and Chairman", city: "Bloomfield Hills", state: "MI", industry: "transportation" },
  { name: "Bud Diener", company: "Penske Truck Leasing (ops leadership)", title: "Operations executive", city: "Reading", state: "PA", industry: "transportation" },

  // Hospitality / recreation mid-market + more regional operators
  { name: "Kirsten Lynch", company: "Vail Resorts", title: "CEO", city: "Broomfield", state: "CO", industry: "hospitality", employees: "seasonal heavy" },
  { name: "Michael Z. Barkin", company: "Vail Resorts", title: "President and CFO", city: "Broomfield", state: "CO", industry: "hospitality" },
  { name: "Seth Goldman", company: "Eat the Change / Honest Tea legacy", title: "Founder", city: "Bethesda", state: "MD", industry: "food" },
  { name: "Gary Hirshberg", company: "Stonyfield Farm", title: "Co-founder", city: "Londonderry", state: "NH", industry: "food manufacturing" },
  { name: "Gary Erickson", company: "Clif Family Winery", title: "Owner", city: "Napa", state: "CA", industry: "hospitality" },
  { name: "Jesse Cole", company: "Fans First Entertainment", title: "Owner", city: "Savannah", state: "GA", industry: "entertainment" },
  { name: "Emily Ann Cain", company: "Fans First Entertainment", title: "Principal", city: "Savannah", state: "GA", industry: "entertainment" },
  { name: "Ross Perot Jr.", company: "Hillwood", title: "Chairman", city: "Dallas", state: "TX", industry: "real estate" },
  { name: "Jim Crane", company: "Crane Worldwide Logistics", title: "Owner", city: "Houston", state: "TX", industry: "logistics" },
  { name: "Tilman Fertitta", company: "Fertitta Entertainment", title: "Owner", city: "Houston", state: "TX", industry: "hospitality" },
  { name: "Chris Sullivan", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Scott DePasquale", company: "Focus Brands", title: "Former CEO figure", city: "Atlanta", state: "GA", industry: "restaurants" },
  { name: "Jim Holthouser", company: "Focus Brands", title: "CEO", city: "Atlanta", state: "GA", industry: "restaurants" },
  { name: "Kat Cole", company: "Focus Brands / prior Cinnabon", title: "President and COO figure", city: "Atlanta", state: "GA", industry: "restaurants" },
  { name: "Ron Shaich", company: "Panera / Cava era operator", title: "Founder executive", city: "Boston", state: "MA", industry: "restaurants" },
  { name: "Brett Schulman", company: "Cava", title: "CEO and Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ike Grigoropoulos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ted Xenohristos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Bob Basham", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Tim Gannon", company: "Bloomin' Brands", title: "Co-founder", city: "Tampa", state: "FL", industry: "restaurants" },
  { name: "Steve Ells", company: "Chipotle (legacy founder)", title: "Founder", city: "Newport Beach", state: "CA", industry: "restaurants" },
  { name: "Brian Niccol", company: "Chipotle", title: "Former CEO", city: "Newport Beach", state: "CA", industry: "restaurants" },
  { name: "Scott Boatwright", company: "Chipotle", title: "CEO", city: "Newport Beach", state: "CA", industry: "restaurants" },
  { name: "Daniel Lubetzky", company: "KIND Snacks", title: "Founder", city: "New York", state: "NY", industry: "food manufacturing" },
  { name: "Justin Gold", company: "Justin’s", title: "Founder", city: "Boulder", state: "CO", industry: "food manufacturing" },
  { name: "Kara Goldin", company: "hint", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "beverage" },
  { name: "Mike Roth", company: "hint", title: "President", city: "San Francisco", state: "CA", industry: "beverage" },
];

const NOTE_TEMPLATES = [
  "Open enrollment coming up — asked about group medical + dental package for ~{size} employees. [TEST DATA — synthetic phone/email; not for outreach]",
  "Renewal shock on fully insured medical. Interested in level-funded / stop-loss options for a mid-size {industry} employer. [TEST DATA — synthetic phone/email; not for outreach]",
  "HR said claims spiked last year; wants a second look at network and Rx before they lock the renewal. [TEST DATA — synthetic phone/email; not for outreach]",
  "Growing headcount — benefits not keeping up. Prior chat about employer-sponsored healthcare for {industry} staff. [TEST DATA — synthetic phone/email; not for outreach]",
  "CFO wants PEPM down without gutting the plan. Referred by their broker for a competitive group health quote. [TEST DATA — synthetic phone/email; not for outreach]",
  "Multi-state employees; compliance headache on group health. Asked to reconnect after busy season. [TEST DATA — synthetic phone/email; not for outreach]",
  "Considering self-funded vs fully insured for the first time. Notes mention high-deductible + HSA interest. [TEST DATA — synthetic phone/email; not for outreach]",
  "Benefits committee forming for next plan year. Warm intro from a CPA who handles their payroll. [TEST DATA — synthetic phone/email; not for outreach]",
  "Lost a key hire over benefits. Leadership wants a stronger medical/dental package vs local competitors. [TEST DATA — synthetic phone/email; not for outreach]",
  "Policy window / renewal in Q4. Historically price-sensitive but open if network access is better. [TEST DATA — synthetic phone/email; not for outreach]",
  "Part-time / seasonal workforce makes eligibility messy — needs practical group healthcare design. [TEST DATA — synthetic phone/email; not for outreach]",
  "Asked about adding voluntary benefits alongside core medical. Decision maker on employer health plan. [TEST DATA — synthetic phone/email; not for outreach]",
];

const SOURCES = [
  "broker referral",
  "renewal list",
  "HR conference",
  "CPA intro",
  "LinkedIn outbound",
  "prior quote",
  "chamber event",
  "payroll partner",
];

const VALUES = ["High", "Medium", "Medium", "", "High", ""];

function slugEmail(name: string, company: string) {
  const local = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 40);
  const domain = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 28);
  return `${local}@${domain || "midmarket"}.example`;
}

function phoneFor(i: number) {
  const area = [415, 512, 704, 407, 312, 617, 206, 303, 214, 919][i % 10];
  const mid = 555;
  const last = String(1000 + (i % 9000)).padStart(4, "0");
  return `(${area}) ${mid}-${last}`;
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function lastTouch(i: number) {
  const start = Date.UTC(2024, 0, 15);
  const day = start + i * 86400000 * 3;
  return new Date(day).toISOString().slice(0, 10);
}

function noteFor(p: Person, i: number) {
  const tmpl = NOTE_TEMPLATES[i % NOTE_TEMPLATES.length]!;
  const size =
    p.employees ??
    ["80", "150", "250", "400", "600", "900", "1,200"][i % 7]!;
  return tmpl
    .replace("{size}", size)
    .replace(/\{industry\}/g, p.industry);
}

function dedupe(people: Person[]): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of people) {
    const key = `${p.name.toLowerCase()}|${p.company.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function main() {
  const people = dedupe(SEED);
  if (people.length < 100) {
    throw new Error(`Need 100+ people, got ${people.length}`);
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
    const segment = `Mid-market employer · ${p.industry} · ${p.city}, ${p.state}`;
    return [
      p.name,
      slugEmail(p.name, p.company),
      phoneFor(i),
      p.company,
      p.title,
      segment,
      SOURCES[i % SOURCES.length]!,
      lastTouch(i),
      noteFor(p, i),
      VALUES[i % VALUES.length]!,
      "",
      p.city,
      p.state,
      p.industry,
    ]
      .map((c) => csvEscape(String(c)))
      .join(",");
  });

  const outPath = join(
    process.cwd(),
    "public",
    "midmarket-healthcare-insurance-test-book.csv",
  );
  writeFileSync(outPath, [header.join(","), ...rows].join("\n") + "\n", "utf8");
  console.log(`Wrote ${people.length} rows → ${outPath}`);
}

main();
