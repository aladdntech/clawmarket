const { z } = require('zod');

// ─── User Schemas ───────────────────────────────────────────
const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  country: z.string().length(2).optional(),
  wallets: z.array(z.object({
    network: z.enum(['tron', 'ethereum', 'bitcoin']),
    address: z.string().min(10).max(100),
    label: z.string().max(50).default('main')
  })).default([])
});

// ─── Agent Schemas ──────────────────────────────────────────
const createAgentSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(10).max(2000),
  capabilities: z.array(z.string().max(100)).min(1).max(20),
  category: z.string().min(1).max(100),
  channels: z.array(z.string().max(100)).default([])
});

// ─── Listing Schemas ────────────────────────────────────────
const createListingSchema = z.object({
  agentId: z.string().min(1),
  type: z.enum(['product', 'service']),
  condition: z.enum(['new', 'used', 'refurbished', 'na']).default('na'),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  price: z.object({
    amount: z.number().positive().max(1000000),
    currency: z.enum(['USDT', 'TRX', 'BTC', 'ETH']).default('USDT')
  }),
  category: z.string().min(1).max(100),
  tags: z.array(z.string().max(50)).max(20).default([]),
  images: z.array(z.string().url()).max(10).default([]),
  deliveryType: z.enum(['digital', 'physical', 'in_person']),
  deliveryDetails: z.object({
    digital: z.object({
      format: z.string().max(50).optional(),
      size: z.string().max(50).optional()
    }).optional(),
    physical: z.object({
      weight: z.number().positive().optional(),
      dimensions: z.object({
        l: z.number().positive(),
        w: z.number().positive(),
        h: z.number().positive(),
        unit: z.enum(['in', 'cm']).default('cm')
      }).optional(),
      shipsFrom: z.object({
        country: z.string().length(2),
        city: z.string().max(100).optional()
      }).optional(),
      shipsTo: z.array(z.string().max(20)).default(['WORLDWIDE'])
    }).optional()
  }).default({}),
  stock: z.number().int().min(0).default(1)
});

// ─── Order Schemas ──────────────────────────────────────────
const createOrderSchema = z.object({
  listingId: z.string().min(1),
  buyerAgentId: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  shippingAddress: z.object({
    name: z.string().min(1).max(200),
    street: z.string().min(1).max(500),
    city: z.string().min(1).max(200),
    state: z.string().max(100).optional(),
    country: z.string().length(2),
    zip: z.string().max(20).optional()
  }).optional() // required for physical, optional for digital
});

// ─── Dispute Schemas ────────────────────────────────────────
const createDisputeSchema = z.object({
  orderId: z.string().min(1),
  reason: z.enum(['item_not_received', 'item_not_as_described', 'service_not_delivered', 'other']),
  description: z.string().min(10).max(5000)
});

// ─── Review Schemas ─────────────────────────────────────────
const createReviewSchema = z.object({
  orderId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional()
});

// Helper to validate and return clean data or throw
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    const err = new Error(`Validation failed: ${errors}`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return result.data;
}

module.exports = {
  createUserSchema,
  createAgentSchema,
  createListingSchema,
  createOrderSchema,
  createDisputeSchema,
  createReviewSchema,
  validate
};
