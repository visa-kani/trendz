/** Shapes returned by the API (money in paise, rates in basis points). */

import type { Appearance } from "./theme";

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  isStaff: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  defaultWarehouseId: string | null;
  roles: string[];
  permissions: string[];
}

export interface ImageView {
  id: string;
  altText: string | null;
  variantId: string | null;
  sortOrder: number;
  status: string;
  width: number | null;
  height: number | null;
  url: string | null;
  thumb: string | null;
  medium: string | null;
  large: string | null;
  avif: { medium: string | null; large: string | null };
  error?: string | null;
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string };
  mrp: number;
  sellingPrice: number;
  discountPercent: number;
  inStock: boolean;
  isFeatured: boolean;
  image: ImageView | null;
  hoverImage: ImageView | null;
  options: { name: string; values: string[] }[];
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  baseSku: string;
  description: string | null;
  shortDescription: string | null;
  productType: string | null;
  brand: { name: string; slug: string } | null;
  category: { id: string; name: string; slug: string };
  breadcrumb: { id: string; name: string; slug: string }[];
  hsnCode: string | null;
  tags: string[];
  mrp: number;
  sellingPrice: number;
  seo: { title: string; description: string | null; keywords: string | null };
  options: { name: string; values: string[] }[];
  images: ImageView[];
  variants: {
    id: string;
    sku: string;
    title: string;
    options: Record<string, string>;
    mrp: number;
    sellingPrice: number;
    isDefault: boolean;
    purchasable: boolean;
    inStock: boolean;
    lowStock: boolean;
  }[];
  related: ProductCard[];
  updatedAt: string;
}

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  depth: number;
  parentId: string | null;
  productCount?: number;
  children: CategoryNode[];
}

export interface StoreConfig {
  store: { name: string; email: string; phone: string; currency: string };
  pricesIncludeTax: boolean;
  shipping: { mode: string; flatRate: number; freeShippingThreshold: number | null };
  returns: { windowDays: number };
  checkout: { allowGuestCheckout: boolean; maxQuantityPerLine: number };
  payments: { provider: "razorpay" | "mock"; razorpayKeyId: string | null };
  /** Theme saved in Admin → Appearance. */
  appearance: Appearance;
  states: { name: string; code: string }[];
}

export interface PricedLine {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  variantTitle: string;
  slug: string;
  imageUrl: string | null;
  quantity: number;
  mrp: number;
  unitPrice: number;
  gross: number;
  autoDiscount: number;
  autoDiscountName: string | null;
  couponDiscount: number;
  manualDiscount: number;
  discountAmount: number;
  taxableAmount: number;
  taxRateBps: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
  purchasable: boolean;
  issue: string | null;
}

export interface QuoteTotals {
  itemCount: number;
  subtotal: number;
  discountTotal: number;
  autoDiscountTotal: number;
  couponDiscountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  taxTotal: number;
  shipping: { amount: number; taxAmount: number; total: number; free: boolean; freeShippingThreshold: number | null; amountToFreeShipping: number };
  roundOff: number;
  grandTotal: number;
  coupon: { code: string; valid: boolean; message: string | null; discount: number } | null;
  pricesIncludeTax: boolean;
  interState: boolean;
  savings: number;
}

export interface Cart extends QuoteTotals {
  id: string | null;
  items: (PricedLine & { itemId: string; available: number; maxQuantity: number })[];
  issues: string[];
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "REFUNDED";

export type PaymentStatus = "CREATED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantTitle: string;
  imageUrl: string | null;
  quantity: number;
  mrp: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxRateBps: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
  returnedQuantity: number;
  warehouseId: string;
  hsnCode: string | null;
}

export interface OrderAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string;
  postalCode: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  channel: "ONLINE" | "POS";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  roundOff: number;
  grandTotal: number;
  amountRefunded: number;
  couponCode: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingAddress: OrderAddress | null;
  billingAddress: OrderAddress | null;
  placedAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  reservationExpiresAt: string | null;
  items: OrderItem[];
  statusHistory: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; note: string | null; createdAt: string }[];
  payments: { id: string; provider: string; method: string | null; status: PaymentStatus; amount: number; paidAt: string | null; razorpayOrderId?: string | null; razorpayPaymentId?: string | null; referenceNumber?: string | null; amountRefunded?: number }[];
  refunds: { id: string; refundNumber: string; amount: number; status: string; reason: string | null; createdAt: string }[];
  shipments: { id: string; awb: string | null; courierName: string | null; trackingUrl: string | null; status: string; createdAt: string; events: { id: string; status: string; rawStatus: string; location: string | null; occurredAt: string }[] }[];
  invoice: { id: string; invoiceNumber: string; issuedAt: string; status: string } | null;
  creditNotes: { id: string; creditNoteNumber: string; total: number; issuedAt: string }[];
  returnRequests: { id: string; returnNumber: string; status: string; createdAt: string; items: { orderItemId: string; quantity: number }[] }[];
  canCancel?: boolean;
  canPay?: boolean;
  canReturn?: boolean;
  returnWindowEnds?: string | null;
}

export interface OrderListItem {
  id: string;
  orderNumber: string;
  channel: "ONLINE" | "POS";
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: string;
  grandTotal: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  placedAt: string;
  _count: { items: number };
  items: { imageUrl: string | null; productName: string }[];
}

export interface PaymentSession {
  provider: "razorpay" | "mock";
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
  prefill: { name: string; email: string; contact: string };
  expiresAt: string | null;
}
