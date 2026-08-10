/**
 * Commercial P&C / contractor book: GL, workers’ comp renewals, job sites,
 * certificates of insurance. ~100–140 rows of real construction/trades leaders.
 *
 * Phones/emails synthetic. Do not contact.
 * Run: npm run generate:pnc-csv
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
  { name: "Michael Russell", company: "H.J. Russell & Company", title: "CEO", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Herman Russell Jr.", company: "H.J. Russell & Company", title: "Leadership family", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Guiomar Obregón", company: "Precision 2000", title: "CEO and Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Carlos Sánchez", company: "Precision 2000", title: "Co-founder", city: "Atlanta", state: "GA", industry: "construction" },
  { name: "Egbert Perry", company: "The Integral Group", title: "Chairman and CEO", city: "Atlanta", state: "GA", industry: "development / GC" },
  { name: "John Wieland", company: "John Wieland Homes", title: "Founder", city: "Atlanta", state: "GA", industry: "homebuilding" },
  { name: "Tooey Courtemanche", company: "Procore", title: "Founder and CEO", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Craig Smith", company: "Procore", title: "President", city: "Carpinteria", state: "CA", industry: "construction tech" },
  { name: "Ara Mahdessian", company: "ServiceTitan", title: "Co-founder and CEO", city: "Glendale", state: "CA", industry: "trades software" },
  { name: "Vaughn Hovanessian", company: "ServiceTitan", title: "Co-founder", city: "Glendale", state: "CA", industry: "trades software" },
  { name: "Bob Luddy", company: "CaptiveAire Systems", title: "Founder and President", city: "Raleigh", state: "NC", industry: "mechanical manufacturing" },
  { name: "Roy Carroll II", company: "Carroll Companies", title: "Founder and CEO", city: "Greensboro", state: "NC", industry: "real estate development" },
  { name: "Robert Faith", company: "Greystar", title: "Founder and CEO", city: "Charleston", state: "SC", industry: "construction / property" },
  { name: "Morty Hodge", company: "Hodge Industrial Technologies", title: "Founder and CEO", city: "Hoschton", state: "GA", industry: "industrial services" },
  { name: "Marcia Taylor", company: "Bennett Family of Companies", title: "CEO", city: "McDonough", state: "GA", industry: "trucking / logistics" },
  { name: "Jim Crane", company: "Crane Worldwide Logistics", title: "Owner", city: "Houston", state: "TX", industry: "logistics" },
  { name: "Ross Perot Jr.", company: "Hillwood", title: "Chairman", city: "Dallas", state: "TX", industry: "development" },
  { name: "Tilman Fertitta", company: "Fertitta Entertainment", title: "Owner", city: "Houston", state: "TX", industry: "hospitality development" },
  { name: "Paul Downs", company: "Paul Downs Cabinetmakers", title: "Owner", city: "Bridgeport", state: "PA", industry: "millwork" },
  { name: "David Weekley", company: "David Weekley Homes", title: "Founder", city: "Houston", state: "TX", industry: "homebuilding" },
  { name: "John Horton", company: "David Weekley Homes", title: "Leadership", city: "Houston", state: "TX", industry: "homebuilding" },
  { name: "Robert Toll", company: "Toll Brothers", title: "Co-founder", city: "Fort Washington", state: "PA", industry: "homebuilding" },
  { name: "Douglas Yearley Jr.", company: "Toll Brothers", title: "CEO", city: "Fort Washington", state: "PA", industry: "homebuilding" },
  { name: "Larry Mizel", company: "M.D.C. Holdings / Richmond American", title: "Founder executive", city: "Denver", state: "CO", industry: "homebuilding" },
  { name: "David Schuette", company: "Taylor Morrison", title: "Executive leadership", city: "Scottsdale", state: "AZ", industry: "homebuilding" },
  { name: "Sheryl Palmer", company: "Taylor Morrison", title: "Chairman and CEO", city: "Scottsdale", state: "AZ", industry: "homebuilding" },
  { name: "Stuart Miller", company: "Lennar", title: "Executive Chairman", city: "Miami", state: "FL", industry: "homebuilding" },
  { name: "Jonathan Jaffe", company: "Lennar", title: "Co-CEO and President", city: "Miami", state: "FL", industry: "homebuilding" },
  { name: "Rick Beckwitt", company: "Lennar", title: "Co-CEO", city: "Miami", state: "FL", industry: "homebuilding" },
  { name: "Jorge Pérez", company: "Related Group", title: "Founder and Chairman", city: "Miami", state: "FL", industry: "development" },
  { name: "Related construction ops", company: "Related Group Construction", title: "Construction leadership", city: "Miami", state: "FL", industry: "general contracting" },
  { name: "Jeff Hirsch", company: "Coastal Construction", title: "Leadership", city: "Miami", state: "FL", industry: "general contracting" },
  { name: "Tom Murphy", company: "Coastal Construction Group", title: "Chairman", city: "Miami", state: "FL", industry: "general contracting" },
  { name: "Javier Holtz", company: "CMC Group", title: "Leadership", city: "Miami", state: "FL", industry: "development" },
  { name: "Carlos Rodriguez", company: "Moss & Associates", title: "Leadership", city: "Fort Lauderdale", state: "FL", industry: "general contracting" },
  { name: "Bob Moss", company: "Moss & Associates", title: "Founder", city: "Fort Lauderdale", state: "FL", industry: "general contracting" },
  { name: "Scott Moss", company: "Moss & Associates", title: "CEO", city: "Fort Lauderdale", state: "FL", industry: "general contracting" },
  { name: "John Moriarty", company: "John Moriarty & Associates", title: "Founder", city: "Winchester", state: "MA", industry: "general contracting" },
  { name: "Suffolk leadership Ron Gabel", company: "Suffolk Construction", title: "Regional leadership", city: "Boston", state: "MA", industry: "general contracting" },
  { name: "John Fish", company: "Suffolk Construction", title: "Chairman and CEO", city: "Boston", state: "MA", industry: "general contracting" },
  { name: "Jay Badame", company: "Structure Tone", title: "Leadership", city: "New York", state: "NY", industry: "general contracting" },
  { name: "Robert McClennen", company: "Turner Construction (legacy regional)", title: "Operations executive", city: "New York", state: "NY", industry: "general contracting" },
  { name: "Peter Davoren", company: "Turner Construction", title: "Chairman and CEO", city: "New York", state: "NY", industry: "general contracting" },
  { name: "Thomas Gilbane Jr.", company: "Gilbane Building Company", title: "Leadership family", city: "Providence", state: "RI", industry: "general contracting" },
  { name: "William Gilbane III", company: "Gilbane Building Company", title: "Leadership", city: "Providence", state: "RI", industry: "general contracting" },
  { name: "Michael Healy", company: "Gilbane Building Company", title: "CEO", city: "Providence", state: "RI", industry: "general contracting" },
  { name: "Robert Beck", company: "The Whiting-Turner Contracting Company", title: "CEO", city: "Baltimore", state: "MD", industry: "general contracting" },
  { name: "Timothy Regan", company: "The Whiting-Turner Contracting Company", title: "Leadership", city: "Baltimore", state: "MD", industry: "general contracting" },
  { name: "James G. Davis", company: "James G. Davis Construction", title: "Founder executive", city: "Rockville", state: "MD", industry: "general contracting" },
  { name: "William (Bill) D. Davis", company: "James G. Davis Construction", title: "Leadership", city: "Rockville", state: "MD", industry: "general contracting" },
  { name: "Hensel Phelps leadership", company: "Hensel Phelps", title: "Regional executive", city: "Greeley", state: "CO", industry: "general contracting" },
  { name: "Michael Choutka", company: "Hensel Phelps", title: "CEO", city: "Greeley", state: "CO", industry: "general contracting" },
  { name: "Jeffrey Stone", company: "Brasfield & Gorrie", title: "Leadership", city: "Birmingham", state: "AL", industry: "general contracting" },
  { name: "Jim Gorrie", company: "Brasfield & Gorrie", title: "CEO", city: "Birmingham", state: "AL", industry: "general contracting" },
  { name: "Miller Gorrie", company: "Brasfield & Gorrie", title: "Leadership family", city: "Birmingham", state: "AL", industry: "general contracting" },
  { name: "Rob Taylor", company: "Holder Construction", title: "Leadership", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Thomas Holder", company: "Holder Construction", title: "Chairman", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Scott Holder", company: "Holder Construction", title: "CEO", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Choate Construction leadership", company: "Choate Construction", title: "Executive", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "William Choate", company: "Choate Construction", title: "Founder executive", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Hardin Construction leadership", company: "Hardin Construction", title: "Executive", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "David Hardin", company: "Hardin Construction Company", title: "Leadership family", city: "Atlanta", state: "GA", industry: "general contracting" },
  { name: "Beck Group leadership", company: "The Beck Group", title: "Executive", city: "Dallas", state: "TX", industry: "architecture / construction" },
  { name: "Peter Beck", company: "The Beck Group", title: "CEO", city: "Dallas", state: "TX", industry: "architecture / construction" },
  { name: "Manhattan Construction leadership", company: "Manhattan Construction", title: "Regional executive", city: "Tulsa", state: "OK", industry: "general contracting" },
  { name: "Timothy McLaughlin", company: "Manhattan Construction Group", title: "Leadership", city: "Tulsa", state: "OK", industry: "general contracting" },
  { name: "Flintco leadership", company: "Flintco", title: "Executive", city: "Tulsa", state: "OK", industry: "general contracting" },
  { name: "Duit Construction leadership", company: "Duit Construction", title: "Executive", city: "Edmond", state: "OK", industry: "civil construction" },
  { name: "Austin Industries leadership", company: "Austin Industries", title: "Executive", city: "Dallas", state: "TX", industry: "civil / industrial" },
  { name: "Ron Austin", company: "Austin Industries", title: "Leadership family", city: "Dallas", state: "TX", industry: "civil / industrial" },
  { name: "Zachry leadership", company: "Zachry Group", title: "Executive", city: "San Antonio", state: "TX", industry: "industrial construction" },
  { name: "David Zachry", company: "Zachry Group", title: "CEO", city: "San Antonio", state: "TX", industry: "industrial construction" },
  { name: "Kiewit leadership", company: "Kiewit Corporation", title: "Regional executive", city: "Omaha", state: "NE", industry: "heavy civil" },
  { name: "Rick Lanoha", company: "Kiewit Corporation", title: "CEO", city: "Omaha", state: "NE", industry: "heavy civil" },
  { name: "PCL Construction leadership", company: "PCL Construction", title: "US regional executive", city: "Denver", state: "CO", industry: "general contracting" },
  { name: "DPR Construction leadership", company: "DPR Construction", title: "Regional executive", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "Peter Nosler", company: "DPR Construction", title: "Co-founder", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "Doug Woods", company: "DPR Construction", title: "Co-founder", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "Ron Davidowski", company: "DPR Construction", title: "Co-founder", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "George Pfeffer", company: "DPR Construction", title: "Co-founder", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "Webcor leadership", company: "Webcor", title: "Executive", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Jesús M. Campos", company: "Webcor", title: "Leadership", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Swinterton leadership", company: "Swinerton", title: "Executive", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Eric Figuers", company: "Swinerton", title: "CEO", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "McCarthy Building leadership", company: "McCarthy Building Companies", title: "Regional executive", city: "St. Louis", state: "MO", industry: "general contracting" },
  { name: "Mike Kenney", company: "McCarthy Building Companies", title: "CEO", city: "St. Louis", state: "MO", industry: "general contracting" },
  { name: "Alberici leadership", company: "Alberici Constructors", title: "Executive", city: "St. Louis", state: "MO", industry: "general contracting" },
  { name: "Gregory A. Kozicz", company: "Alberici", title: "President and CEO", city: "St. Louis", state: "MO", industry: "general contracting" },
  { name: "Clayco leadership", company: "Clayco", title: "Executive", city: "Chicago", state: "IL", industry: "design-build" },
  { name: "Robert G. Clark", company: "Clayco", title: "Founder and Chairman", city: "Chicago", state: "IL", industry: "design-build" },
  { name: "Pepper Construction leadership", company: "Pepper Construction", title: "Executive", city: "Chicago", state: "IL", industry: "general contracting" },
  { name: "Ken Knudson", company: "Pepper Construction", title: "Leadership", city: "Chicago", state: "IL", industry: "general contracting" },
  { name: "Walsh Group leadership", company: "The Walsh Group", title: "Executive", city: "Chicago", state: "IL", industry: "civil / building" },
  { name: "Matthew Walsh", company: "The Walsh Group", title: "Chairman and CEO", city: "Chicago", state: "IL", industry: "civil / building" },
  { name: "Power Construction leadership", company: "Power Construction", title: "Executive", city: "Schaumburg", state: "IL", industry: "general contracting" },
  { name: "Jeff Strong", company: "Power Construction", title: "Leadership", city: "Schaumburg", state: "IL", industry: "general contracting" },
  { name: "Mortenson leadership", company: "Mortenson Construction", title: "Regional executive", city: "Minneapolis", state: "MN", industry: "general contracting" },
  { name: "Thomas Gerlach Jr.", company: "Mortenson", title: "CEO", city: "Minneapolis", state: "MN", industry: "general contracting" },
  { name: "Ryan Companies leadership", company: "Ryan Companies US", title: "Executive", city: "Minneapolis", state: "MN", industry: "development / GC" },
  { name: "Jim Ryan", company: "Ryan Companies US", title: "Leadership family", city: "Minneapolis", state: "MN", industry: "development / GC" },
  { name: "Boldt leadership", company: "The Boldt Company", title: "Executive", city: "Appleton", state: "WI", industry: "general contracting" },
  { name: "Oscar C. Boldt", company: "The Boldt Company", title: "Leadership family", city: "Appleton", state: "WI", industry: "general contracting" },
  { name: "Mirón Construction leadership", company: "Mirón Construction", title: "Executive", city: "Neenah", state: "WI", industry: "general contracting" },
  { name: "Findorff leadership", company: "J.H. Findorff & Son", title: "Executive", city: "Madison", state: "WI", industry: "general contracting" },
  { name: "C.G. Schmidt leadership", company: "C.G. Schmidt", title: "Executive", city: "Milwaukee", state: "WI", industry: "general contracting" },
  { name: "M. A. Mortenson legacy ops", company: "Mortenson (regional)", title: "Project executive", city: "Denver", state: "CO", industry: "general contracting" },
  { name: "GE Johnson leadership", company: "GE Johnson Construction", title: "Executive", city: "Colorado Springs", state: "CO", industry: "general contracting" },
  { name: "Gerald H. Phipps leadership", company: "GH Phipps Construction", title: "Executive", city: "Greenwood Village", state: "CO", industry: "general contracting" },
  { name: "Haselden Construction leadership", company: "Haselden Construction", title: "Executive", city: "Centennial", state: "CO", industry: "general contracting" },
  { name: "Saunders Construction leadership", company: "Saunders Construction", title: "Executive", city: "Centennial", state: "CO", industry: "general contracting" },
  { name: "Layton Construction leadership", company: "Layton Construction", title: "Executive", city: "Sandy", state: "UT", industry: "general contracting" },
  { name: "Alan Layton", company: "Layton Construction", title: "Leadership family", city: "Sandy", state: "UT", industry: "general contracting" },
  { name: "Okland Construction leadership", company: "Okland Construction", title: "Executive", city: "Salt Lake City", state: "UT", industry: "general contracting" },
  { name: "Jacobsen Construction leadership", company: "Jacobsen Construction", title: "Executive", city: "Salt Lake City", state: "UT", industry: "general contracting" },
  { name: "Big-D Construction leadership", company: "Big-D Construction", title: "Executive", city: "Salt Lake City", state: "UT", industry: "general contracting" },
  { name: "Jack Livingood", company: "Big-D Construction", title: "Leadership", city: "Salt Lake City", state: "UT", industry: "general contracting" },
  { name: "Kitchell leadership", company: "Kitchell", title: "Executive", city: "Phoenix", state: "AZ", industry: "general contracting" },
  { name: "Jim Swanson", company: "Kitchell", title: "Leadership", city: "Phoenix", state: "AZ", industry: "general contracting" },
  { name: "Sundt Construction leadership", company: "Sundt Construction", title: "Executive", city: "Tempe", state: "AZ", industry: "general contracting" },
  { name: "Mike Hoover", company: "Sundt Construction", title: "CEO", city: "Tempe", state: "AZ", industry: "general contracting" },
  { name: "Okland Arizona ops", company: "Okland Construction Arizona", title: "Regional manager", city: "Phoenix", state: "AZ", industry: "general contracting" },
  { name: "Hensel Phelps Southwest", company: "Hensel Phelps Southwest", title: "District manager", city: "Phoenix", state: "AZ", industry: "general contracting" },
  { name: "Rogers-O'Brien leadership", company: "Rogers-O'Brien Construction", title: "Executive", city: "Dallas", state: "TX", industry: "general contracting" },
  { name: "Austin Commercial leadership", company: "Austin Commercial", title: "Executive", city: "Dallas", state: "TX", industry: "general contracting" },
  { name: "Linbeck leadership", company: "Linbeck Group", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Robert Bury", company: "Linbeck Group", title: "Leadership", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Harvey Builders leadership", company: "Harvey | Harvey-Cleary", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Tellepsen leadership", company: "Tellepsen", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Vaughn Construction leadership", company: "Vaughn Construction", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "SpawGlass leadership", company: "SpawGlass", title: "Executive", city: "San Antonio", state: "TX", industry: "general contracting" },
  { name: "Bartlett Cocke leadership", company: "Bartlett Cocke General Contractors", title: "Executive", city: "San Antonio", state: "TX", industry: "general contracting" },
  { name: "Joeris leadership", company: "Joeris General Contractors", title: "Executive", city: "San Antonio", state: "TX", industry: "general contracting" },
  { name: "Hunt Construction (legacy AECOM)", company: "Hunt Construction Group", title: "Legacy leadership", city: "Indianapolis", state: "IN", industry: "general contracting" },
  { name: "Pepper Lawson leadership", company: "Pepper Lawson Construction", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Satterfield & Pontikes leadership", company: "Satterfield & Pontikes", title: "Executive", city: "Houston", state: "TX", industry: "general contracting" },
  { name: "Manhattan Road & Bridge", company: "Manhattan Road & Bridge", title: "Civil executive", city: "Tulsa", state: "OK", industry: "civil construction" },
  { name: "Traylor Bros leadership", company: "Traylor Bros.", title: "Executive", city: "Evansville", state: "IN", industry: "heavy civil" },
  { name: "Flatiron Construction leadership", company: "Flatiron Construction", title: "US executive", city: "Broomfield", state: "CO", industry: "heavy civil" },
  { name: "Granite Construction leadership", company: "Granite Construction", title: "Regional executive", city: "Watsonville", state: "CA", industry: "heavy civil" },
  { name: "Kyle Larkin", company: "Granite Construction", title: "CEO", city: "Watsonville", state: "CA", industry: "heavy civil" },
  { name: "Tutor Perini leadership", company: "Tutor Perini", title: "Executive", city: "Sylmar", state: "CA", industry: "general contracting" },
  { name: "Ronald Tutor", company: "Tutor Perini", title: "Chairman and CEO", city: "Sylmar", state: "CA", industry: "general contracting" },
  { name: "Clark Construction leadership", company: "Clark Construction Group", title: "Regional executive", city: "Bethesda", state: "MD", industry: "general contracting" },
  { name: "Robert Moser Jr.", company: "Clark Construction Group", title: "President and CEO", city: "Bethesda", state: "MD", industry: "general contracting" },
  { name: "Skanska USA leadership", company: "Skanska USA", title: "Regional executive", city: "New York", state: "NY", industry: "general contracting" },
  { name: "Paul Jenny", company: "Skanska USA Building", title: "Leadership", city: "New York", state: "NY", industry: "general contracting" },
  { name: "Balfour Beatty US leadership", company: "Balfour Beatty US", title: "Regional executive", city: "Dallas", state: "TX", industry: "general contracting" },
  { name: "Build Group leadership", company: "Build Group", title: "Executive", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Cahill Contractors leadership", company: "Cahill Contractors", title: "Executive", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Plant Construction leadership", company: "Plant Construction Company", title: "Executive", city: "San Francisco", state: "CA", industry: "general contracting" },
  { name: "Rudolph and Sletten leadership", company: "Rudolph and Sletten", title: "Executive", city: "Redwood City", state: "CA", industry: "general contracting" },
  { name: "Devcon Construction leadership", company: "Devcon Construction", title: "Executive", city: "Milpitas", state: "CA", industry: "general contracting" },
  { name: "XL Construction leadership", company: "XL Construction", title: "Executive", city: "Milpitas", state: "CA", industry: "general contracting" },
  { name: "Truebeck Construction leadership", company: "Truebeck Construction", title: "Executive", city: "San Jose", state: "CA", industry: "electrical / GC" },
  { name: "Rosendin Electric leadership", company: "Rosendin Electric", title: "Executive", city: "San Jose", state: "CA", industry: "electrical contractor" },
  { name: "Thomas Soderman", company: "Rosendin Electric", title: "CEO", city: "San Jose", state: "CA", industry: "electrical contractor" },
  { name: "Cupertino Electric leadership", company: "Cupertino Electric", title: "Executive", city: "San Jose", state: "CA", industry: "electrical contractor" },
  { name: "John Guevara", company: "Cupertino Electric", title: "Leadership", city: "San Jose", state: "CA", industry: "electrical contractor" },
  { name: "Southland Industries leadership", company: "Southland Industries", title: "Executive", city: "Garden Grove", state: "CA", industry: "mechanical contractor" },
  { name: "ACCO Engineered Systems leadership", company: "ACCO Engineered Systems", title: "Executive", city: "Glendale", state: "CA", industry: "mechanical contractor" },
  { name: "Murray Company leadership", company: "Murray Company", title: "Executive", city: "Rancho Dominguez", state: "CA", industry: "mechanical contractor" },
  { name: "Critchfield Mechanical leadership", company: "Critchfield Mechanical", title: "Executive", city: "San Jose", state: "CA", industry: "mechanical contractor" },
  { name: "MMC Contractors leadership", company: "MMC Contractors", title: "Executive", city: "Kansas City", state: "MO", industry: "mechanical contractor" },
  { name: "TDIndustries leadership", company: "TDIndustries", title: "Executive", city: "Dallas", state: "TX", industry: "mechanical contractor" },
  { name: "Harold MacDowell", company: "TDIndustries", title: "CEO", city: "Dallas", state: "TX", industry: "mechanical contractor" },
  { name: "John J. Kirlin leadership", company: "John J. Kirlin", title: "Executive", city: "Rockville", state: "MD", industry: "mechanical contractor" },
  { name: "U.S. Engineering leadership", company: "U.S. Engineering", title: "Executive", city: "Kansas City", state: "MO", industry: "mechanical contractor" },
  { name: "Comfort Systems USA leadership", company: "Comfort Systems USA", title: "Regional executive", city: "Houston", state: "TX", industry: "mechanical contractor" },
  { name: "Brian Lane", company: "Comfort Systems USA", title: "CEO", city: "Houston", state: "TX", industry: "mechanical contractor" },
  { name: "EMCOR Building Services leadership", company: "EMCOR", title: "Regional executive", city: "Norwalk", state: "CT", industry: "specialty contractor" },
  { name: "Anthony Guzzi", company: "EMCOR Group", title: "President and CEO", city: "Norwalk", state: "CT", industry: "specialty contractor" },
  { name: "Quanta Services leadership", company: "Quanta Services", title: "Regional executive", city: "Houston", state: "TX", industry: "specialty contractor" },
  { name: "Duke Austin", company: "Quanta Services", title: "CEO", city: "Houston", state: "TX", industry: "specialty contractor" },
  { name: "MasTec leadership", company: "MasTec", title: "Regional executive", city: "Coral Gables", state: "FL", industry: "specialty contractor" },
  { name: "Jose Mas", company: "MasTec", title: "CEO", city: "Coral Gables", state: "FL", industry: "specialty contractor" },
  { name: "MYR Group leadership", company: "MYR Group", title: "Executive", city: "Henderson", state: "CO", industry: "electrical contractor" },
  { name: "Rick Swartz", company: "MYR Group", title: "Leadership", city: "Henderson", state: "CO", industry: "electrical contractor" },
  { name: "IES Holdings leadership", company: "IES Holdings", title: "Executive", city: "Houston", state: "TX", industry: "electrical contractor" },
  { name: "Jeff Gendell", company: "IES Holdings", title: "CEO", city: "Houston", state: "TX", industry: "electrical contractor" },
  { name: "Fred Perpall", company: "The Beck Group", title: "CEO (prior)", city: "Dallas", state: "TX", industry: "architecture / construction" },
  { name: "Steve Halverson", company: "The Haskell Company", title: "Chairman", city: "Jacksonville", state: "FL", industry: "design-build" },
  { name: "John C. Adams Jr.", company: "The Haskell Company", title: "Leadership", city: "Jacksonville", state: "FL", industry: "design-build" },
  { name: "Perry-McCall leadership", company: "Perry-McCall Construction", title: "Principal", city: "Jacksonville", state: "FL", industry: "general contracting" },
  { name: "AJAX Building leadership", company: "AJAX Building Corporation", title: "Executive", city: "Midland", state: "MI", industry: "general contracting" },
  { name: "Christman Company leadership", company: "The Christman Company", title: "Executive", city: "Lansing", state: "MI", industry: "general contracting" },
  { name: "Andrean Johnson", company: "The Christman Company", title: "Leadership", city: "Lansing", state: "MI", industry: "general contracting" },
  { name: "Barton Malow leadership", company: "Barton Malow", title: "Executive", city: "Southfield", state: "MI", industry: "general contracting" },
  { name: "Ryan Maibach", company: "Barton Malow", title: "CEO", city: "Southfield", state: "MI", industry: "general contracting" },
  { name: "Walbridge leadership", company: "Walbridge", title: "Executive", city: "Detroit", state: "MI", industry: "general contracting" },
  { name: "John Rakolta Jr.", company: "Walbridge", title: "Chairman", city: "Detroit", state: "MI", industry: "general contracting" },
  { name: "Granger Construction leadership", company: "Granger Construction", title: "Executive", city: "Lansing", state: "MI", industry: "general contracting" },
  { name: "The Rudolph Libbe Group leadership", company: "Rudolph Libbe Group", title: "Executive", city: "Walbridge", state: "OH", industry: "general contracting" },
  { name: "Donnelly Construction leadership", company: "Donley's", title: "Executive", city: "Cleveland", state: "OH", industry: "general contracting" },
  { name: "Panzica Construction leadership", company: "Panzica Construction", title: "Executive", city: "Cleveland", state: "OH", industry: "general contracting" },
  { name: "Turner Construction Cleveland", company: "Turner Construction Cleveland", title: "General manager", city: "Cleveland", state: "OH", industry: "general contracting" },
  { name: "Messer Construction leadership", company: "Messer Construction", title: "Executive", city: "Cincinnati", state: "OH", industry: "general contracting" },
  { name: "Tim Steigerwald", company: "Messer Construction", title: "CEO", city: "Cincinnati", state: "OH", industry: "general contracting" },
  { name: "Danis Building leadership", company: "Danis", title: "Executive", city: "Dayton", state: "OH", industry: "general contracting" },
  { name: "Skanska Ohio ops", company: "Skanska USA Ohio", title: "Operations manager", city: "Columbus", state: "OH", industry: "general contracting" },
  { name: "Weitz Company leadership", company: "The Weitz Company", title: "Executive", city: "Des Moines", state: "IA", industry: "general contracting" },
  { name: "Craig Damos", company: "The Weitz Company", title: "Leadership", city: "Des Moines", state: "IA", industry: "general contracting" },
  { name: "Story Construction leadership", company: "Story Construction", title: "Executive", city: "Ames", state: "IA", industry: "general contracting" },
  { name: "Neumann Monson / Neumann Construction", company: "Neumann Monson Architects GC partners", title: "Principal", city: "Iowa City", state: "IA", industry: "architecture / construction" },
  { name: "Sampson Construction leadership", company: "Sampson Construction", title: "Executive", city: "Lincoln", state: "NE", industry: "general contracting" },
  { name: "Hawkins Construction leadership", company: "Hawkins Construction", title: "Executive", city: "Omaha", state: "NE", industry: "general contracting" },
  { name: "Boyd Jones leadership", company: "Boyd Jones Construction", title: "Executive", city: "Omaha", state: "NE", industry: "general contracting" },
  { name: "MEC Construction leadership", company: "MEC Construction", title: "Executive", city: "Omaha", state: "NE", industry: "mechanical contractor" },
  { name: "Graham Construction leadership", company: "Graham Construction", title: "Executive", city: "Des Moines", state: "IA", industry: "general contracting" },
];

const NOTES = [
  "GL renewal in 60 days — last year certificate scramble on a school job. Wants cleaner COI turnaround. [TEST DATA — synthetic phone/email; not for outreach]",
  "Workers’ comp mod creeping up after two job-site claims. Asked for a mid-term loss review. [TEST DATA — synthetic phone/email; not for outreach]",
  "Bidding three public jobs; needs additional insured endorsements fast. Prior broker was slow. [TEST DATA — synthetic phone/email; not for outreach]",
  "Auto + GL package for crew trucks. Expanding into a neighboring state — multi-state filing mess. [TEST DATA — synthetic phone/email; not for outreach]",
  "Subcontractor default scare on last project. Interested in tighter risk transfer / sub COI tracking. [TEST DATA — synthetic phone/email; not for outreach]",
  "Umbrella limits may be short for the next hospital bid. Renewal conversation opened by CFO. [TEST DATA — synthetic phone/email; not for outreach]",
  "Safety meeting notes mention WC claim frequency. Soft reopen on loss control + renewal strategy. [TEST DATA — synthetic phone/email; not for outreach]",
  "Certificate scramble every Monday morning. Looking for a broker who can turn COIs same day. [TEST DATA — synthetic phone/email; not for outreach]",
  "Builders risk quote needed for a mid-rise start next quarter. No binder yet. [TEST DATA — synthetic phone/email; not for outreach]",
  "Prior quote on GL/WC lapsed when they went dark. New PM asked to reconnect. [TEST DATA — synthetic phone/email; not for outreach]",
  "Job site in flood zone — property / equipment floater questions in notes. [TEST DATA — synthetic phone/email; not for outreach]",
  "Owner-operator wants to compare WC options before headcount jump this spring. [TEST DATA — synthetic phone/email; not for outreach]",
  "GC requiring higher limits from all trades. Their current GL may not meet the spec. [TEST DATA — synthetic phone/email; not for outreach]",
  "Long silence after a competing broker won the renewal. Worth a careful reopen with a market update. [TEST DATA — synthetic phone/email; not for outreach]",
  "Thin file — know they run crews. Start with renewal date and current carrier only. [TEST DATA — synthetic phone/email; not for outreach]",
];

const SOURCES = [
  "renewal list",
  "COI request",
  "GC referral",
  "prior submission",
  "safety seminar",
  "loss run follow-up",
  "bid deadline lead",
];
const VALUES = ["High", "Medium", "High", "Medium", "", "High", ""];

function slugEmail(name: string, company: string) {
  const local = name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 40);
  const domain = company.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28);
  return `${local}@${domain || "contractor"}.example`;
}

function phoneFor(i: number) {
  const area = [404, 713, 312, 303, 602, 415, 617, 214, 813, 919][i % 10];
  return `(${area}) 555-${String(4000 + (i % 6000)).padStart(4, "0")}`;
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function isWeakName(name: string) {
  // Drop role placeholders; keep real personal names even at large GCs.
  return (
    /\bleadership\b/i.test(name) ||
    /legacy ops|regional executive|district manager|construction ops|general manager|operations manager/i.test(
      name,
    )
  );
}

function main() {
  const seen = new Set<string>();
  const people = SEED.filter((p) => {
    if (isWeakName(p.name)) return false;
    const k = `${p.name}|${p.company}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (people.length < 80) throw new Error(`Need 80+, got ${people.length}`);

  const header = ["Name", "Email", "Phone", "Company", "Title", "Segment", "Source", "Last Touch", "Notes", "Value", "LinkedIn", "City", "State", "Industry"];
  const start = Date.UTC(2024, 1, 5);
  const rows = people.map((p, i) =>
    [
      p.name,
      slugEmail(p.name, p.company),
      phoneFor(i),
      p.company,
      p.title,
      `Contractor P&C book · ${p.industry} · ${p.city}, ${p.state}`,
      SOURCES[i % SOURCES.length]!,
      new Date(start + i * 86400000 * 3).toISOString().slice(0, 10),
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

  const out = join(process.cwd(), "public", "contractor-pnc-insurance-test-book.csv");
  writeFileSync(out, [header.join(","), ...rows].join("\n") + "\n");
  console.log(`Wrote ${people.length} rows → ${out}`);
}

main();
