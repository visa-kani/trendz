/**
 * Development-only demo data. Never runs in production (see seed.ts).
 * Creates a small but realistic apparel catalog with images, so every screen
 * of the storefront, admin and POS has something to show.
 */
import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { storage } from "../src/integrations/r2/storage";
import { systemContext } from "../src/modules/audit/audit.service";
import { createCategory } from "../src/modules/catalog/categories.service";
import { createProduct } from "../src/modules/catalog/products.service";
import { processImage } from "../src/modules/media/images.service";
import type { ProductInput } from "../src/modules/catalog/products.schemas";
import { adjustStock } from "../src/modules/inventory/inventory.service";
import { createPurchaseOrder, transitionPurchaseOrder } from "../src/modules/purchasing/purchase-orders.service";

const ASSETS = path.join(__dirname, "demo-assets");

const CATEGORY_TREE: Record<string, { name: string; children: string[] }> = {
  women: { name: "Women", children: ["Tops", "Bottoms", "Knitwear", "Sets", "Outerwear"] },
  men: { name: "Men", children: ["Shirts", "Bottoms", "Outerwear"] },
  unisex: { name: "Unisex", children: ["Tees", "Hoodies", "Sets"] },
};

const COLOR_CODES: Record<string, string> = {
  Black: "BLK", Brown: "BRN", Cream: "CRM", Ecru: "ECR", Navy: "NVY", Forest: "FST", Grey: "GRY", Ink: "INK", Sage: "SGE",
  Berry: "BRY", Pink: "PNK", Charcoal: "CHR", Maroon: "MRN", Stone: "STN", Indigo: "IND", "Light Wash": "LTW", Red: "RED",
  Olive: "OLV", White: "WHT", Teal: "TEA", Khaki: "KHK", Crimson: "CRI", Rust: "RST", Camel: "CML", Blue: "BLU",
};

interface DemoProduct {
  name: string;
  code: string;
  category: string; // "women/Tops"
  brand: string;
  mrp: number; // rupees
  price: number; // rupees
  colors: string[];
  sizes: string[];
  image: string;
  type: string;
  hsn: string;
  tags: string[];
  featured?: boolean;
  description: string;
}

const APPAREL_SIZES = ["XS", "S", "M", "L", "XL"];
const WAIST_SIZES = ["28", "30", "32", "34", "36"];

const PRODUCTS: DemoProduct[] = [
  { name: "Chaotic Star Cargo Set", code: "UST-1001", category: "unisex/Sets", brand: "Drift", mrp: 5999, price: 4999, colors: ["Navy", "Ecru", "Black"], sizes: APPAREL_SIZES, image: "chaotic-star-cargo-set.png", type: "Co-ord set", hsn: "6203", tags: ["streetwear", "denim", "new"], featured: true, description: "A graphic tee and hand-painted star cargo pant set — distressed wide-leg denim paired with an oversized printed jersey top." },
  { name: "Unbroken Relaxed Tee", code: "UTE-1002", category: "unisex/Tees", brand: "Drift", mrp: 1799, price: 1499, colors: ["Forest", "Cream", "Grey"], sizes: APPAREL_SIZES, image: "unbroken-relaxed-tee.png", type: "T-shirt", hsn: "6109", tags: ["tee", "cotton", "oversized"], featured: true, description: "Relaxed-fit crest tee in washed cotton jersey, styled with a dropped shoulder seam and ribbed collar for everyday off-duty wear." },
  { name: "Ink Linen Shirt", code: "MSH-1003", category: "men/Shirts", brand: "Drift Studio", mrp: 2999, price: 2499, colors: ["Ink", "Ecru", "Sage"], sizes: APPAREL_SIZES, image: "ink-linen-shirt.png", type: "Shirt", hsn: "6205", tags: ["linen", "summer"], description: "A clean-lined linen-blend shirt with a soft point collar and single chest pocket, tailored for a straight, easy fit." },
  { name: "Unbroken Stripe Tee", code: "UTE-1004", category: "unisex/Tees", brand: "Drift", mrp: 1899, price: 1599, colors: ["Berry", "Pink", "Black"], sizes: APPAREL_SIZES, image: "unbroken-stripe-tee.png", type: "T-shirt", hsn: "6109", tags: ["tee", "stripes", "oversized"], description: "Bold stripe crest tee in oversized cotton jersey, dropped shoulder and curved hem for a lived-in streetwear fit." },
  { name: "Midnight Cami Set", code: "WST-1005", category: "women/Sets", brand: "Drift Studio", mrp: 5499, price: 4799, colors: ["Black", "Charcoal", "Ecru"], sizes: APPAREL_SIZES, image: "midnight-cami-set.png", type: "Co-ord set", hsn: "6204", tags: ["evening", "co-ord"], featured: true, description: "A ribbed cami top paired with belted wide-leg trousers — a fluid, tonal set designed to be worn together or separately." },
  { name: "Chaotic Zip Hoodie", code: "UHD-1006", category: "unisex/Hoodies", brand: "Drift", mrp: 3999, price: 3499, colors: ["Maroon", "Stone", "Black"], sizes: APPAREL_SIZES, image: "chaotic-zip-hoodie.png", type: "Hoodie", hsn: "6110", tags: ["hoodie", "fleece", "winter"], featured: true, description: "Full-zip graphic hoodie in brushed fleece with tonal print sleeves, cut oversized and paired effortlessly with relaxed sweatpants." },
  { name: "Utility Overshirt", code: "MOW-1007", category: "men/Outerwear", brand: "Nomad Lane", mrp: 3999, price: 3299, colors: ["Brown", "Black", "Olive"], sizes: APPAREL_SIZES, image: "utility-overshirt.jpg", type: "Overshirt", hsn: "6201", tags: ["layering", "workwear"], description: "A heavyweight cotton twill overshirt with patch pockets and a boxy fit — the easiest layer over a tee." },
  { name: "Wide-Leg Denim", code: "WBT-1008", category: "women/Bottoms", brand: "Drift", mrp: 3499, price: 2799, colors: ["Light Wash", "Indigo"], sizes: WAIST_SIZES, image: "wide-leg-denim.jpg", type: "Jeans", hsn: "6204", tags: ["denim", "wide-leg"], featured: true, description: "High-rise, full-length wide-leg jeans in rigid cotton denim with a clean front and a puddle hem." },
  { name: "Ribbed Turtleneck Sweater", code: "WKN-1009", category: "women/Knitwear", brand: "Drift Studio", mrp: 3299, price: 2999, colors: ["Red", "Cream", "Black"], sizes: APPAREL_SIZES, image: "ribbed-turtleneck.jpg", type: "Sweater", hsn: "6110", tags: ["knit", "winter"], description: "A chunky rib-knit turtleneck in a soft wool blend with a relaxed body and long, stacked sleeves." },
  { name: "Heartfelt Graphic Tee", code: "UTE-1010", category: "unisex/Tees", brand: "Drift", mrp: 1499, price: 1299, colors: ["White", "Black"], sizes: APPAREL_SIZES, image: "heartfelt-graphic-tee.jpg", type: "T-shirt", hsn: "6109", tags: ["tee", "graphic"], description: "Heavyweight boxy tee with a soft-hand front print. Pairs with everything from baggy denim to cargos." },
  { name: "Tailored Blazer Suit Set", code: "WST-1011", category: "women/Sets", brand: "Drift Studio", mrp: 8999, price: 7499, colors: ["Rust", "Black"], sizes: APPAREL_SIZES, image: "tailored-suit-set.jpg", type: "Suit", hsn: "6204", tags: ["tailoring", "occasion"], featured: true, description: "A single-breasted blazer with matching straight-leg trousers in a fluid suiting fabric." },
  { name: "Off-Shoulder Knit Top", code: "WTP-1012", category: "women/Tops", brand: "Nomad Lane", mrp: 1999, price: 1699, colors: ["Brown", "Black", "Cream"], sizes: APPAREL_SIZES, image: "off-shoulder-top.jpg", type: "Top", hsn: "6206", tags: ["knit", "evening"], description: "A fitted, fine-rib knit top with an asymmetric off-shoulder neckline and long sleeves." },
  { name: "Olive Linen Shirt", code: "MSH-1013", category: "men/Shirts", brand: "Nomad Lane", mrp: 2799, price: 2299, colors: ["Olive", "White"], sizes: APPAREL_SIZES, image: "olive-linen-shirt.jpg", type: "Shirt", hsn: "6205", tags: ["linen", "summer"], description: "Washed pure linen shirt with a band collar and relaxed fit — made for warm days." },
  { name: "Halter Rib Top", code: "WTP-1014", category: "women/Tops", brand: "Drift", mrp: 1299, price: 999, colors: ["Brown", "Black"], sizes: APPAREL_SIZES, image: "halter-rib-top.jpg", type: "Top", hsn: "6206", tags: ["rib", "summer"], description: "A stretch-rib halter top with a high neck and clean finish. Tuck it into wide-leg denim." },
  { name: "Puff Sleeve Corset Top", code: "WTP-1015", category: "women/Tops", brand: "Drift Studio", mrp: 1999, price: 1599, colors: ["White", "Black"], sizes: APPAREL_SIZES, image: "puff-sleeve-top.jpg", type: "Top", hsn: "6206", tags: ["corset", "party"], description: "A structured corset-style top with sweetheart neckline and soft puff sleeves." },
  { name: "Cargo Denim Shorts", code: "MBT-1016", category: "men/Bottoms", brand: "Drift", mrp: 1999, price: 1699, colors: ["Light Wash", "Indigo"], sizes: WAIST_SIZES, image: "cargo-denim-shorts.jpg", type: "Shorts", hsn: "6203", tags: ["denim", "summer", "cargo"], description: "Knee-length denim shorts with utility cargo pockets and a relaxed straight leg." },
  { name: "Pleated High-Waist Trousers", code: "MBT-1017", category: "men/Bottoms", brand: "Nomad Lane", mrp: 3499, price: 2999, colors: ["Brown", "Khaki", "Black"], sizes: WAIST_SIZES, image: "pleated-trousers.jpg", type: "Trousers", hsn: "6203", tags: ["tailoring", "pleated"], description: "Double-pleated, high-rise trousers with a wide leg and adjustable side tabs." },
  { name: "Crimson Pullover Hoodie", code: "UHD-1018", category: "unisex/Hoodies", brand: "Drift", mrp: 2999, price: 2499, colors: ["Crimson", "Grey", "Black"], sizes: APPAREL_SIZES, image: "crimson-hoodie.jpg", type: "Hoodie", hsn: "6110", tags: ["hoodie", "fleece"], description: "Classic pullover hoodie in loopback cotton fleece with a kangaroo pocket and double-layer hood." },
  { name: "Cropped Denim Jacket", code: "WOW-1019", category: "women/Outerwear", brand: "Drift", mrp: 3999, price: 3499, colors: ["Light Wash", "Indigo"], sizes: APPAREL_SIZES, image: "cropped-denim-jacket.jpg", type: "Jacket", hsn: "6202", tags: ["denim", "layering"], description: "A cropped trucker jacket in mid-weight denim with chest flap pockets and a boxy fit." },
  { name: "Retro Camp Collar Shirt", code: "MSH-1020", category: "men/Shirts", brand: "Drift Studio", mrp: 2499, price: 2199, colors: ["Teal", "Cream"], sizes: APPAREL_SIZES, image: "camp-collar-shirt.jpg", type: "Shirt", hsn: "6205", tags: ["retro", "summer"], description: "A short-sleeve camp collar shirt with contrast piping and a boxy, cropped fit." },
];

async function uploadDemoImage(prisma: PrismaClient, productId: string, file: string, alt: string) {
  const buffer = fs.readFileSync(path.join(ASSETS, file));
  const contentType = file.endsWith(".png") ? "image/png" : "image/jpeg";
  const image = await prisma.productImage.create({
    data: { productId, objectKey: `uploads/products/${productId}/demo/${Date.now().toString(36)}`, altText: alt, sortOrder: 0, status: "PROCESSING", mimeType: contentType, bytes: buffer.length },
  });
  const objectKey = `uploads/products/${productId}/${image.id}/${Date.now().toString(36)}`;
  await prisma.productImage.update({ where: { id: image.id }, data: { objectKey } });
  await storage().put(objectKey, buffer, contentType, "private, no-store");
  await processImage(image.id); // same pipeline the worker runs
}

export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  if ((await prisma.product.count()) > 0) {
    console.log("• demo catalog skipped (products already exist)");
  } else {
    await seedDemoCatalog(prisma);
  }
  await seedDemoInventory(prisma);
}

/** Opening stock in two locations, a supplier and an approved purchase order. */
async function seedDemoInventory(prisma: PrismaClient) {
  if ((await prisma.inventoryTransaction.count()) > 0) {
    console.log("• demo inventory skipped (stock movements already exist)");
    return;
  }
  const main = await prisma.warehouse.findFirstOrThrow({ where: { code: "WH-001" } });
  const store =
    (await prisma.warehouse.findUnique({ where: { code: "WH-002" } })) ??
    (await prisma.warehouse.create({
      data: {
        code: "WH-002",
        name: "City Store (POS)",
        addressLine1: "14 Khader Nawaz Khan Road",
        city: "Chennai",
        state: "Tamil Nadu",
        stateCode: "33",
        postalCode: "600006",
        isOnlineFulfillment: false,
        priority: 50,
      },
    }));

  const variants = await prisma.productVariant.findMany({ select: { id: true, sku: true }, orderBy: { sku: "asc" } });
  // Deterministic pseudo-random quantities so every reseed looks the same.
  const qty = (sku: string, salt: number) => [...sku].reduce((h, c) => (h * 31 + c.charCodeAt(0) + salt) % 997, 7) % 18;
  const mainItems = variants.map((v) => ({ variantId: v.id, mode: "set" as const, quantity: qty(v.sku, 1) === 0 ? 0 : qty(v.sku, 1) + 2, bucket: "ON_HAND" as const }));
  const storeItems = variants.filter((_, i) => i % 3 === 0).map((v) => ({ variantId: v.id, mode: "set" as const, quantity: qty(v.sku, 2) % 6, bucket: "ON_HAND" as const }));
  await adjustStock({ warehouseId: main.id, reason: "OPENING_STOCK", notes: "Demo opening stock", items: mainItems }, systemContext);
  await adjustStock({ warehouseId: store.id, reason: "OPENING_STOCK", notes: "Demo opening stock", items: storeItems }, systemContext);

  const supplier = await prisma.supplier.create({
    data: {
      code: "SUP-001",
      name: "Tiruppur Knit Works",
      companyName: "Tiruppur Knit Works Pvt Ltd (demo)",
      contactPerson: "R. Senthil",
      phone: "+919800000001",
      email: "orders@tkw.example",
      gstin: "33AABCT1332L1ZQ",
      city: "Tiruppur",
      state: "Tamil Nadu",
      stateCode: "33",
      paymentTermsDays: 30,
      paymentTerms: "Net 30",
    },
  });
  const po = await createPurchaseOrder(
    {
      supplierId: supplier.id,
      warehouseId: main.id,
      shippingCost: 0,
      notes: "Demo restock",
      items: variants.slice(0, 6).map((v) => ({ variantId: v.id, quantity: 20, unitCost: 45000, taxRateBps: 500 })),
    },
    systemContext,
  );
  await transitionPurchaseOrder(po.id, "submit", systemContext);
  await transitionPurchaseOrder(po.id, "approve", systemContext);
  console.log(`✔ demo inventory: stock in ${main.code} and ${store.code}, supplier ${supplier.code}, approved ${po.number}`);
}

async function seedDemoCatalog(prisma: PrismaClient): Promise<void> {

  // Categories
  const categoryIds = new Map<string, string>();
  for (const [key, def] of Object.entries(CATEGORY_TREE)) {
    const root = await createCategory({ name: def.name, slug: key, sortOrder: Object.keys(CATEGORY_TREE).indexOf(key) }, systemContext);
    for (const [i, child] of def.children.entries()) {
      const c = await createCategory({ name: child, slug: `${key}-${child.toLowerCase()}`, parentId: root.id, sortOrder: i }, systemContext);
      categoryIds.set(`${key}/${child}`, c.id);
    }
  }

  // Brands
  const brandIds = new Map<string, string>();
  for (const name of ["Drift", "Drift Studio", "Nomad Lane"]) {
    const b = await prisma.brand.create({ data: { name, slug: name.toLowerCase().replace(/\s+/g, "-") } });
    brandIds.set(name, b.id);
  }

  const apparel = await prisma.taxClass.findUnique({ where: { code: "APPAREL" } });

  for (const d of PRODUCTS) {
    const variants: ProductInput["variants"] = [];
    for (const color of d.colors) {
      for (const size of d.sizes) {
        variants.push({
          sku: `${d.code}-${COLOR_CODES[color] ?? color.slice(0, 3).toUpperCase()}-${size}`,
          options: { Color: color, Size: size },
          mrp: d.mrp * 100,
          sellingPrice: d.price * 100,
          costPrice: Math.round(d.price * 100 * 0.45),
          weightGrams: d.type === "Co-ord set" || d.type === "Suit" ? 900 : 400,
          status: "ACTIVE",
        });
      }
    }
    const product = await createProduct(
      {
        name: d.name,
        baseSku: d.code,
        description: `<p>${d.description}</p><ul><li>Regular care: machine wash cold, dry in shade</li><li>Model is 5'9" and wears size M</li></ul>`,
        shortDescription: d.description,
        categoryId: categoryIds.get(d.category)!,
        brandId: brandIds.get(d.brand)!,
        productType: d.type,
        status: "ACTIVE",
        taxClassId: apparel?.id ?? null,
        hsnCode: d.hsn,
        minStockLevel: 3,
        weightGrams: 400,
        lengthMm: 300,
        widthMm: 250,
        heightMm: 40,
        tags: d.tags,
        isFeatured: d.featured ?? false,
        seoTitle: `${d.name} | Drift`,
        seoDescription: d.description.slice(0, 160),
        options: [
          { name: "Color", values: d.colors },
          { name: "Size", values: d.sizes },
        ],
        variants,
      },
      systemContext,
    );
    await uploadDemoImage(prisma, product.id, d.image, d.name);
  }
  console.log(`✔ demo catalog: ${PRODUCTS.length} products with images`);
}
