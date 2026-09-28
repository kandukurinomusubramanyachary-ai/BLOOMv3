const EVENTS = new Set([
  'food_availability_search_started',
  'food_availability_search_succeeded',
  'food_availability_search_empty',
  'food_availability_search_failed',
  'food_provider_opened',
]);

const ALLOWED_PROPERTIES = new Set([
  'provider',
  'foodId',
  'platform',
  'appVersion',
  'resultCount',
]);

export function safeFoodDeliveryEvent(name, properties = {}) {
  if (!EVENTS.has(name)) throw new Error('food_delivery_analytics_unknown_event');
  const clean = Object.fromEntries(Object.entries(properties)
    .filter(([key, value]) => ALLOWED_PROPERTIES.has(key)
      && ['string', 'number', 'boolean'].includes(typeof value)));
  return { name, properties: clean };
}

// Bloom has no shared analytics transport yet. Keep the event contract as a
// validated no-op so a later transport cannot accidentally receive health data.
export function trackFoodDeliveryEvent(name, properties) {
  safeFoodDeliveryEvent(name, properties);
}
