import { z } from "zod";

/**
 * Typed business settings. Every rule that affects money, stock or tax and is
 * not fixed by law lives here so the business can change it without a deploy.
 * Defaults are placeholders that must be confirmed before go-live.
 */

const address = z.object({
  line1: z.string().max(200).default(""),
  line2: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(100).default(""),
  stateCode: z.string().regex(/^\d{2}$/, "2-digit GST state code").default("33"),
  postalCode: z.string().max(12).default(""),
  country: z.string().length(2).default("IN"),
});

export const settingSchemas = {
  store: z.object({
    displayName: z.string().min(1).max(100).default("Trendz"),
    legalName: z.string().max(200).default("Trendz Retail Private Limited (placeholder)"),
    gstin: z.string().max(15).default(""),
    email: z.string().max(200).default("support@trendz.local"),
    phone: z.string().max(20).default(""),
    // address.stateCode is the seller's GST registration state; it decides
    // CGST+SGST (intra-state supply) vs IGST (inter-state supply).
    address: address.default(address.parse({})),
    currency: z.literal("INR").default("INR"),
  }),
  pricing: z.object({
    pricesIncludeTax: z.boolean().default(true),
    roundGrandTotal: z.boolean().default(false),
  }),
  shipping: z.object({
    mode: z.enum(["FLAT", "PROVIDER_RATES"]).default("FLAT"),
    flatRate: z.number().int().min(0).default(4900),
    freeShippingThreshold: z.number().int().min(0).nullable().default(99900),
    chargeTaxable: z.boolean().default(false),
    taxRateBps: z.number().int().min(0).max(10000).default(0),
    defaultWeightGrams: z.number().int().positive().default(500),
    defaultLengthCm: z.number().positive().default(25),
    defaultWidthCm: z.number().positive().default(20),
    defaultHeightCm: z.number().positive().default(5),
  }),
  checkout: z.object({
    reservationTtlMinutes: z.number().int().min(5).max(24 * 60).default(30),
    allowGuestCheckout: z.boolean().default(false),
    maxQuantityPerLine: z.number().int().min(1).max(1000).default(10),
  }),
  returns: z.object({
    windowDays: z.number().int().min(0).max(365).default(7),
    autoRestockGood: z.boolean().default(true),
  }),
  refunds: z.object({
    allowPartial: z.boolean().default(true),
  }),
  pos: z.object({
    maxManualDiscountBps: z.number().int().min(0).max(10000).default(1000),
    enabledPaymentMethods: z
      .array(z.enum(["CASH", "UPI_MANUAL", "CARD_MANUAL", "RAZORPAY"]))
      .default(["CASH", "UPI_MANUAL", "RAZORPAY"]),
  }),
  coupons: z.object({
    allowWithAutomaticDiscounts: z.boolean().default(true),
  }),
  invoice: z.object({
    // GST: invoice numbers ≤ 16 chars → prefix ≤ 4 (e.g. INV/2627/000123).
    prefix: z.string().regex(/^[A-Z0-9]{1,4}$/).default("INV"),
    creditNotePrefix: z.string().regex(/^[A-Z0-9]{1,4}$/).default("CN"),
    footerNote: z.string().max(500).default("Thank you for shopping with us."),
    terms: z.string().max(2000).default("Goods once sold are subject to the store return policy."),
  }),
  barcodes: z.object({
    // 200-299 is the GS1 range reserved for in-store / restricted use.
    // Replace with your GS1 company prefix if you own one.
    ean13Prefix: z.string().regex(/^\d{3,10}$/).default("200"),
  }),
  inventory: z.object({
    defaultLowStockThreshold: z.number().int().min(0).default(5),
    lowStockAlertEmails: z.array(z.email()).default([]),
  }),
  notifications: z.object({
    emailEnabled: z.boolean().default(true),
    smsEnabled: z.boolean().default(true),
    adminEmails: z.array(z.email()).default([]),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

/** Settings safe to expose to anonymous storefront visitors. */
export const PUBLIC_SETTING_KEYS = ["store", "pricing", "shipping", "checkout", "returns"] as const;
