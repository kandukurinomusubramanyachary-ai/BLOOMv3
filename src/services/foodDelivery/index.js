import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { swiggyProvider } from './providers/swiggyProvider';
import { trackFoodDeliveryEvent } from './foodDeliveryAnalytics';

const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();

function cleanText(value, maxLength = 160) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanOptionalNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeCanonicalUrl(value) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return parsed.protocol === 'https:'
      && (hostname === 'swiggy.com' || hostname.endsWith('.swiggy.com'))
      ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSwiggyResult(value) {
  if (!value || value.available !== true) return null;
  if (value.availabilityStatus !== 'OPEN') return null;
  if (value.inStock === false || value.inStock === 0 || value.serviceable === false) return null;
  const itemName = cleanText(value.itemName || value.name);
  const restaurantName = cleanText(value.restaurantName);
  const providerItemId = cleanText(value.providerItemId || value.menuItemId, 120);
  const providerRestaurantId = cleanText(value.providerRestaurantId || value.restaurantId, 120);
  if (!itemName || !restaurantName || !providerItemId || !providerRestaurantId) return null;
  return {
    provider: 'swiggy',
    itemName,
    restaurantName,
    price: cleanOptionalNumber(value.price),
    deliveryTime: cleanText(value.deliveryTime, 60) || null,
    distance: cleanText(value.distance, 60) || null,
    available: true,
    providerItemId,
    providerRestaurantId,
    providerUrl: safeCanonicalUrl(value.providerUrl),
  };
}

function analyticsProperties(foodId, extra = {}) {
  return {
    provider: 'swiggy',
    foodId: cleanText(foodId, 80),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version || 'unknown',
    ...extra,
  };
}

export async function searchFoodAvailability({
  query,
  foodId,
  useSavedAddress = false,
  provider = swiggyProvider,
  signal,
  now = Date.now,
} = {}) {
  const normalizedQuery = cleanText(query, 120).toLowerCase();
  if (!normalizedQuery) return { state: 'no-results', provider: 'swiggy', results: [] };
  if (!provider?.isConfigured?.()) {
    return { state: 'provider-unavailable', provider: 'swiggy', results: [] };
  }

  const cacheKey = `${provider.id || 'swiggy'}:${normalizedQuery}:${useSavedAddress ? 'saved' : 'unconfirmed'}`;
  const cached = cache.get(cacheKey);
  if (cached && now() - cached.createdAt < CACHE_TTL_MS) return cached.value;
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const request = (async () => {
    trackFoodDeliveryEvent('food_availability_search_started', analyticsProperties(foodId));
    try {
      const response = await provider.search({
        query: normalizedQuery,
        useSavedAddress: useSavedAddress === true,
        signal,
      });
      if (response?.state === 'provider-unavailable' || response?.state === 'location-required') {
        return { state: response.state, provider: 'swiggy', results: [] };
      }

      const results = (Array.isArray(response?.results) ? response.results : [])
        .map(normalizeSwiggyResult)
        .filter(Boolean)
        .slice(0, 3);
      const value = results.length
        ? { state: 'results', provider: 'swiggy', results }
        : { state: 'no-results', provider: 'swiggy', results: [] };
      cache.set(cacheKey, { createdAt: now(), value });
      trackFoodDeliveryEvent(
        results.length ? 'food_availability_search_succeeded' : 'food_availability_search_empty',
        analyticsProperties(foodId, { resultCount: results.length })
      );
      return value;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      trackFoodDeliveryEvent('food_availability_search_failed', analyticsProperties(foodId));
      return { state: 'network-error', provider: 'swiggy', results: [] };
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);
  return request;
}

export function clearFoodAvailabilityCache() {
  cache.clear();
  inFlight.clear();
}
