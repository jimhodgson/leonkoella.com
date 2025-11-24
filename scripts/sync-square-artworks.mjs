// scripts/sync-square-artworks.mjs
import fs from "fs/promises";

//comment
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_VERSION = process.env.SQUARE_VERSION || "2024-05-15";
const STORE_DOMAIN = process.env.SQUARE_STORE_DOMAIN; // e.g. leonkoella.square.site
const BASE = "https://connect.squareup.com";

if (!ACCESS_TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN in env");
  process.exit(1);
}
if (!STORE_DOMAIN) {
  console.error("Missing SQUARE_STORE_DOMAIN in env");
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

// List ITEM + CATEGORY so we can map category ids -> names
async function listAllItemsAndCategories() {
  let cursor = null;
  const objects = [];
  do {
    const q = new URLSearchParams({ types: "ITEM,CATEGORY" });
    if (cursor) q.set("cursor", cursor);

    const data = await squareFetch(`/v2/catalog/list?${q.toString()}`);
    objects.push(...(data.objects || []));
    cursor = data.cursor || null;
  } while (cursor);

  return objects;
}

// Batch-retrieve images to get real URLs
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

// Fetch custom attributes for a single item and return ecom_short_id (if any)
async function fetchEcomShortId(itemId) {
  const data = await squareFetch(
    `/v2/catalog/object/${itemId}/custom-attributes`
  );
  const attrs = data.custom_attributes || [];

  for (const a of attrs) {
    if (a.key === "ecom_short_id" && a.value) {
      return a.value; // usually a short slug-like id
    }
  }
  return null;
}

// Fetch short ids for many items (parallel, fine for small catalogs)
async function fetchAllShortIds(itemIds) {
  const pairs = await Promise.all(
    itemIds.map(async (id) => [id, await fetchEcomShortId(id)])
  );
  return Object.fromEntries(pairs);
}

function moneyToSimple(m) {
  if (!m || typeof m.amount !== "number") return null;
  return { amount: m.amount, currency: m.currency || "USD" };
}

function isSold(itemObj) {
  // TODO: wire to your real sold rule if you want later.
  return false;
}

function buildCategoryMap(objects) {
  const map = {};
  for (const o of objects) {
    if (o.type === "CATEGORY" && o.category_data?.name) {
      map[o.id] = o.category_data.name;
    }
  }
  return map;
}

function getCategoryIdsForItem(item) {
  const ids = [];

  if (Array.isArray(item.categories)) {
    for (const c of item.categories) {
      if (c?.id) ids.push(c.id);
    }
  }
  if (item.reporting_category?.id) ids.push(item.reporting_category.id);
  if (item.category_id) ids.push(item.category_id);

  return [...new Set(ids)];
}

async function main() {
  const objects = await listAllItemsAndCategories();
  const rawItems = objects.filter((o) => o.type === "ITEM");
  const categoryMap = buildCategoryMap(objects);

  // --- images pass ---
  const allImageIds = [];
  for (const o of rawItems) {
    const ids = o.item_data?.image_ids || [];
    allImageIds.push(...ids);
  }
  const uniqueImageIds = [...new Set(allImageIds)];
  const imageMap = await fetchImagesById(uniqueImageIds);

  // --- ecom_short_id pass ---
  const shortIdMap = await fetchAllShortIds(rawItems.map((i) => i.id));

  const artworks = rawItems.map((o) => {
    const item = o.item_data || {};
    const variations = item.variations || [];
    const firstVar = variations[0]?.item_variation_data || {};
    const price_money = moneyToSimple(firstVar.price_money);

    const images = (item.image_ids || [])
      .map((id) => imageMap[id])
      .filter(Boolean);

    const catIds = getCategoryIdsForItem(item);
    const categoryNames = catIds
      .map((id) => categoryMap[id])
      .filter(Boolean);

    const categories = [...new Set(categoryNames)]
      .map((n) => n.trim().toLowerCase());

    const shortId = shortIdMap[o.id];
    const url = shortId
      ? `https://${STORE_DOMAIN}/products/${shortId}`
      : null;

    return {
      id: o.id,
      name: item.name,
      description: item.description_plaintext || item.description || "",
      price_money,
      images,
      url,
      sold: isSold(o),
      categories,
      category: categories[0] || null,
      updated_at: o.updated_at || null,
      ecom_short_id: shortId || null, // handy to keep for debugging
    };
  });

  artworks.sort((a, b) =>
    (b.updated_at || "").localeCompare(a.updated_at || "")
  );

  await fs.mkdir("_data", { recursive: true });
  await fs.writeFile("_data/artworks.json", JSON.stringify(artworks, null, 2));
  console.log(`Wrote ${artworks.length} artworks to _data/artworks.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
