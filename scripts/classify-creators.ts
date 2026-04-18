/**
 * Classify creators as person vs business based on name heuristics
 * and cross-referencing with known brands in our database.
 *
 * Usage:
 *   npx tsx scripts/classify-creators.ts
 *   npx tsx scripts/classify-creators.ts --dry-run
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Business name signals — if any match, it's likely a business
// ---------------------------------------------------------------------------

// Company suffixes & legal forms
const COMPANY_SUFFIXES = /\b(ab|ltd|llc|inc|gmbh|ag|sa|srl|oy|as|a\/s|bv|nv|plc|co|corp|pty|s\.?p\.?a|s\.?r\.?l|e\.?k)\b\.?$/i;

// Business type keywords
const BUSINESS_KEYWORDS = /\b(shop|store|market|mall|outlet|retail|wholesale|brand|brands|company|companies|group|holding|international|global|worldwide|corporate|enterprise|solutions|services|consulting|agency|agencies|studio|studios|digital|media|marketing|creative|production|productions|design|designs|tech|technology|software|app|web|online|platform|network|systems|partners|partnership|associates|communications|ventures|capital|finance|financial|insurance|bank|invest|legal|law|logistics|transport|shipping|pharma|chemical|industrial|manufacturing|factory)\b/i;

// Retail / commerce
const RETAIL_KEYWORDS = /\b(apotek|pharmacy|apoteket|butik|butiken|supermarket|grocery|kiosk|dealer|dealership|motors|automotive|auto|bil|bilar|cars|vehicles|trucks|rent|rental|leasing|booking|travel|hotel|hotell|hostel|resort|restaurant|restaurang|café|cafe|bar|pub|bistro|pizzeria|bakery|bageri|konditori|florist|salon|frisör|barber|spa|klinik|clinic|dental|tandvård|veterinär|vet)\b/i;

// Real estate
const REALESTATE_KEYWORDS = /\b(fastighet|mäklar|mäklare|mäkleri|bostad|bostäder|fastighetsförmedling|hem|hus|house|houses|real\s*estate|property|properties|realty|immobilien|immobilier|makler|bygga|bygg|construction)\b/i;

// Media / publishing
const MEDIA_KEYWORDS = /\b(tv|television|radio|news|nyheter|magazine|magasin|tidning|journal|newspaper|blog|podcast|publisher|publishing|förlag|editorial|redaktion|gazette|times|herald|post|tribune|chronicle)\b/i;

// Organizations / institutions
const ORG_KEYWORDS = /\b(university|universitet|school|skola|college|academy|akademi|institute|institut|foundation|stiftelse|förening|association|federation|museum|library|bibliotek|church|kyrka|council|kommun|government|myndighet|department|ministry|police|polis|hospital|sjukhus|airport|flygplats|stadium|arena|theatre|teater|cinema|bio)\b/i;

// Sports / entertainment
const SPORTS_KEYWORDS = /\b(fc|bk|if|fk|ik|aik|hif|racing|united|athletic|sport|sports|team|league|cup|championship|tournament|fighter|boxing|mma|hockey|fotboll|football|soccer|basketball|tennis|golf|club|klubb)\b/i;

// Known brand patterns (single word, all caps, special chars)
const BRAND_PATTERNS = [
  /^[A-Z]{2,}$/, // ALL CAPS single word like "MOHITO", "JUNIQE"
  /^[A-Z][A-Z&\s]+$/, // ALL CAPS with spaces like "UNITED COLORS OF BENETTON"
  /\.(se|com|co|io|net|org|dk|no|fi|de|fr|uk|eu)$/i, // Domain-like names
];

// Location keywords (often in franchise/branch names)
const LOCATION_KEYWORDS = /\b(sverige|sweden|stockholm|göteborg|gothenburg|malmö|lund|uppsala|linköping|norrköping|örebro|västerås|umeå|sundsvall|gävle|karlstad|jönköping|helsingborg|halmstad|kalmar|luleå|kiruna|visby|växjö|trollhättan|uddevalla|borås|eskilstuna|nacka|solna|täby|tyresö|huddinge|oslo|bergen|trondheim|stavanger|copenhagen|aarhus|helsinki|tampere|london|paris|berlin|amsterdam|roma|madrid|barcelona|dublin|zürich|wien|münchen|hamburg|frankfurt|sydney|melbourne|toronto|vancouver|new\s*york|los\s*angeles|san\s*francisco|chicago|italia|españa|deutschland|france|uk|usa|nordics?|scandinavia|europe)\b/i;

// Generic words that appear in non-person page names
const GENERIC_WORDS = /\b(daily|hub|community|shelf|novel|novels|books|stories|stories|romance|drama|dramas|pilates|yoga|weight\s*loss|wellness|fitness|workout|recipes?|cooking|beauty|tips|hacks|life|lifestyle|secrets?|official|fan|fans|page|world|zone|club|central|corner|spot|place|vibes|lovers?|addicts?|obsess|obsessed|insider|insiders|review|reviews|deals|discount|coupon|coupons|offer|offers|best|top|free|win|giveaway|prize|cash|money|earn|crypto|bitcoin|forex|trading|invest|stock|bet|betting|casino|slot|poker|lucky|fortune|magic|miracle|hack|trick|cheat|secret|mystery|shocking|unbelievable|amazing|incredible|watch|tracker|locator|localizador|finder|scanner|spy|surveillance|phone|iphone|android|samsung|galaxy|temu|shein|aliexpress|wish|cheap)\b/i;

// Common first names (Swedish + international) to help identify person names
const COMMON_FIRST_NAMES = new Set([
  // Swedish female
  'anna', 'eva', 'maria', 'karin', 'sara', 'emma', 'lisa', 'linda', 'jenny',
  'sofia', 'johanna', 'elin', 'hanna', 'malin', 'jessica', 'ida', 'sandra',
  'caroline', 'lena', 'helena', 'annika', 'petra', 'camilla', 'rebecka',
  'frida', 'therese', 'lovisa', 'agnes', 'klara', 'matilda', 'wilma',
  'amanda', 'alexandra', 'felicia', 'victoria', 'emilia', 'isabelle',
  'cecilia', 'kristina', 'susanne', 'katarina', 'margareta', 'birgitta',
  'ingrid', 'astrid', 'sigrid', 'gunhild', 'ulrika', 'monica', 'inga',
  'christina', 'christine', 'charlotte', 'louise', 'marie', 'madeleine',
  'viveka', 'gunilla', 'berit', 'britt', 'barbro', 'ulla', 'ragnhild',
  'pernilla', 'catharina', 'linnea', 'tilda', 'tuva', 'hedda', 'signe',
  'märta', 'greta', 'tyra', 'ronja', 'stina', 'lina', 'moa', 'tove',
  'filippa', 'cornelia', 'julia', 'ellen', 'alma', 'edith', 'vera',
  'birgit', 'elisabet', 'kerstin', 'marianne', 'solveig', 'gudrun',
  // Swedish male
  'erik', 'lars', 'karl', 'anders', 'johan', 'per', 'peter', 'thomas',
  'daniel', 'fredrik', 'mikael', 'jonas', 'marcus', 'mattias', 'andreas',
  'stefan', 'david', 'niklas', 'patrik', 'martin', 'gustav', 'oscar',
  'christian', 'alexander', 'henrik', 'magnus', 'olof', 'axel', 'viktor',
  'filip', 'lucas', 'william', 'oliver', 'hugo', 'elias', 'noah', 'liam',
  'sebastian', 'simon', 'gabriel', 'rasmus', 'jakob', 'anton', 'adam',
  'max', 'nils', 'sven', 'bengt', 'hans', 'göran', 'jan', 'bo',
  'ulf', 'rolf', 'leif', 'björn', 'torbjörn', 'christer', 'tommy',
  'lennart', 'ove', 'arne', 'ingemar', 'kenneth', 'roger', 'conny',
  'mats', 'claes', 'pontus', 'hampus', 'ludvig', 'arvid', 'albin',
  'isak', 'malte', 'edvin', 'melvin', 'alfred', 'valter',
  'theodor', 'ebbe', 'vidar', 'sigge', 'ivar', 'otto', 'sixten',
  // Norwegian
  'ole', 'thor', 'geir', 'trond', 'odd', 'knut', 'terje', 'svein',
  'arne', 'bjørn', 'dag', 'einar', 'finn', 'gunnar', 'halvard',
  'håkon', 'jarle', 'kjell', 'magne', 'ragnar', 'sigurd', 'stein',
  'kirsten', 'solveig', 'randi', 'gerd', 'toril', 'silje', 'ingeborg',
  // Danish
  'jens', 'søren', 'niels', 'rasmus', 'morten', 'kasper', 'mikkel',
  'nikolaj', 'lasse', 'troels', 'flemming', 'preben', 'torben',
  'anne', 'mette', 'lise', 'kirsten', 'birgitte', 'dorthe', 'trine',
  // Finnish
  'matti', 'jukka', 'antti', 'juha', 'pekka', 'timo', 'heikki',
  'kari', 'jari', 'mikko', 'ville', 'lauri', 'eero', 'ilkka',
  'satu', 'tiina', 'päivi', 'kaisa', 'maija', 'leena', 'riikka',
  // International common
  'james', 'john', 'robert', 'michael', 'william', 'richard', 'joseph',
  'charles', 'christopher', 'matthew', 'anthony', 'mark', 'paul', 'steven',
  'andrew', 'joshua', 'kevin', 'brian', 'george', 'timothy', 'ronald',
  'benjamin', 'samuel', 'gregory', 'frank', 'raymond', 'jack', 'dennis',
  'jerry', 'tyler', 'aaron', 'jose', 'nathan', 'henry', 'douglas',
  'mary', 'patricia', 'jennifer', 'elizabeth', 'barbara', 'susan',
  'jessica', 'sarah', 'karen', 'nancy', 'betty', 'margaret', 'sandra',
  'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle', 'carol',
  'sophie', 'chloe', 'charlotte', 'amelia', 'olivia', 'isla', 'grace',
  'alice', 'lucy', 'hannah', 'rachel', 'natalie', 'rebecca', 'laura',
  'nicole', 'stephanie', 'samantha', 'brittany', 'megan', 'lauren', 'andrea',
  'julia', 'elena', 'chiara', 'giulia', 'francesca', 'valentina', 'camille',
  'léa', 'manon', 'chloé', 'luisa', 'lotta', 'maja',
  'ebba', 'ella', 'alva', 'freja', 'saga', 'nora', 'thea',
  'clara', 'rosa', 'lily', 'ruby', 'ivy', 'molly', 'poppy', 'daisy',
  'amber', 'jade', 'brooke', 'paige', 'summer', 'autumn', 'holly',
  'diana', 'diana', 'vera', 'irene', 'helen', 'ruth', 'joan', 'jean',
  // Spanish/Portuguese
  'carlos', 'pablo', 'pedro', 'miguel', 'angel', 'luis', 'francisco',
  'javier', 'rafael', 'fernando', 'sergio', 'alejandro', 'diego',
  'andres', 'enrique', 'ricardo', 'alberto', 'jorge', 'ivan', 'raul',
  'hector', 'oscar', 'arturo', 'cesar', 'hugo', 'edgar', 'mauricio',
  'ana', 'carmen', 'lucia', 'marta', 'pilar', 'dolores', 'rosa',
  'isabel', 'teresa', 'beatriz', 'silvia', 'cristina', 'yolanda',
  'adriana', 'daniela', 'gabriela', 'veronica', 'patricia', 'monica',
  // English extras
  'don', 'donald', 'wayne', 'roy', 'carl', 'eugene', 'russell',
  'bobby', 'johnny', 'billy', 'jimmy', 'tommy', 'freddy', 'danny',
  'terry', 'harry', 'larry', 'barry', 'gary', 'tony', 'joe', 'ray',
  'annie', 'bonnie', 'carrie', 'debbie', 'wendy', 'cindy', 'tammy',
  'sherry', 'vicky', 'penny', 'tiffany', 'crystal', 'heather', 'april',
  // French
  'jean', 'pierre', 'jacques', 'françois', 'alain', 'philippe',
  'bernard', 'nicolas', 'laurent', 'thierry', 'pascal', 'olivier',
  'catherine', 'nathalie', 'isabelle', 'sylvie', 'monique', 'sandrine',
  // German
  'hans', 'klaus', 'werner', 'helmut', 'dieter', 'jürgen', 'wolfgang',
  'horst', 'manfred', 'reinhard', 'gerhard', 'rainer', 'uwe', 'bernd',
  'sabine', 'monika', 'petra', 'ursula', 'renate', 'heike', 'andrea',
  // Italian
  'giuseppe', 'giovanni', 'antonio', 'marco', 'luca', 'alessandro',
  'matteo', 'lorenzo', 'andrea', 'stefano', 'simone', 'davide',
  'maria', 'anna', 'paola', 'laura', 'sara', 'elisa', 'silvia',
]);

// Person title/profession suffixes that confirm it's a person
const PERSON_SUFFIXES = /\b(författare|artist|fotograf|photographer|coach|trainer|blogger|vlogger|influencer|model|chef|doctor|dr|md|dds|phd|esq|prof|professor|nurse|therapist|counselor|designer|illustrator|musician|singer|dancer|actor|actress|comedian|host|presenter|journalist|reporter|anchor|correspondent|editor|writer|author|poet|speaker|consultant|advisor|advocate|activist|ambassador|athlete|player|instructor|tutor|mentor|nutritionist|dietitian|stylist|makeup|hairstylist|barber|tattoo|dj|mc|producer|director|filmmaker|cinematographer|animator|architect|engineer|developer|programmer|scientist|researcher|psychologist|psychiatrist|surgeon|dentist|veterinarian|pharmacist|optometrist|chiropractor|physiotherapist|midwife|paramedic|firefighter|pilot|captain|lieutenant|sergeant|colonel|general|reverend|pastor|priest|rabbi|imam|bishop|deacon|minister|chaplain)\b/i;

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

function classifyCreator(
  name: string,
  knownBrandNames: Set<string>,
): 'person' | 'business' | 'unknown' {
  if (!name) return 'unknown';

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check if it's a known brand in our database
  if (knownBrandNames.has(lower)) return 'business';

  // 2. Check company suffixes
  if (COMPANY_SUFFIXES.test(trimmed)) return 'business';

  // 3. Check business keywords
  if (BUSINESS_KEYWORDS.test(trimmed)) return 'business';
  if (RETAIL_KEYWORDS.test(trimmed)) return 'business';
  if (REALESTATE_KEYWORDS.test(trimmed)) return 'business';
  if (MEDIA_KEYWORDS.test(trimmed)) return 'business';
  if (ORG_KEYWORDS.test(trimmed)) return 'business';
  if (SPORTS_KEYWORDS.test(trimmed)) return 'business';

  // 4. Check brand patterns
  for (const p of BRAND_PATTERNS) {
    if (p.test(trimmed)) return 'business';
  }

  // 5. Location in name = usually a franchise/branch
  if (LOCATION_KEYWORDS.test(trimmed)) return 'business';

  // 5b. Generic/spam words
  if (GENERIC_WORDS.test(trimmed)) return 'business';

  // 6. Person name heuristics
  const words = trimmed.split(/\s+/);

  // Person names are typically 2-4 words
  if (words.length >= 2 && words.length <= 4) {
    const firstName = words[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zäöåæøü]/g, '');

    // Known first name + surname pattern
    if (COMMON_FIRST_NAMES.has(firstName)) {
      // Check second word isn't a business keyword
      const rest = words.slice(1).join(' ');
      if (!BUSINESS_KEYWORDS.test(rest) && !RETAIL_KEYWORDS.test(rest) && !REALESTATE_KEYWORDS.test(rest)) {
        return 'person';
      }
    }

    // Also check: "Firstname Lastname, profession" pattern
    if (PERSON_SUFFIXES.test(trimmed) && COMMON_FIRST_NAMES.has(firstName)) {
      return 'person';
    }
  }

  // 7. Single word = usually a brand/business
  if (words.length === 1) return 'business';

  // 8. Contains special characters typical of brands
  if (/[&@™®©]/.test(trimmed)) return 'business';
  if (/[:|-]/.test(trimmed)) return 'business';

  // 9. Names with numbers are usually businesses/apps
  if (/\d/.test(trimmed)) return 'business';

  // 10. Names ending with common brand-name patterns
  if (/\.(se|com|co|io|net|org|dk|no|fi|de|fr)$/i.test(trimmed)) return 'business';

  // 11. "Something by/for/with Something" — usually a product/brand, not a person
  if (/\b(by|for|with|from|via|per|och|und|et|y)\b/i.test(trimmed) && words.length > 3) return 'business';

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('═'.repeat(60));
  console.log('Classify Creators: Person vs Business');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Get all known brand names for cross-referencing
  const brands = await prisma.adLibraryBrand.findMany({ select: { pageName: true } });
  const knownBrandNames = new Set(brands.map(b => b.pageName.toLowerCase()));
  console.log(`Known brands for cross-reference: ${knownBrandNames.size}`);

  // Get all creators
  const creators = await prisma.adCreator.findMany({
    select: { id: true, pageName: true, tier: true },
  });
  console.log(`Creators to classify: ${creators.length}`);

  const counts = { person: 0, business: 0, unknown: 0 };
  const updates: { id: string; type: string }[] = [];

  for (const c of creators) {
    const type = classifyCreator(c.pageName, knownBrandNames);
    counts[type]++;
    updates.push({ id: c.id, type });
  }

  console.log(`\nClassification results:`);
  console.log(`  Person:   ${counts.person} (${Math.round(counts.person / creators.length * 100)}%)`);
  console.log(`  Business: ${counts.business} (${Math.round(counts.business / creators.length * 100)}%)`);
  console.log(`  Unknown:  ${counts.unknown} (${Math.round(counts.unknown / creators.length * 100)}%)`);

  // Show samples
  const personSamples = creators
    .filter((c, i) => updates[i].type === 'person')
    .sort((a, b) => b.tier.localeCompare(a.tier))
    .slice(0, 20);
  console.log(`\n  Person samples:`);
  for (const s of personSamples) console.log(`    ${s.pageName} [${s.tier}]`);

  const businessSamples = creators
    .filter((c, i) => updates[i].type === 'business')
    .slice(0, 20);
  console.log(`\n  Business samples:`);
  for (const s of businessSamples) console.log(`    ${s.pageName} [${s.tier}]`);

  const unknownSamples = creators
    .filter((c, i) => updates[i].type === 'unknown')
    .slice(0, 20);
  console.log(`\n  Unknown samples:`);
  for (const s of unknownSamples) console.log(`    ${s.pageName} [${s.tier}]`);

  if (dryRun) {
    console.log('\nDry run — no updates made.');
    await prisma.$disconnect();
    return;
  }

  // Batch update
  console.log('\nUpdating database...');
  let updated = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    await Promise.all(
      batch.map(u =>
        prisma.adCreator.update({
          where: { id: u.id },
          data: { creatorType: u.type },
        })
      )
    );
    updated += batch.length;
    if (updated % 500 === 0) console.log(`  ${updated}/${updates.length}`);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('CLASSIFICATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Updated: ${updated}`);
  console.log(`Person: ${counts.person} | Business: ${counts.business} | Unknown: ${counts.unknown}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
