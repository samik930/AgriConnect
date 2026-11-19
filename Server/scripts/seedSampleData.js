import dotenv from "dotenv";
import { query } from "../src/db/index.js";

dotenv.config();

async function seedSampleData() {
  console.log("🌱 Seeding sample agricultural schemes, technologies, trainings, and market prices...");

  // Find admin user to attribute schemes & technologies
  const adminRes = await query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (adminRes.rows.length === 0) {
    console.error("❌ Admin user not found. Please run seedAdmin.js first.");
    process.exit(1);
  }
  const adminId = adminRes.rows[0].id;

  // 1. SCHEMES
  const schemes = [
    {
      title: "Pradhan Mantri Krishi Sinchayee Yojana (PMKSY) - Per Drop More Crop",
      description: "Subsidies up to 55% for small/marginal farmers and 45% for other farmers for installing Drip and Sprinkler irrigation systems to improve water use efficiency.",
      state: "Maharashtra",
      district: "All",
      eligibility: "Farmers with cultivable land and an assured water source (well, borewell, or canal). Priority for small and marginal farmers.",
      application_link: "https://pmksy.gov.in",
    },
    {
      title: "MahaDBT Micro Irrigation Subsidy Scheme",
      description: "State government subsidy providing up to 80% total financial assistance (supplementary to PMKSY) for micro/drip irrigation equipment in drought-prone talukas.",
      state: "Maharashtra",
      district: "Pune",
      eligibility: "All registered farmers in Maharashtra with 7/12 land extract and Aadhaar linkage.",
      application_link: "https://mahadbt.maharashtra.gov.in",
    },
    {
      title: "PM-KUSUM Component-B (Standalone Solar Agriculture Pumps)",
      description: "Financial assistance up to 60% (30% central + 30% state) for farmers to install standalone solar water pumps of up to 7.5 HP capacity for irrigation.",
      state: "Maharashtra",
      district: "All",
      eligibility: "Individual farmers, water user associations, and farmer producer organizations without existing grid-connected electric pumps.",
      application_link: "https://pmkusum.mnre.gov.in",
    },
    {
      title: "Sub-Mission on Agricultural Mechanization (SMAM)",
      description: "Subsidies ranging from 40% to 50% on agricultural machinery such as rotavators, power tillers, seed drills, and combine harvesters.",
      state: "All",
      district: "All",
      eligibility: "Individual farmers, SHGs, and cooperatives across all states.",
      application_link: "https://agrimachinery.nic.in",
    },
  ];

  for (const s of schemes) {
    await query(
      `INSERT INTO schemes (title, description, state, district, eligibility, application_link, published_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [s.title, s.description, s.state, s.district, s.eligibility, s.application_link, adminId]
    );
  }
  console.log(`✅ Seeded ${schemes.length} schemes.`);

  // 2. TECHNOLOGIES
  const technologies = [
    {
      title: "Automated Drip & Fertigation System",
      description: "Combines drip irrigation with automated fertilizer injection directly into the plant root zone, reducing water waste by 60% and fertilizer cost by 35%.",
      state: "All",
      district: "All",
      resource_link: "https://icar.org.in/node/10294",
    },
    {
      title: "IoT Soil Moisture & Ambient Climate Sensors",
      description: "Solar-powered field sensors that transmit real-time soil moisture and leaf wetness metrics to smartphone apps, preventing over-watering and root rot.",
      state: "Maharashtra",
      district: "Pune",
      resource_link: "https://krishi.icar.gov.in",
    },
    {
      title: "Agricultural Drone Spraying for Crop Protection",
      description: "High-precision pesticide and foliar fertilizer spraying using autonomous multi-rotor drones, reducing chemical exposure and completing 10 acres per hour.",
      state: "All",
      district: "All",
      resource_link: "https://agricoop.nic.in/en/drone",
    },
  ];

  for (const t of technologies) {
    await query(
      `INSERT INTO technologies (title, description, state, district, resource_link, published_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [t.title, t.description, t.state, t.district, t.resource_link, adminId]
    );
  }
  console.log(`✅ Seeded ${technologies.length} technologies.`);

  // 3. TRAININGS
  const trainings = [
    {
      title: "Advanced Micro-Irrigation & Fertigation Masterclass",
      organizer: "Maharashtra Department of Agriculture & ICAR-NIASM",
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: "Pune Krishi Vigyan Kendra (KVK), Maharashtra",
      registration_link: "https://agri.maharashtra.gov.in/trainings",
    },
    {
      title: "Organic Crop Production and Export Standards",
      organizer: "APEDA & AgriConnect Farming Network",
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      location: "Nashik Agricultural Produce Market Committee (APMC)",
      registration_link: "https://apeda.gov.in/trainings",
    },
  ];

  for (const tr of trainings) {
    await query(
      `INSERT INTO trainings (title, organizer, date, location, registration_link)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [tr.title, tr.organizer, tr.date, tr.location, tr.registration_link]
    );
  }
  console.log(`✅ Seeded ${trainings.length} trainings.`);

  // 4. MARKET PRICES
  const marketPrices = [
    { crop_name: "Tomato", district: "Pune", market_price: 24.50, unit: "kg" },
    { crop_name: "Onion", district: "Nashik", market_price: 28.00, unit: "kg" },
    { crop_name: "Wheat", district: "Pune", market_price: 29.00, unit: "kg" },
    { crop_name: "Rice (Basmati)", district: "Ludhiana", market_price: 68.00, unit: "kg" },
    { crop_name: "Potato", district: "Pune", market_price: 18.00, unit: "kg" },
    { crop_name: "Cotton", district: "Nagpur", market_price: 72.00, unit: "kg" },
  ];

  for (const mp of marketPrices) {
    await query(
      `INSERT INTO market_prices (crop_name, district, market_price, unit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [mp.crop_name, mp.district, mp.market_price, mp.unit]
    );
  }
  console.log(`✅ Seeded ${marketPrices.length} market prices.`);

  console.log("🌾 All sample agricultural data successfully seeded into Supabase!");
  process.exit(0);
}

seedSampleData().catch((err) => {
  console.error("❌ Seeding error:", err);
  process.exit(1);
});

