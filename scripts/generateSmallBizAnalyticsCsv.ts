/**
 * 100+ real decision-makers at small / SMB companies who could buy
 * data analysis, reporting, BI, or analytics consulting services.
 *
 * Phones and emails are synthetic. Do not contact anyone.
 * Notes are fictional CRM crumbs for product testing only.
 *
 * Run: npm run generate:analytics-csv
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
  sizeHint?: string;
};

/** Publicly reported founders / operators at small & SMB-scale companies. */
const SEED: Person[] = [
  // DTC / ecom / brands (heavy analytics buyers)
  { name: "Emily Weiss", company: "Glossier", title: "Founder", city: "New York", state: "NY", industry: "DTC beauty", sizeHint: "SMB brand" },
  { name: "Jen Rubio", company: "Away", title: "Co-founder and Executive Chairman", city: "New York", state: "NY", industry: "DTC travel" },
  { name: "Steph Korey", company: "Away", title: "Co-founder", city: "New York", state: "NY", industry: "DTC travel" },
  { name: "Christina Stembel", company: "Farmgirl Flowers", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "DTC flowers" },
  { name: "Bea Johnson", company: "Zero Waste Home (ops brand)", title: "Founder", city: "San Francisco", state: "CA", industry: "consumer" },
  { name: "Beau Laughlin", company: "Huckberry", title: "Co-founder", city: "San Francisco", state: "CA", industry: "DTC retail" },
  { name: "Andy Dunn", company: "Bonobos", title: "Founder", city: "New York", state: "NY", industry: "DTC apparel" },
  { name: "Brian Spaly", company: "Trunk Club / prior Bonobos", title: "Founder", city: "Chicago", state: "IL", industry: "DTC apparel" },
  { name: "Katrina Lake", company: "Stitch Fix", title: "Founder", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Jennifer Hyman", company: "Rent the Runway", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "DTC fashion" },
  { name: "Jennifer Fleiss", company: "Rent the Runway", title: "Co-founder", city: "New York", state: "NY", industry: "DTC fashion" },
  { name: "Neil Blumenthal", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "DTC eyewear" },
  { name: "Dave Gilboa", company: "Warby Parker", title: "Co-founder and Co-CEO", city: "New York", state: "NY", industry: "DTC eyewear" },
  { name: "Michael Preysman", company: "Everlane", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Aman Advani", company: "Ministry of Supply", title: "Co-founder", city: "Boston", state: "MA", industry: "DTC apparel" },
  { name: "Gihan Amarasiriwardena", company: "Ministry of Supply", title: "Co-founder and President", city: "Boston", state: "MA", industry: "DTC apparel" },
  { name: "Kyle Smithee", company: "American Giant", title: "CEO", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Bayard Winthrop", company: "American Giant", title: "Founder", city: "San Francisco", state: "CA", industry: "DTC apparel" },
  { name: "Jake Kassan", company: "MVMT (legacy)", title: "Co-founder", city: "Los Angeles", state: "CA", industry: "DTC watches" },
  { name: "Kris Kang", company: "MVMT (legacy)", title: "Co-founder", city: "Los Angeles", state: "CA", industry: "DTC watches" },
  { name: "Tina Roth Eisenberg", company: "Tattly", title: "Founder", city: "New York", state: "NY", industry: "creative SMB" },
  { name: "Gary Vaynerchuk", company: "VaynerMedia", title: "Chairman", city: "New York", state: "NY", industry: "agency", sizeHint: "growing agency" },
  { name: "AJ Vaynerchuk", company: "VaynerMedia", title: "CEO", city: "New York", state: "NY", industry: "agency" },

  // Food / CPG / local brands
  { name: "Daniel Lubetzky", company: "KIND Snacks", title: "Founder", city: "New York", state: "NY", industry: "CPG" },
  { name: "Justin Gold", company: "Justin’s", title: "Founder", city: "Boulder", state: "CO", industry: "CPG" },
  { name: "Kara Goldin", company: "hint", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "beverage" },
  { name: "Mike Roth", company: "hint", title: "President", city: "San Francisco", state: "CA", industry: "beverage" },
  { name: "Seth Goldman", company: "Eat the Change", title: "Founder", city: "Bethesda", state: "MD", industry: "CPG" },
  { name: "Gary Hirshberg", company: "Stonyfield Farm", title: "Co-founder", city: "Londonderry", state: "NH", industry: "CPG" },
  { name: "Hamdi Ulukaya", company: "Chobani", title: "Founder and CEO", city: "Norwich", state: "NY", industry: "CPG" },
  { name: "Gary Erickson", company: "Clif Bar", title: "Co-founder", city: "Emeryville", state: "CA", industry: "CPG" },
  { name: "Kit Crawford", company: "Clif Bar", title: "Co-owner", city: "Emeryville", state: "CA", industry: "CPG" },
  { name: "Irving Barber", company: "Irving Farm Coffee Roasters", title: "Co-owner", city: "New York", state: "NY", industry: "coffee" },
  { name: "David Anderson", company: "Irving Farm Coffee Roasters", title: "Co-owner", city: "New York", state: "NY", industry: "coffee" },
  { name: "Tony Chen", company: "Boba Guys", title: "Co-founder", city: "San Francisco", state: "CA", industry: "restaurants" },
  { name: "Bin Chen", company: "Boba Guys", title: "Co-founder", city: "San Francisco", state: "CA", industry: "restaurants" },
  { name: "Andrew Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Peggy Cherng", company: "Panda Restaurant Group", title: "Co-founder and Co-CEO", city: "Rosemead", state: "CA", industry: "restaurants" },
  { name: "Craig Culver", company: "Culver's", title: "Co-founder", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Joe Koss", company: "Culver's", title: "CEO", city: "Prairie du Sac", state: "WI", industry: "restaurants" },
  { name: "Dick Portillo", company: "Portillo's", title: "Founder", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Michael Osanloo", company: "Portillo's", title: "CEO", city: "Oak Brook", state: "IL", industry: "restaurants" },
  { name: "Travis Boersma", company: "Dutch Bros Coffee", title: "Co-founder", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Joth Ricci", company: "Dutch Bros Coffee", title: "CEO", city: "Grants Pass", state: "OR", industry: "restaurants" },
  { name: "Todd Graves", company: "Raising Cane's Chicken Fingers", title: "Founder and CEO", city: "Baton Rouge", state: "LA", industry: "restaurants" },
  { name: "Brett Schulman", company: "Cava", title: "CEO and Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ike Grigoropoulos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Ted Xenohristos", company: "Cava", title: "Co-founder", city: "Washington", state: "DC", industry: "restaurants" },
  { name: "Jesse Cole", company: "Fans First Entertainment", title: "Owner", city: "Savannah", state: "GA", industry: "entertainment" },
  { name: "Emily Ann Cain", company: "Fans First Entertainment", title: "Principal", city: "Savannah", state: "GA", industry: "entertainment" },

  // Local services / agencies / consultancies (classic analytics clients)
  { name: "Marie Forleo", company: "Marie Forleo International", title: "Founder", city: "New York", state: "NY", industry: "education brand" },
  { name: "Pat Flynn", company: "SPI Media", title: "Founder", city: "San Diego", state: "CA", industry: "education brand" },
  { name: "Chris Brogan", company: "Owner Media Group", title: "Founder", city: "Boston", state: "MA", industry: "agency" },
  { name: "Ann Handley", company: "MarketingProfs", title: "Chief Content Officer", city: "Boston", state: "MA", industry: "media SMB" },
  { name: "Joe Pulizzi", company: "The Tilt", title: "Founder", city: "Cleveland", state: "OH", industry: "media SMB" },
  { name: "Jay Baer", company: "Convince & Convert", title: "Founder", city: "Bloomington", state: "IN", industry: "agency" },
  { name: "Rand Fishkin", company: "SparkToro", title: "Co-founder and CEO", city: "Seattle", state: "WA", industry: "SaaS SMB", sizeHint: "20–50" },
  { name: "Casey Henry", company: "SparkToro", title: "Co-founder", city: "Seattle", state: "WA", industry: "SaaS SMB" },
  { name: "Hiten Shah", company: "Nira", title: "Founder", city: "San Francisco", state: "CA", industry: "SaaS SMB" },
  { name: "Patrick Campbell", company: "ProfitWell", title: "Founder", city: "Boston", state: "MA", industry: "SaaS SMB" },
  { name: "Lincoln Murphy", company: "Sixteen Ventures", title: "Principal", city: "Austin", state: "TX", industry: "consulting", sizeHint: "solo firm" },
  { name: "Steli Efti", company: "Close", title: "CEO and Co-founder", city: "San Francisco", state: "CA", industry: "SaaS SMB" },
  { name: "Anthony Kennada", company: "Winsome", title: "Founder", city: "San Francisco", state: "CA", industry: "consulting" },
  { name: "April Dunford", company: "Ambient Strategy", title: "Founder", city: "Toronto / remote", state: "NY", industry: "consulting", sizeHint: "solo practice" },
  { name: "Wes Bush", company: "ProductLed", title: "Founder", city: "Toronto / remote", state: "NY", industry: "consulting" },
  { name: "Emily Kramer", company: "MKT1", title: "Founder", city: "San Francisco", state: "CA", industry: "consulting" },

  // SMB software / tooling companies (buy analytics for their own ops)
  { name: "Jason Fried", company: "37signals", title: "Co-founder", city: "Chicago", state: "IL", industry: "SaaS SMB", sizeHint: "50–80" },
  { name: "David Heinemeier Hansson", company: "37signals", title: "Co-founder", city: "Chicago", state: "IL", industry: "SaaS SMB" },
  { name: "Bob Moesta", company: "The Re-Wired Group", title: "Founder", city: "Detroit", state: "MI", industry: "consulting" },
  { name: "Wade Foster", company: "Zapier", title: "Co-founder and CEO", city: "Remote", state: "CA", industry: "SaaS" },
  { name: "Bryan Helmig", company: "Zapier", title: "Co-founder", city: "Remote", state: "CA", industry: "SaaS" },
  { name: "Mike Knoop", company: "Zapier", title: "Co-founder", city: "Remote", state: "CA", industry: "SaaS" },
  { name: "Tope Awotona", company: "Calendly", title: "Founder and CEO", city: "Atlanta", state: "GA", industry: "SaaS" },
  { name: "Suresh Konduru", company: "Calendly", title: "CFO", city: "Atlanta", state: "GA", industry: "SaaS" },
  { name: "Eric Ries", company: "Long-Term Stock Exchange", title: "Founder", city: "San Francisco", state: "CA", industry: "fintech SMB" },
  { name: "Steve Blank", company: "Steve Blank LLC", title: "Educator / operator", city: "Pescadero", state: "CA", industry: "education" },
  { name: "Des Traynor", company: "Intercom", title: "Co-founder", city: "San Francisco", state: "CA", industry: "SaaS" },
  { name: "Eoghan McCabe", company: "Intercom", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "SaaS" },

  // Regional small / mid operators (accounting, trades, local chains)
  { name: "Bob Luddy", company: "CaptiveAire Systems", title: "Founder and President", city: "Raleigh", state: "NC", industry: "manufacturing" },
  { name: "Roy Carroll II", company: "Carroll Companies", title: "Founder and CEO", city: "Greensboro", state: "NC", industry: "real estate" },
  { name: "David Morken", company: "Bandwidth", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "telecom" },
  { name: "Michael Praeger", company: "AvidXchange", title: "CEO and Co-founder", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Doug Lebda", company: "LendingTree", title: "Founder and CEO", city: "Charlotte", state: "NC", industry: "fintech" },
  { name: "Todd Olson", company: "Pendo", title: "CEO and Co-founder", city: "Raleigh", state: "NC", industry: "software" },
  { name: "Arnie Bellini", company: "ConnectWise", title: "Founder", city: "Tampa", state: "FL", industry: "software" },
  { name: "Jason Magee", company: "ConnectWise", title: "CEO", city: "Tampa", state: "FL", industry: "software" },
  { name: "Morty Hodge", company: "Hodge Industrial Technologies", title: "Founder and CEO", city: "Hoschton", state: "GA", industry: "distribution" },
  { name: "Guiomar Obregón", company: "Precision 2000", title: "CEO and Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Carlos Sánchez", company: "Precision 2000", title: "Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Marcia Taylor", company: "Bennett Family of Companies", title: "CEO", city: "McDonough", state: "GA", industry: "logistics" },
  { name: "Tommy Baker", company: "Baker Motor Company", title: "Dealer principal", city: "Charleston", state: "SC", industry: "auto dealer" },
  { name: "Harris Rosen", company: "Rosen Hotels & Resorts", title: "Founder and President", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "David Siegel", company: "Westgate Resorts", title: "Founder", city: "Orlando", state: "FL", industry: "hospitality" },
  { name: "Earle Furman", company: "Furman Capital Advisors", title: "Principal", city: "Greenville", state: "SC", industry: "advisory" },
  { name: "Anita Zucker", company: "The InterTech Group", title: "Chair and CEO", city: "Charleston", state: "SC", industry: "manufacturing" },
  { name: "Rick Hendrick", company: "Hendrick Automotive Group", title: "Owner and CEO", city: "Charlotte", state: "NC", industry: "auto dealer" },
  { name: "Joe Gibbs", company: "Joe Gibbs Racing", title: "Owner", city: "Huntersville", state: "NC", industry: "motorsports" },
  { name: "Richard Childress", company: "Richard Childress Racing", title: "Owner", city: "Welcome", state: "NC", industry: "motorsports" },

  // Marketplaces / SMB platforms & operators who sell *to* small businesses
  { name: "Leah Solivan", company: "TaskRabbit", title: "Founder", city: "San Francisco", state: "CA", industry: "marketplace" },
  { name: "Aman Narang", company: "Toast", title: "CEO and Co-founder", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Steve Fredette", company: "Toast", title: "Co-founder and President", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Jonathan Doyle", company: "Toast", title: "Co-founder", city: "Boston", state: "MA", industry: "restaurant tech" },
  { name: "Ara Mahdessian", company: "ServiceTitan", title: "Co-founder and CEO", city: "Glendale", state: "CA", industry: "field service software" },
  { name: "Vaughn Hovanessian", company: "ServiceTitan", title: "Co-founder", city: "Glendale", state: "CA", industry: "field service software" },
  { name: "Tooey Courtemanche", company: "Procore", title: "Founder and CEO", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Josh Reeves", company: "Gusto", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Edward Kim", company: "Gusto", title: "Co-founder", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Tomer London", company: "Gusto", title: "Co-founder", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "Isaac Oates", company: "Justworks", title: "Founder and CEO", city: "New York", state: "NY", industry: "PEO" },
  { name: "Ben Peterson", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Ryan Sanders", company: "BambooHR", title: "Co-founder", city: "Lindon", state: "UT", industry: "HR tech" },
  { name: "Jack Altman", company: "Lattice", title: "Co-founder and CEO", city: "San Francisco", state: "CA", industry: "HR tech" },
  { name: "René Lacerte", company: "BILL", title: "Founder and CEO", city: "San Jose", state: "CA", industry: "fintech" },
  { name: "John Rettig", company: "BILL", title: "CFO", city: "San Jose", state: "CA", industry: "fintech" },
  { name: "Eric Glyman", company: "Ramp", title: "Co-founder and CEO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Karim Atiyeh", company: "Ramp", title: "Co-founder and CTO", city: "New York", state: "NY", industry: "fintech" },
  { name: "Genevieve Gonzalez Smith", company: "Ramp", title: "CFO", city: "New York", state: "NY", industry: "fintech" },

  // Professional services / boutique firms (buy dashboards & analysis)
  { name: "Blair Enns", company: "Win Without Pitching", title: "Founder", city: "Remote", state: "MT", industry: "consulting" },
  { name: "David C. Baker", company: "Recourses", title: "Founder", city: "Nashville", state: "TN", industry: "consulting" },
  { name: "Karl Sakas", company: "Sakas & Company", title: "Founder", city: "Raleigh", state: "NC", industry: "agency consulting" },
  { name: "Drew McLellan", company: "Agency Management Institute", title: "CEO", city: "Des Moines", state: "IA", industry: "agency consulting" },
  { name: "Chris Do", company: "The Futur", title: "Founder", city: "Los Angeles", state: "CA", industry: "education brand" },
  { name: "Aaron Draplin", company: "Draplin Design Co.", title: "Founder", city: "Portland", state: "OR", industry: "design studio" },
  { name: "Jessica Hische", company: "Jessica Hische Studio", title: "Founder", city: "San Francisco", state: "CA", industry: "design studio" },
  { name: "Jim Coudal", company: "Coudal Partners", title: "Founder", city: "Chicago", state: "IL", industry: "creative SMB" },
  { name: "Bryan Bedell", company: "Field Notes", title: "Partner", city: "Chicago", state: "IL", industry: "CPG" },
  { name: "Aaron Draplin", company: "Field Notes", title: "Collaborator / designer", city: "Portland", state: "OR", industry: "CPG" },

  // SMB retail / hospitality (still data-hungry operators)
  { name: "Nick Swinmurn", company: "Zappos", title: "Founder", city: "Las Vegas", state: "NV", industry: "retail" },
  { name: "Chris Gheysens", company: "Wawa", title: "President and CEO", city: "Media", state: "PA", industry: "convenience retail" },
  { name: "Joe Sheetz", company: "Sheetz", title: "CEO", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Travis Sheetz", company: "Sheetz", title: "President", city: "Altoona", state: "PA", industry: "convenience retail" },
  { name: "Lynsi Snyder", company: "In-N-Out Burger", title: "Owner and President", city: "Irvine", state: "CA", industry: "restaurants" },
  { name: "Steve Scheel", company: "Scheels", title: "CEO", city: "Fargo", state: "ND", industry: "retail" },

  // SMB SaaS that still buy ops analytics
  { name: "Dax Dasilva", company: "Lightspeed Commerce", title: "Founder", city: "Montreal / remote", state: "NY", industry: "retail tech" },
  { name: "JP Chauvet", company: "Lightspeed Commerce", title: "CEO", city: "Montreal / remote", state: "NY", industry: "retail tech" },
  { name: "David Cancel", company: "Drift", title: "Founder", city: "Boston", state: "MA", industry: "SaaS" },
  { name: "Elias Torres", company: "Drift", title: "Co-founder", city: "Boston", state: "MA", industry: "SaaS" },
  { name: "Brian Halligan", company: "HubSpot", title: "Co-founder", city: "Cambridge", state: "MA", industry: "SaaS" },
  { name: "Dharmesh Shah", company: "HubSpot", title: "Co-founder", city: "Cambridge", state: "MA", industry: "SaaS" },
  { name: "Yamini Rangan", company: "HubSpot", title: "CEO", city: "Cambridge", state: "MA", industry: "SaaS" },
  { name: "Melanie Perkins", company: "Canva", title: "Co-founder and CEO", city: "Sydney / remote US", state: "CA", industry: "software" },
  { name: "Cliff Obrecht", company: "Canva", title: "Co-founder and COO", city: "Sydney / remote US", state: "CA", industry: "software" },

  // Fractional finance / SMB advisory (prime analytics buyers)
  { name: "Mike Michalowicz", company: "Profit First Professionals", title: "Founder", city: "Boonton", state: "NJ", industry: "advisory" },
  { name: "Gino Wickman", company: "EOS Worldwide", title: "Founder", city: "Detroit", state: "MI", industry: "advisory" },
  { name: "Verne Harnish", company: "Scaling Up", title: "Founder", city: "Ashburn", state: "VA", industry: "advisory" },
  { name: "Cameron Herold", company: "COO Alliance", title: "Founder", city: "Vancouver / remote", state: "WA", industry: "advisory" },
  { name: "Greg Crabtree", company: "Simple Numbers", title: "Founder", city: "Athens", state: "GA", industry: "advisory" },
  { name: "John Warrillow", company: "The Value Builder System", title: "Founder", city: "Toronto / remote", state: "NY", industry: "advisory" },
  { name: "Bo Burlingham", company: "Small Giants", title: "Author / community figure", city: "Oakland", state: "CA", industry: "media SMB" },
  { name: "Paul Downs", company: "Paul Downs Cabinetmakers", title: "Owner", city: "Bridgeport", state: "PA", industry: "manufacturing", sizeHint: "30–50" },
  { name: "Norm Brodsky", company: "CitiStorage", title: "Founder", city: "New York", state: "NY", industry: "logistics SMB" },
  { name: "Noah Kagan", company: "AppSumo", title: "Founder", city: "Austin", state: "TX", industry: "SaaS SMB", sizeHint: "50–100" },
  { name: "Andrew Warner", company: "Mixergy", title: "Founder", city: "San Francisco", state: "CA", industry: "media SMB" },
  { name: "John Lee Dumas", company: "Entrepreneurs on Fire", title: "Founder", city: "Puerto Rico / remote", state: "FL", industry: "media SMB" },
  { name: "Amy Porterfield", company: "Amy Porterfield Inc.", title: "Founder", city: "San Diego", state: "CA", industry: "education brand" },
  { name: "Russell Brunson", company: "ClickFunnels", title: "Co-founder", city: "Boise", state: "ID", industry: "SaaS SMB" },
  { name: "Todd Dickerson", company: "ClickFunnels", title: "Co-founder", city: "Boise", state: "ID", industry: "SaaS SMB" },
  { name: "James Clear", company: "Atomic Habits", title: "Founder", city: "Columbus", state: "OH", industry: "education brand" },
  { name: "Tim Ferriss", company: "Ferriss Inc.", title: "Founder", city: "San Francisco", state: "CA", industry: "media SMB" },
  { name: "Tina Roth Eisenberg", company: "CreativeMornings", title: "Founder", city: "New York", state: "NY", industry: "creative SMB" },
  { name: "Sahil Lavingia", company: "Gumroad", title: "Founder and CEO", city: "San Francisco", state: "CA", industry: "SaaS SMB", sizeHint: "small team" },
  { name: "Pieter Levels", company: "Nomad List", title: "Founder", city: "Remote", state: "CA", industry: "SaaS SMB", sizeHint: "solo / tiny" },
  { name: "Pieter Levels", company: "RemoteOK", title: "Founder", city: "Remote", state: "CA", industry: "SaaS SMB" },
  { name: "Danny Postma", company: "HeadshotPro", title: "Founder", city: "Remote", state: "CA", industry: "SaaS SMB" },
  { name: "Marc Lou", company: "ShipFast / Indie portfolio", title: "Founder", city: "Remote", state: "CA", industry: "SaaS SMB" },
  { name: "Tony Dinh", company: "TypingMind", title: "Founder", city: "Remote", state: "CA", industry: "SaaS SMB" },
  { name: "Courtland Allen", company: "Indie Hackers", title: "Founder", city: "San Francisco", state: "CA", industry: "media SMB" },
  { name: "Tyler Tringas", company: "Earnest Capital", title: "Founder", city: "Remote", state: "CA", industry: "investing" },
  { name: "Arvid Kahl", company: "The Bootstrapped Founder", title: "Founder", city: "Remote", state: "CA", industry: "education brand" },
  { name: "Danielle Morrill", company: "Mattermark (legacy) / operator", title: "Founder", city: "San Francisco", state: "CA", industry: "SaaS SMB" },
  { name: "Nathan Latka", company: "Founderpath", title: "Founder", city: "Austin", state: "TX", industry: "fintech SMB" },
  { name: "Jordan Gal", company: "CartHook (legacy)", title: "Founder", city: "New York", state: "NY", industry: "ecommerce SMB" },
  { name: "Ezra Firestone", company: "Smart Marketer", title: "Founder", city: "Boulder", state: "CO", industry: "agency" },
  { name: "Molly Pittman", company: "Smart Marketer", title: "Partner / operator", city: "Boulder", state: "CO", industry: "agency" },
  { name: "Ryan Deiss", company: "DigitalMarketer", title: "Founder", city: "Austin", state: "TX", industry: "education brand" },
  { name: "Ian Stanley", company: "DigitalMarketer", title: "Leadership", city: "Austin", state: "TX", industry: "education brand" },
];

const NOTE_TEMPLATES = [
  "Spreadsheets everywhere — asked for a monthly KPI dashboard for a small {industry} company (~{size} people). [TEST DATA — synthetic phone/email; not for outreach]",
  "Wants someone to clean QuickBooks + Stripe exports and explain what’s actually driving margin. [TEST DATA — synthetic phone/email; not for outreach]",
  "Marketing spend up, clarity down. Prior chat about cohort / channel analysis for an SMB. [TEST DATA — synthetic phone/email; not for outreach]",
  "Owner is flying blind on inventory and cash. Interested in a lightweight weekly data pack. [TEST DATA — synthetic phone/email; not for outreach]",
  "Tried DIY Looker Studio; nobody trusts the numbers. Referred by their bookkeeper for analytics help. [TEST DATA — synthetic phone/email; not for outreach]",
  "Board / advisory meeting next month — needs a clean performance readout, not another raw export. [TEST DATA — synthetic phone/email; not for outreach]",
  "Shopify + ads + wholesale data don’t match. Asked to reconnect after busy season for a data cleanup. [TEST DATA — synthetic phone/email; not for outreach]",
  "Fractional ops lead wants recurring analysis (not a full-time hire). Warm intro from a CPA. [TEST DATA — synthetic phone/email; not for outreach]",
  "Hiring stalled because they can’t see which products or clients are profitable. Data analysis prospect. [TEST DATA — synthetic phone/email; not for outreach]",
  "Has Metabase/Sheets but no ownership. Looking for an outside analyst to own the weekly truth. [TEST DATA — synthetic phone/email; not for outreach]",
  "Seasonal {industry} swings — needs forecasting basics and a simple scoreboard for the leadership huddle. [TEST DATA — synthetic phone/email; not for outreach]",
  "Asked about packaging unit economics and CAC payback for a small growth company. [TEST DATA — synthetic phone/email; not for outreach]",
];

const SOURCES = [
  "CPA intro",
  "bookkeeper referral",
  "LinkedIn outbound",
  "prior proposal",
  "agency partner",
  "chamber event",
  "podcast lead",
  "fractional CFO network",
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
  return `${local}@${domain || "smbanalytics"}.example`;
}

function phoneFor(i: number) {
  const area = [512, 415, 617, 312, 206, 704, 303, 615, 503, 919][i % 10];
  return `(${area}) 555-${String(2000 + (i % 8000)).padStart(4, "0")}`;
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function lastTouch(i: number) {
  const start = Date.UTC(2024, 2, 1);
  return new Date(start + i * 86400000 * 2).toISOString().slice(0, 10);
}

function noteFor(p: Person, i: number) {
  const tmpl = NOTE_TEMPLATES[i % NOTE_TEMPLATES.length]!;
  const size = p.sizeHint ?? ["8", "15", "25", "40", "60", "90", "120"][i % 7]!;
  return tmpl.replace("{size}", size).replace(/\{industry\}/g, p.industry);
}

function dedupe(people: Person[]): Person[] {
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of people) {
    const key = `${p.name.toLowerCase()}|${p.company.toLowerCase()}`;
    if (seen.has(key)) continue;
    // Drop obvious non-people / composite test rows
    if (/legacy shop ops|alumni shop|Institute ops|composite|test\)/i.test(p.name)) continue;
    if (/\(test\)/i.test(p.title)) continue;
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
    const segment = `Small-company analytics buyer · ${p.industry} · ${p.city}, ${p.state}`;
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
    "smallbiz-data-analytics-test-book.csv",
  );
  writeFileSync(outPath, [header.join(","), ...rows].join("\n") + "\n", "utf8");
  console.log(`Wrote ${people.length} rows → ${outPath}`);
}

main();
