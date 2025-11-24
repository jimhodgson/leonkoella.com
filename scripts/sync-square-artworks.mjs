// scripts/sync-square-artworks.mjs
import fs from "fs/promises";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_VERSION = process.env.SQUARE_VERSION || "2024-05-15";
const BASE = "https://connect.squareup.com";

if (!ACCESS_TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN in env");
  process.exit(1);
}

async function squareFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Square error ${res.status}: ${text}`);
  }
  return res.json();
}

// 1) List all catalog ITEMs (products)
async function listAllItems() {
  let cursor = null;
  const items = [];
  do {
    const q = new URLSearchParams({ types: "ITEM" });
    if (cursor) q.set("cursor", cursor);
    const data = await squareFetch(`/v2/catalog/list?${q.toString()}`);
    items.push(...(data.objects || []));
    cursor = data.cursor || null;
  } while (cursor);
  return items;
}

// 2) Batch-retrieve images to get real URLs
async function fetchImagesById(imageIds) {
  if (imageIds.length === 0) return {};
  const chunks = [];
  for (let i = 0; i < imageIds.length; i += 100) {
    chunks.push(imageIds.slice(i, i + 100));
  }

  const idToUrl = {};
  for (const chunk of chunks) {
    const data = await squareFetch("/v2/catalog/batch-retrieve", {
      method: "POST",
      body: { object_ids: chunk },
    });
    for (const obj of data.objects || []) {
      if (obj.type === "IMAGE") {
        idToUrl[obj.id] = obj.image_data?.url || null;
      }
    }
  }
  return idToUrl;
}

function moneyToSimple(m) {
  if (!m || typeof m.amount !== "number") return null;
  return { amount: m.amount, currency: m.currency || "USD" };
}

function isSold(itemObj) {
  // CHANGE THIS to match your "sold" rule.
  // Some options:
  // 1) inventory 0 (if you track inventory)
  // 2) category name "Sold"
  // 3) custom attribute
  return false;
}

async function main() {
  const rawItems = await listAllItems();

  // Collect all image IDs referenced on items
  const allImageIds = [];
  for (const o of rawItems) {
    const ids = o.item_data?.image_ids || [];
    allImageIds.push(...ids);
  }
  const uniqueImageIds = [...new Set(allImageIds)];
  const imageMap = await fetchImagesById(uniqueImageIds);

  // Shape a public, Jekyll-friendly dataset
  const artworks = rawItems.map((o) => {
    const item = o.item_data || {};
    const variations = item.variations || [];
    const firstVar = variations[0]?.item_variation_data || {};
    const price_money = moneyToSimple(firstVar.price_money);

    const images = (item.image_ids || [])
      .map((id) => imageMap[id])
      .filter(Boolean);

    return {
      id: o.id,
      name: item.name,
      description: item.description || "",
      price_money,
      images,
      url: item.ecom_uri || null, // if present on your account
      sold: isSold(o),
      // optional for sorting:
      updated_at: o.updated_at || null,
    };
  });

  // Sort newest first if you want:
  artworks.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  await fs.mkdir("_data", { recursive: true });
  await fs.writeFile("_data/artworks.json", JSON.stringify(artworks, null, 2));
  console.log(`Wrote ${artworks.length} artworks to _data/artworks.json`);
  // Didn't see anything written to console? 
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
