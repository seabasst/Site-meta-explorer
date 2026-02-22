import { config } from 'dotenv';
config({ path: '.env.local' });

const token = process.env.FACEBOOK_ACCESS_TOKEN1 || process.env.FACEBOOK_ACCESS_TOKEN;

async function searchByName(name: string) {
  const params = new URLSearchParams({
    access_token: token!,
    search_terms: name,
    ad_reached_countries: JSON.stringify(['US', 'GB']),
    ad_type: 'ALL',
    ad_active_status: 'ACTIVE',
    fields: 'id,page_id,page_name,ad_delivery_start_time',
    limit: '5',
  });

  const res = await fetch(`https://graph.facebook.com/v19.0/ads_archive?${params}`);
  return res.json();
}

async function main() {
  const brands = ['adidas', 'Nike', 'H&M', 'Zara', 'SHEIN', 'Gucci'];

  for (const brand of brands) {
    console.log(`\n=== ${brand} ===`);
    const data = await searchByName(brand);

    if (data.error) {
      console.log('Error:', data.error.message);
    } else if (data.data?.length > 0) {
      const pages = new Map<string, string>();
      for (const ad of data.data) {
        if (ad.page_id && !pages.has(ad.page_id)) {
          pages.set(ad.page_id, ad.page_name);
        }
      }
      pages.forEach((name, id) => console.log(`  Page ID: ${id} - Name: ${name}`));
    } else {
      console.log('  No active ads found');
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1000));
  }
}

main();
