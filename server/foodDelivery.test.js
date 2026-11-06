const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

const projectRoot = path.resolve(__dirname, '..');

function loadSourceModule(relativePath, stubs = {}) {
  const filename = path.join(projectRoot, relativePath);
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const localRequire = (id) => (Object.prototype.hasOwnProperty.call(stubs, id) ? stubs[id] : require(id));
  new Function('require', 'module', 'exports', '__filename', '__dirname', transformed.code)(
    localRequire,
    moduleValue,
    moduleValue.exports,
    filename,
    path.dirname(filename)
  );
  return moduleValue.exports;
}

const analytics = { trackFoodDeliveryEvent() {} };
const unavailableProvider = { id: 'swiggy', isConfigured: () => false };
const foodDelivery = loadSourceModule('src/services/foodDelivery/index.js', {
  'react-native': { Platform: { OS: 'test' } },
  'expo-constants': { __esModule: true, default: { expoConfig: { version: 'test' } } },
  './providers/swiggyProvider': { swiggyProvider: unavailableProvider },
  './foodDeliveryAnalytics': analytics,
});
const openDelivery = loadSourceModule('src/services/foodDelivery/openDeliveryProvider.js', {
  'react-native': { Linking: {}, Platform: { OS: 'test' } },
});
const swiggy = loadSourceModule('src/services/foodDelivery/providers/swiggyProvider.js', {
  '../../firebase': { auth: null },
});
const deliveryAnalytics = loadSourceModule('src/services/foodDelivery/foodDeliveryAnalytics.js');

function available(overrides = {}) {
  return {
    provider: 'swiggy',
    itemName: 'Paneer wrap',
    restaurantName: 'Paradise Kitchen',
    price: 169,
    deliveryTime: '22 min',
    distance: '1.8 km',
    available: true,
    availabilityStatus: 'OPEN',
    inStock: true,
    serviceable: true,
    providerItemId: 'item-1',
    providerRestaurantId: 'restaurant-1',
    providerUrl: 'https://www.swiggy.com/restaurants/paradise-kitchen',
    ...overrides,
  };
}

function providerReturning(response) {
  return { id: 'swiggy', isConfigured: () => true, search: async () => response };
}

test('returns a real normalized Swiggy result only when the item is open, in stock and serviceable', async () => {
  const value = await foodDelivery.searchFoodAvailability({
    query: 'paneer wrap',
    foodId: 'paneer-roti',
    provider: providerReturning({ results: [available()] }),
  });
  assert.equal(value.state, 'results');
  assert.equal(value.results.length, 1);
  assert.equal(value.results[0].restaurantName, 'Paradise Kitchen');
});

test('limits multiple Swiggy results to three useful options', async () => {
  const results = Array.from({ length: 5 }, (_value, index) => available({
    providerItemId: `item-${index}`,
    providerRestaurantId: `restaurant-${index}`,
  }));
  const value = await foodDelivery.searchFoodAvailability({
    query: 'dosa', foodId: 'dosa', provider: providerReturning({ results }),
  });
  assert.equal(value.state, 'results');
  assert.equal(value.results.length, 3);
});

test('returns no-results when Swiggy has no matching item', async () => {
  const value = await foodDelivery.searchFoodAvailability({
    query: 'idli', foodId: 'idli', provider: providerReturning({ results: [] }),
  });
  assert.equal(value.state, 'no-results');
});

test('returns provider-unavailable when authorized Swiggy access is not configured', async () => {
  const value = await foodDelivery.searchFoodAvailability({ query: 'biryani', provider: unavailableProvider });
  assert.equal(value.state, 'provider-unavailable');
});

test('maps provider network failures to a recoverable state', async () => {
  const provider = { id: 'swiggy', isConfigured: () => true, search: async () => { throw new Error('offline'); } };
  const value = await foodDelivery.searchFoodAvailability({ query: 'salad', foodId: 'salad', provider });
  assert.equal(value.state, 'network-error');
});

test('preserves the location-required state without sending a precise address', async () => {
  const value = await foodDelivery.searchFoodAvailability({
    query: 'dosa',
    foodId: 'dosa',
    provider: providerReturning({ state: 'location-required' }),
  });
  assert.equal(value.state, 'location-required');
});

test('filters out-of-stock, closed and unserviceable provider items', async () => {
  const values = [
    available({ providerItemId: 'out', inStock: false }),
    available({ providerItemId: 'closed', availabilityStatus: 'CLOSED' }),
    available({ providerItemId: 'far', serviceable: false }),
  ];
  const value = await foodDelivery.searchFoodAvailability({
    query: 'wrap', foodId: 'wrap', provider: providerReturning({ results: values }),
  });
  assert.equal(value.state, 'no-results');
});

test('rejects malformed provider links and uses the verified provider search URL', async () => {
  const opened = [];
  const result = await openDelivery.openFoodProvider({
    provider: 'swiggy',
    query: 'paneer wrap',
    providerUrl: 'javascript:alert(1)',
    platform: 'android',
    linking: { canOpenURL: async () => true, openURL: async (url) => opened.push(url) },
  });
  assert.equal(result, true);
  assert.deepEqual(opened, ['https://www.swiggy.com/search?query=paneer%20wrap']);
});

test('falls back to the provider web search when an app destination cannot open', async () => {
  const opened = [];
  const canonical = 'https://www.swiggy.com/restaurants/example';
  const result = await openDelivery.openFoodProvider({
    provider: 'swiggy',
    query: 'dosa',
    providerUrl: canonical,
    platform: 'android',
    linking: {
      canOpenURL: async (url) => url !== canonical,
      openURL: async (url) => opened.push(url),
    },
  });
  assert.equal(result, true);
  assert.deepEqual(opened, ['https://www.swiggy.com/search?query=dosa']);
});

test('handles a blocked web popup with the standard Linking fallback', async () => {
  const opened = [];
  const result = await openDelivery.openFoodProvider({
    provider: 'zomato',
    query: 'idli',
    platform: 'web',
    browserWindow: { open: () => null },
    linking: { openURL: async (url) => opened.push(url) },
  });
  assert.equal(result, true);
  assert.deepEqual(opened, ['https://www.zomato.com/search?q=idli']);
});

test('a Linking capability failure returns safely without launching an invalid destination', async () => {
  const result = await openDelivery.openFoodProvider({
    provider: 'zomato',
    query: 'idli',
    platform: 'ios',
    linking: { canOpenURL: async () => { throw new Error('linking unavailable'); }, openURL: async () => assert.fail('must not open') },
  });
  assert.equal(result, false);
});

test('cancelling one availability request does not cancel another caller search', async () => {
  const releases = [];
  const provider = {
    id: 'swiggy',
    isConfigured: () => true,
    search: ({ signal }) => new Promise((resolve, reject) => {
      releases.push(() => resolve({ results: [available()] }));
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    }),
  };
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = foodDelivery.searchFoodAvailability({ query: 'paneer wrap', provider, signal: firstController.signal });
  const second = foodDelivery.searchFoodAvailability({ query: 'paneer wrap', provider, signal: secondController.signal });
  assert.equal(releases.length, 2);
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  firstController.abort();
  releases[1]();
  await cancelled;
  assert.equal((await second).state, 'results');
});

test('a new account search never reuses the previous account delivery location', async () => {
  let currentToken = 'account-a';
  const provider = swiggy.createSwiggyProvider({
    baseUrl: 'https://api.bloom.example',
    getAuthToken: async () => currentToken,
    fetchImpl: async (_url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [available({ restaurantName: options.headers.Authorization })] }),
    }),
  });
  const search = () => foodDelivery.searchFoodAvailability({ query: 'dosa', useSavedAddress: true, provider });
  assert.equal((await search()).results[0].restaurantName, 'Bearer account-a');
  currentToken = 'account-b';
  assert.equal((await search()).results[0].restaurantName, 'Bearer account-b');
});

test('Swiggy backend request contains only food query and consent, never Bloom health data', async () => {
  let request;
  const provider = swiggy.createSwiggyProvider({
    baseUrl: 'https://api.bloom.example',
    getAuthToken: async () => 'token',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, json: async () => ({ results: [] }) };
    },
  });
  await provider.search({
    query: 'paneer wrap',
    useSavedAddress: true,
    symptom: 'pain',
    cycle: 'late',
    mood: 'low',
    onboardingAnswers: { pcos: true },
  });
  assert.equal(request.url, 'https://api.bloom.example/api/food-delivery/swiggy/search');
  assert.deepEqual(JSON.parse(request.options.body), { query: 'paneer wrap', useSavedAddress: true });
  assert.doesNotMatch(request.options.body.toLowerCase(), /symptom|cycle|period|pcos|mood|meg|health|onboarding/);
});

test('production provider configuration rejects a non-HTTPS Bloom backend', () => {
  const provider = swiggy.createSwiggyProvider({ baseUrl: 'http://api.bloom.example' });
  assert.equal(provider.isConfigured(), false);
});

test('food-delivery analytics strips free text and health properties', () => {
  const event = deliveryAnalytics.safeFoodDeliveryEvent('food_availability_search_started', {
    provider: 'swiggy', foodId: 'paneer-roti', platform: 'android', symptom: 'pain', query: 'free text',
  });
  assert.deepEqual(event.properties, { provider: 'swiggy', foodId: 'paneer-roti', platform: 'android' });
});
