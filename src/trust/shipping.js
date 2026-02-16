const { ValidationError } = require('../shared/errors');

/**
 * Carrier tracking URL templates
 * {tracking} is replaced with the actual tracking number
 */
const CARRIER_URLS = {
  correios: 'https://www.correios.com.br/rastreamento',
  canada_post: 'https://www.canadapost-postescanada.ca/track-reperer/en#/search?searchFor={tracking}',
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr={tracking}',
  ups: 'https://www.ups.com/track?tracknum={tracking}',
  dhl: 'https://www.dhl.com/en/express/tracking.html?AWB={tracking}'
};

/**
 * Nearby country groups for delivery estimation
 */
const REGION_MAP = {
  US: 'north_america', CA: 'north_america', MX: 'north_america',
  BR: 'south_america', AR: 'south_america', CL: 'south_america',
  CO: 'south_america', PE: 'south_america', UY: 'south_america',
  VE: 'south_america', EC: 'south_america', BO: 'south_america',
  PY: 'south_america',
  GB: 'europe', DE: 'europe', FR: 'europe', ES: 'europe',
  IT: 'europe', PT: 'europe', NL: 'europe', BE: 'europe',
  SE: 'europe', NO: 'europe', DK: 'europe', FI: 'europe',
  PL: 'europe', CZ: 'europe', AT: 'europe', CH: 'europe',
  IE: 'europe', RO: 'europe', HU: 'europe', GR: 'europe',
  CN: 'east_asia', JP: 'east_asia', KR: 'east_asia', TW: 'east_asia',
  HK: 'east_asia',
  IN: 'south_asia', PK: 'south_asia', BD: 'south_asia', LK: 'south_asia',
  AU: 'oceania', NZ: 'oceania',
  NG: 'africa', ZA: 'africa', KE: 'africa', EG: 'africa',
  GH: 'africa', ET: 'africa',
  AE: 'middle_east', SA: 'middle_east', IL: 'middle_east',
  TR: 'middle_east', QA: 'middle_east'
};

/**
 * Get the tracking URL for a given carrier and tracking number
 */
function getTrackingUrl(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) {
    throw new ValidationError('Carrier and tracking number are required');
  }

  const carrierKey = carrier.toLowerCase().trim();
  const template = CARRIER_URLS[carrierKey];

  if (!template) {
    return null;
  }

  // Correios doesn't support direct tracking number in URL
  if (carrierKey === 'correios') {
    return template;
  }

  return template.replace('{tracking}', encodeURIComponent(trackingNumber));
}

/**
 * Track a shipment — returns tracking URL and carrier info
 * For MVP this is URL generation only, no live API calls
 */
function trackShipment(carrier, trackingNumber) {
  if (!carrier || !trackingNumber) {
    throw new ValidationError('Carrier and tracking number are required');
  }

  const carrierKey = carrier.toLowerCase().trim();
  const url = getTrackingUrl(carrierKey, trackingNumber);
  const supported = !!CARRIER_URLS[carrierKey];

  if (!supported) {
    return {
      carrier: carrierKey,
      trackingNumber,
      supported: false,
      trackingUrl: null,
      message: `Carrier "${carrier}" is not currently supported. Supported carriers: ${Object.keys(CARRIER_URLS).join(', ')}`
    };
  }

  return {
    carrier: carrierKey,
    trackingNumber,
    supported: true,
    trackingUrl: url,
    message: carrierKey === 'correios'
      ? `Track your Correios shipment at ${url} using tracking number: ${trackingNumber}`
      : `Track your shipment at: ${url}`
  };
}

/**
 * Estimate delivery time between two countries
 * Returns rough estimates based on distance:
 *   Same country: 3-7 business days
 *   Same region: 7-14 business days
 *   International: 14-30 business days
 */
function estimateDelivery(fromCountry, toCountry) {
  if (!fromCountry || !toCountry) {
    throw new ValidationError('Both fromCountry and toCountry are required (2-letter codes)');
  }

  const from = fromCountry.toUpperCase().trim();
  const to = toCountry.toUpperCase().trim();

  if (from.length !== 2 || to.length !== 2) {
    throw new ValidationError('Country codes must be 2-letter ISO codes (e.g., US, BR, GB)');
  }

  // Same country
  if (from === to) {
    return {
      from,
      to,
      estimatedDays: { min: 3, max: 7 },
      category: 'domestic',
      note: 'Domestic shipping within the same country'
    };
  }

  // Check if same region
  const fromRegion = REGION_MAP[from];
  const toRegion = REGION_MAP[to];

  if (fromRegion && toRegion && fromRegion === toRegion) {
    return {
      from,
      to,
      estimatedDays: { min: 7, max: 14 },
      category: 'regional',
      note: `Regional shipping within ${fromRegion.replace('_', ' ')}`
    };
  }

  // International
  return {
    from,
    to,
    estimatedDays: { min: 14, max: 30 },
    category: 'international',
    note: 'International shipping — times may vary by carrier and customs'
  };
}

module.exports = {
  trackShipment,
  getTrackingUrl,
  estimateDelivery
};
