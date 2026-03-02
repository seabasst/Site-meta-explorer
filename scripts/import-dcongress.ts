/**
 * Import D-Congress 2025 brands from Excel data
 * These are marked with priority=100 to identify as client brands
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// D-Congress 2025 companies extracted from Excel
const dcongressBrands = [
  { name: "& Other Stories", category: "Fashion Retail", fbUrl: "https://www.facebook.com/andotherstories" },
  { name: "Adlibris", category: "Books/E-commerce", fbUrl: "https://www.facebook.com/adlibris" },
  { name: "Aimn", category: "Sports Fashion", fbUrl: "https://www.facebook.com/aimnofficial" },
  { name: "Apohem AB", category: "Health/Pharmacy", fbUrl: "https://www.facebook.com/apohem" },
  { name: "Apotea", category: "Pharmacy E-com", fbUrl: "https://www.facebook.com/apotea.se" },
  { name: "Apotek Hjärtat", category: "Pharmacy Retail", fbUrl: "https://www.facebook.com/apotekhjärtat" },
  { name: "Apoteket", category: "Pharmacy Retail", fbUrl: "https://www.facebook.com/apoteket" },
  { name: "Ark Bokhandel", category: "Books/Retail", fbUrl: "https://www.facebook.com/arkbokhandel" },
  { name: "Arken Zoo", category: "Pet Retail", fbUrl: "https://www.facebook.com/arkenzoo" },
  { name: "Asket", category: "Sustainable Fashion", fbUrl: "https://www.facebook.com/asketclothing" },
  { name: "Babybjörn", category: "Baby Products", fbUrl: "https://www.facebook.com/babybjorn" },
  { name: "Babyshop", category: "Children's E-com", fbUrl: "https://www.facebook.com/babyshopstore" },
  { name: "Bagaren och Kocken", category: "Kitchen/Food E-com", fbUrl: "https://www.facebook.com/bagarenochkocken" },
  { name: "Bangerhead AB", category: "Beauty E-com", fbUrl: "https://www.facebook.com/bangerhead" },
  { name: "Björn Borg", category: "Sports Fashion", fbUrl: "https://www.facebook.com/bjornborg" },
  { name: "Boozt Fashion AB", category: "Fashion E-com", fbUrl: "https://www.facebook.com/boozt" },
  { name: "Boråstapeter AB", category: "Home Decor", fbUrl: "https://www.facebook.com/borastapeter" },
  { name: "Bubbleroom", category: "Fashion E-com", fbUrl: "https://www.facebook.com/bubbleroom" },
  { name: "CAIA Cosmetics", category: "Beauty E-com", fbUrl: "https://www.facebook.com/caiacosmetics" },
  { name: "Care of Carl", category: "Men's Fashion E-com", fbUrl: "https://www.facebook.com/careofcarl" },
  { name: "CDON", category: "Marketplace E-com", fbUrl: "https://www.facebook.com/cdon" },
  { name: "Cervera", category: "Kitchen/Home Retail", fbUrl: "https://www.facebook.com/cerverasverige" },
  { name: "CHIMI", category: "Eyewear/Fashion", fbUrl: "https://www.facebook.com/chimieyewear" },
  { name: "Clas Ohlson", category: "Home/Hardware Retail", fbUrl: "https://www.facebook.com/clasohlson" },
  { name: "Coop Sverige", category: "Grocery Retail", fbUrl: "https://www.facebook.com/coopsverige" },
  { name: "Daniel Wellington", category: "Watches/Fashion", fbUrl: "https://www.facebook.com/danielwellington" },
  { name: "Didriksons", category: "Outdoor Fashion", fbUrl: "https://www.facebook.com/didriksons" },
  { name: "Dormy Golf", category: "Sports/Golf Retail", fbUrl: "https://www.facebook.com/dormygolf" },
  { name: "Ellos Group", category: "Fashion/Home E-com", fbUrl: "https://www.facebook.com/ellos" },
  { name: "Elon", category: "Electronics Retail", fbUrl: "https://www.facebook.com/elonelektronik" },
  { name: "Equestrian Stockholm", category: "Equestrian Fashion", fbUrl: "https://www.facebook.com/equestrianstockholm" },
  { name: "Eton Shirts", category: "Men's Fashion", fbUrl: "https://www.facebook.com/etonshirts" },
  { name: "Flattered", category: "Shoes/Fashion", fbUrl: "https://www.facebook.com/flatteredshoes" },
  { name: "Geggamoja", category: "Children's Fashion", fbUrl: "https://www.facebook.com/geggamoja" },
  { name: "Gina Tricot", category: "Women's Fashion", fbUrl: "https://www.facebook.com/ginatricot" },
  { name: "Granngården", category: "Garden/Pet Retail", fbUrl: "https://www.facebook.com/granngarden" },
  { name: "Hatstore", category: "Hats/Accessories", fbUrl: "https://www.facebook.com/hatstore" },
  { name: "Hornbach Sverige", category: "DIY/Home", fbUrl: "https://www.facebook.com/hornbachsverige" },
  { name: "Houdini Sportswear", category: "Outdoor/Sports", fbUrl: "https://www.facebook.com/houdinisportswear" },
  { name: "ICANIWILL", category: "Activewear", fbUrl: "https://www.facebook.com/icaniwill" },
  { name: "Inet", category: "Electronics E-com", fbUrl: "https://www.facebook.com/inetsverige" },
  { name: "Intersport Sverige", category: "Sports Retail", fbUrl: "https://www.facebook.com/intersportsverige" },
  { name: "J.Lindeberg", category: "Premium Fashion", fbUrl: "https://www.facebook.com/jlindeberg" },
  { name: "Jollyroom", category: "Children's E-com", fbUrl: "https://www.facebook.com/jollyroom" },
  { name: "Jula", category: "DIY/Home Retail", fbUrl: "https://www.facebook.com/julaab" },
  { name: "Kappahl", category: "Fashion Retail", fbUrl: "https://www.facebook.com/kappahl" },
  { name: "KICKS", category: "Beauty Retail", fbUrl: "https://www.facebook.com/kicksbeauty" },
  { name: "Kids Brand Store", category: "Children's Fashion", fbUrl: "https://www.facebook.com/kidsbrandstore" },
  { name: "Kjell & Company", category: "Electronics Retail", fbUrl: "https://www.facebook.com/kjelloccompany" },
  { name: "Kronans Apotek", category: "Pharmacy Retail", fbUrl: "https://www.facebook.com/kronansapotek" },
  { name: "Lindex", category: "Women's Fashion", fbUrl: "https://www.facebook.com/lindex" },
  { name: "Lyko", category: "Beauty E-com", fbUrl: "https://www.facebook.com/lyko" },
  { name: "Maria Nilsdotter", category: "Jewelry", fbUrl: "https://www.facebook.com/marianilsdotterjewelry" },
  { name: "Maya Delorez", category: "Equestrian Fashion", fbUrl: "https://www.facebook.com/mayadelorez" },
  { name: "MEDS Apotek", category: "Pharmacy E-com", fbUrl: "https://www.facebook.com/medsapotek" },
  { name: "Mini Rodini", category: "Children's Fashion", fbUrl: "https://www.facebook.com/minirodini" },
  { name: "Mio Möbler", category: "Furniture Retail", fbUrl: "https://www.facebook.com/miomobel" },
  { name: "MQ Marqet", category: "Fashion Retail", fbUrl: "https://www.facebook.com/mqmarqet" },
  { name: "NA-KD", category: "Women's Fashion E-com", fbUrl: "https://www.facebook.com/nakdfashion" },
  { name: "Nelly", category: "Fashion E-com", fbUrl: "https://www.facebook.com/nelly" },
  { name: "NetOnNet", category: "Electronics E-com", fbUrl: "https://www.facebook.com/netonnet" },
  { name: "Nordic Knots", category: "Rugs/Home Decor", fbUrl: "https://www.facebook.com/nordicknots" },
  { name: "Nordic Nest", category: "Home Decor E-com", fbUrl: "https://www.facebook.com/nordicnest" },
  { name: "Nudient", category: "Phone Accessories", fbUrl: "https://www.facebook.com/nudient" },
  { name: "Oscar Jacobson", category: "Men's Fashion", fbUrl: "https://www.facebook.com/oscarjacobson" },
  { name: "Outnorth", category: "Outdoor/Sports E-com", fbUrl: "https://www.facebook.com/outnorth" },
  { name: "Panduro", category: "Craft/Hobby Retail", fbUrl: "https://www.facebook.com/panduro" },
  { name: "Polarn O. Pyret", category: "Children's Fashion", fbUrl: "https://www.facebook.com/polarnopyret" },
  { name: "Rapunzel of Sweden", category: "Hair Extensions", fbUrl: "https://www.facebook.com/rapunzelofsweden" },
  { name: "RevolutionRace", category: "Outdoor/Activewear", fbUrl: "https://www.facebook.com/revolutionrace" },
  { name: "Royal Design", category: "Design/Home E-com", fbUrl: "https://www.facebook.com/royaldesignse" },
  { name: "RugVista", category: "Rugs E-com", fbUrl: "https://www.facebook.com/rugvista" },
  { name: "Rusta", category: "Home/Discount Retail", fbUrl: "https://www.facebook.com/rustabutiker" },
  { name: "Sellpy", category: "Second-hand E-com", fbUrl: "https://www.facebook.com/sellpy" },
  { name: "Stadium", category: "Sports Retail", fbUrl: "https://www.facebook.com/stadium" },
  { name: "Steamery", category: "Garment Care", fbUrl: "https://www.facebook.com/steamerysweden" },
  { name: "Stenströms", category: "Men's Shirts", fbUrl: "https://www.facebook.com/stenstromsskjortor" },
  { name: "Stronger", category: "Activewear", fbUrl: "https://www.facebook.com/strongersweden" },
  { name: "Ur&Penn", category: "Watches/Jewelry", fbUrl: "https://www.facebook.com/urochpenn" },
  { name: "Vitamin Well", category: "Beverages/Health", fbUrl: "https://www.facebook.com/vitaminwell" },
  { name: "Webhallen", category: "Electronics E-com", fbUrl: "https://www.facebook.com/webhallen" },
  { name: "XXL Sport", category: "Sports Retail", fbUrl: "https://www.facebook.com/xxlsport" },
  { name: "Åhléns", category: "Department Store", fbUrl: "https://www.facebook.com/ahlens" },
];

// Extract page ID from Facebook URL (the username/slug part)
function extractPageSlug(fbUrl: string): string {
  const match = fbUrl.match(/facebook\.com\/([^/?]+)/);
  return match ? match[1] : '';
}

async function lookupPageId(pageSlug: string): Promise<string | null> {
  // For now, use the slug as the identifier - we'll resolve actual IDs during ingestion
  // The Meta API can accept usernames for page lookup
  return pageSlug;
}

async function main() {
  console.log('Importing D-Congress 2025 brands...\n');
  console.log(`Total brands to import: ${dcongressBrands.length}\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const brand of dcongressBrands) {
    const pageSlug = extractPageSlug(brand.fbUrl);
    if (!pageSlug) {
      console.log(`  ⚠ Skipping ${brand.name} - invalid Facebook URL`);
      skipped++;
      continue;
    }

    // Check if brand already exists (by page slug or similar name)
    const existing = await prisma.adLibraryBrand.findFirst({
      where: {
        OR: [
          { pageId: pageSlug },
          { pageName: { contains: brand.name.split(' ')[0], mode: 'insensitive' } }
        ]
      }
    });

    if (existing) {
      // Update priority to mark as D-Congress brand
      await prisma.adLibraryBrand.update({
        where: { id: existing.id },
        data: {
          priority: 100, // Mark as D-Congress client
          category: brand.category,
          ingestionStatus: existing.ingestionStatus === 'active' ? 'active' : 'pending',
        }
      });
      console.log(`  ↻ Updated: ${brand.name} (existing: ${existing.pageName})`);
      updated++;
    } else {
      // Create new brand
      await prisma.adLibraryBrand.create({
        data: {
          pageId: pageSlug, // Using slug as placeholder - will be resolved during ingestion
          pageName: brand.name,
          category: brand.category,
          country: 'SE', // Most are Swedish
          priority: 100, // Mark as D-Congress client
          ingestionStatus: 'pending',
        }
      });
      console.log(`  ✓ Created: ${brand.name}`);
      created++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  // Show current D-Congress brands stats
  const dcongressStats = await prisma.adLibraryBrand.findMany({
    where: { priority: 100 },
    select: {
      pageName: true,
      category: true,
      activeAdCount: true,
      totalReach: true,
      ingestionStatus: true,
      _count: { select: { ads: true } }
    },
    orderBy: { pageName: 'asc' }
  });

  console.log(`\n=== D-Congress Brands (priority=100) ===`);
  console.log(`Total: ${dcongressStats.length} brands\n`);

  const withAds = dcongressStats.filter(b => b._count.ads > 0);
  if (withAds.length > 0) {
    console.log('Brands with ads:');
    withAds.forEach(b => {
      console.log(`  ${b.pageName}: ${b._count.ads} ads, ${b.activeAdCount} active`);
    });
  }

  const pending = dcongressStats.filter(b => b.ingestionStatus === 'pending');
  console.log(`\nPending ingestion: ${pending.length} brands`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
