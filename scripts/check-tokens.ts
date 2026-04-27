import { config } from 'dotenv';
config({ path: '.env.local' });

async function checkToken(name: string) {
  const token = process.env[name];
  if (!token) { console.log(`${name}: not set`); return; }

  try {
    const res = await fetch("https://graph.facebook.com/v22.0/ads_archive?" + new URLSearchParams({
      access_token: token,
      search_terms: "nike",
      ad_reached_countries: JSON.stringify(["US"]),
      ad_type: "ALL",
      ad_active_status: "ACTIVE",
      fields: "page_name",
      limit: "1",
    }));
    const d = await res.json();
    if (d.error) {
      console.log(`${name}: EXPIRED/ERROR — ${d.error.message} (code ${d.error.code})`);
    } else {
      console.log(`${name}: OK — ${d.data?.length || 0} results (${d.data?.[0]?.page_name || "none"})`);
    }
  } catch (e) {
    console.log(`${name}: FETCH ERROR — ${e}`);
  }
}

async function main() {
  await checkToken("FACEBOOK_ACCESS_TOKEN1");
  await checkToken("FACEBOOK_ACCESS_TOKEN2");
  await checkToken("FACEBOOK_ACCESS_TOKEN3");
}

main();
