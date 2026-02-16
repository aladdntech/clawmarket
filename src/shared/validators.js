const { z } = require('zod');

// ─── Shared Schemas ─────────────────────────────────────────
const locationCoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

const userLocationSchema = z.object({
  country: z.string().length(2),
  countryName: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  coordinates: locationCoordinatesSchema.optional()
});

const agentLocationSchema = z.object({
  country: z.string().length(2),
  city: z.string().max(100).optional()
});

const listingLocationSchema = z.object({
  country: z.string().length(2),
  city: z.string().max(100).optional(),
  shipsTo: z.array(z.string().max(20)).default([])
});

const shippingMethodSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0).max(1000000),
  estimatedDays: z.string().max(50).optional(),
  currency: z.enum(['USDT', 'TRX', 'BTC', 'ETH']).default('USDT')
});

const shippingSchema = z.object({
  type: z.enum(['physical', 'digital', 'in_person']).default('physical'),
  methods: z.array(shippingMethodSchema).default([]),
  freeShippingOver: z.number().min(0).optional()
});

// ─── User Schemas ───────────────────────────────────────────
const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(5).max(30).optional(),
  country: z.string().length(2).optional(),
  location: userLocationSchema.optional(),
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
  channels: z.array(z.string().max(100)).default([]),
  location: agentLocationSchema.optional()
});

// ─── Listing Schemas ────────────────────────────────────────
const createListingSchema = z.object({
  agentId: z.string().min(1).optional(),
  type: z.enum(['product', 'service']).default('service'),
  condition: z.enum(['new', 'used', 'refurbished', 'na']).default('na'),
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  price: z.union([
    z.object({
      amount: z.number().positive().max(1000000),
      currency: z.enum(['USDT', 'TRX', 'BTC', 'ETH']).default('USDT')
    }),
    z.number().positive().max(1000000).transform(amount => ({ amount, currency: 'USDT' }))
  ]),
  category: z.string().min(1).max(100),
  tags: z.array(z.string().max(50)).max(20).default([]),
  images: z.array(z.string().url()).max(10).default([]),
  location: listingLocationSchema.optional(),
  shipping: shippingSchema.optional(),
  deliveryType: z.enum(['digital', 'physical', 'in_person']).default('digital'),
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
  buyerAgentId: z.string().min(1).optional(),
  quantity: z.number().int().positive().default(1),
  shippingAddress: z.object({
    name: z.string().min(1).max(200),
    street: z.string().min(1).max(500),
    city: z.string().min(1).max(200),
    state: z.string().max(100).optional(),
    country: z.string().length(2),
    zip: z.string().max(20).optional()
  }).optional()
});

// ─── Listing Filter Schemas ─────────────────────────────────
const listingFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  type: z.enum(['product', 'service']).optional(),
  condition: z.enum(['new', 'used', 'refurbished', 'na']).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  deliveryType: z.enum(['digital', 'physical', 'in_person']).optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(100).optional(),
  shipsTo: z.string().max(20).optional(),
  nearby: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional(),
  radius: z.coerce.number().positive().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional()
});

// ─── Profile Update Schema ──────────────────────────────────
const updateProfileSchema = z.object({
  location: userLocationSchema.optional()
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

// ─── Domains Schemas ────────────────────────────────────────
const createSubdomainProvisionSchema = z.object({
  subdomain: z.string().min(3).max(63).regex(/^[a-z0-9-]+$/i),
  targetIp: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Invalid IPv4 address').optional(),
  targetUrl: z.string().url().optional()
}).refine(
  data => !(data.targetIp && data.targetUrl),
  { message: 'Provide either targetIp or targetUrl, not both' }
);

// Helper to validate and return clean data or throw
function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errors = issues.map(e => `${(e.path || []).join('.')}: ${e.message}`).join('; ');
    const err = new Error(`Validation failed: ${errors}`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return result.data;
}

module.exports = {
  locationCoordinatesSchema,
  userLocationSchema,
  agentLocationSchema,
  listingLocationSchema,
  shippingMethodSchema,
  shippingSchema,
  createUserSchema,
  createAgentSchema,
  createListingSchema,
  createOrderSchema,
  createDisputeSchema,
  createReviewSchema,
  createSubdomainProvisionSchema,
  listingFilterSchema,
  updateProfileSchema,
  validate
};
