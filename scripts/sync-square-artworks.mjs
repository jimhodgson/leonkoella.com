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

async function fetchFullItemsById(itemIds) {
  const chunks = [];
  for (let i = 0; i < itemIds.length; i += 100) {
    chunks.push(itemIds.slice(i, i + 100));
  }

  const fullMap = {};
  for (const chunk of chunks) {
    const data = await squareFetch("/v2/catalog/batch-retrieve", {
      method: "POST",
      body: { object_ids: chunk },
    });

    for (const obj of data.objects || []) {
      if (obj.type === "ITEM") fullMap[obj.id] = obj;
    }
  }

  return fullMap;
}

function isHeroFromCustomAttributes(fullItem) {
  const values = fullItem?.custom_attribute_values || {};
  for (const key in values) {
    const attr = values[key];
    const name = attr?.name?.toLowerCase();
    const val = attr?.string_value?.trim();

    if ((name === "hero" || key.includes("hero")) && val === "1") {
      return true;
    }
  }
  return false;
}

function moneyToSimple(m) {
  if (!m || typeof m.amount !== "number") return null;
  return { amount: m.amount, currency: m.currency || "USD" };
}

function isSold(itemObj) {
  const item = itemObj.item_data;
  if (!item || !Array.isArray(item.variations)) return false;

  // Check each variation
  for (const variation of item.variations) {
    const v = variation.item_variation_data;
    if (!v) continue;

    // Check location overrides
    const overrides = v.location_overrides || [];
    for (const o of overrides) {
      if (o.sold_out === true) {
        return true;
      }
    }

    // Fallback: if tracking inventory AND stock is 0
    if (v.track_inventory && v.inventory_alert_type === "NONE") {
      // optional: Square doesn’t always return inventory counts here
    }
  }

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

function slugifyName(name) {
  if (!name) return "";
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")        // remove quotes
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanum with -
    .replace(/^-+|-+$/g, "");    // trim leading/trailing -
}

async function main() {
  const objects = await listAllItemsAndCategories();
  const rawItems = objects.filter((o) => o.type === "ITEM");
  const categoryMap = buildCategoryMap(objects);
  const fullItemMap = await fetchFullItemsById(rawItems.map(i => i.id));


  // --- images pass ---
  const allImageIds = [];
  for (const o of rawItems) {
    const ids = o.item_data?.image_ids || [];
    allImageIds.push(...ids);
  }
  const uniqueImageIds = [...new Set(allImageIds)];
  const imageMap = await fetchImagesById(uniqueImageIds);

  const artworks = rawItems.map((o) => {
    //const item = o.item_data || {};
    //added when trying to add hero designation
    const full = fullItemMap[o.id];
    const item = full?.item_data || o.item_data || {};
    const isHero = isHeroFromCustomAttributes(full);
    //end of paste into this section
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

    const slug = slugifyName(item.name);
    const url =
    slug && STORE_DOMAIN
        ? `https://${STORE_DOMAIN}/product/${slug}/${o.id}`
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
      hero: isHero,
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
