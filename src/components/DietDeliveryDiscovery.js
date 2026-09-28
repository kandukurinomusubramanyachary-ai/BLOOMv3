import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import Icon from './Icon';
import { searchFoodAvailability } from '../services/foodDelivery';
import { openFoodProvider } from '../services/foodDelivery/openDeliveryProvider';
import { trackFoodDeliveryEvent } from '../services/foodDelivery/foodDeliveryAnalytics';
import { COLORS, createThemedStyles, TYPOGRAPHY, WEB_FOCUS } from '../utils/constants';

const REQUEST_TIMEOUT_MS = 12000;

function interactive(base, extra) {
  return ({ pressed, hovered, focused }) => [
    base,
    hovered && styles.hovered,
    focused && styles.focused,
    pressed && styles.pressed,
    extra,
  ];
}

function resultMeta(result) {
  const values = [];
  if (result.price !== null) values.push(`₹${result.price}`);
  if (result.deliveryTime) values.push(result.deliveryTime);
  if (result.distance) values.push(result.distance);
  return values.join(' · ');
}

function ProviderButton({ provider, item, result, onFailure }) {
  const label = result ? `Open in ${provider === 'swiggy' ? 'Swiggy' : 'Zomato'}` : `Check on ${provider === 'swiggy' ? 'Swiggy' : 'Zomato'}`;
  const accessibilityLabel = result
    ? `Open ${result.itemName} from ${result.restaurantName} in Swiggy`
    : `${label} for ${item.name}`;

  const openProvider = async () => {
    const opened = await openFoodProvider({
      provider,
      query: item.searchTerm,
      providerUrl: result?.providerUrl,
    });
    if (!opened) {
      onFailure(provider);
      return;
    }
    trackFoodDeliveryEvent('food_provider_opened', {
      provider,
      foodId: item.id,
      platform: Platform.OS,
    });
  };

  return (
    <Pressable
      onPress={openProvider}
      accessibilityRole='link'
      accessibilityLabel={accessibilityLabel}
      style={interactive(styles.providerButton, result && styles.providerButtonPrimary)}
    >
      <Text style={[styles.providerButtonText, result && styles.providerButtonTextPrimary]}>{label}</Text>
      <Icon name='open-outline' size={16} color={result ? COLORS.onBrand : COLORS.ink} />
    </Pressable>
  );
}

export default function DietDeliveryDiscovery({ item }) {
  const [status, setStatus] = useState({ state: 'idle', results: [] });
  const [launchError, setLaunchError] = useState('');
  const mountedRef = useRef(true);
  const requestRef = useRef(null);
  const searchingRef = useRef(false);

  useEffect(() => () => {
    mountedRef.current = false;
    requestRef.current?.abort();
  }, []);

  const announceStatus = useCallback((state) => {
    const messages = {
      results: 'Nearby Swiggy options are available.',
      'no-results': 'No nearby Swiggy result was found.',
      'provider-unavailable': 'Live delivery availability is not connected.',
      'network-error': 'Delivery availability could not be checked.',
      'location-required': 'Permission to use your saved delivery location is required.',
    };
    if (messages[state]) AccessibilityInfo.announceForAccessibility?.(messages[state]);
  }, []);

  const runSearch = useCallback(async (useSavedAddress = false) => {
    if (searchingRef.current) return;
    searchingRef.current = true;
    setLaunchError('');
    setStatus({ state: 'loading', results: [] });
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const next = await searchFoodAvailability({
        query: item.searchTerm,
        foodId: item.id,
        useSavedAddress,
        signal: controller.signal,
      });
      if (!mountedRef.current || requestRef.current !== controller) return;
      setStatus(next);
      announceStatus(next.state);
    } catch (error) {
      if (!mountedRef.current) return;
      setStatus({ state: 'network-error', provider: 'swiggy', results: [] });
      announceStatus('network-error');
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) requestRef.current = null;
      searchingRef.current = false;
    }
  }, [announceStatus, item.id, item.searchTerm]);

  if (!item.deliverySearchable) return null;

  const launchFailed = (provider) => {
    const providerName = provider === 'swiggy' ? 'Swiggy' : 'Zomato';
    setLaunchError(`${providerName} could not be opened. Please try again.`);
    AccessibilityInfo.announceForAccessibility?.(`${providerName} could not be opened.`);
  };

  if (status.state === 'idle') {
    return (
      <Pressable
        onPress={() => runSearch(false)}
        accessibilityRole='button'
        accessibilityLabel={`Find ${item.name} nearby for delivery`}
        style={interactive(styles.findButton)}
      >
        <Icon name='location-outline' size={16} color={COLORS.ink} />
        <Text style={styles.findButtonText}>Find nearby</Text>
      </Pressable>
    );
  }

  if (status.state === 'loading') {
    return <View style={styles.statusRow} accessibilityLiveRegion='polite'><ActivityIndicator size='small' color={COLORS.brand} /><Text style={styles.statusText}>Checking nearby options…</Text></View>;
  }

  if (status.state === 'results') {
    return (
      <View style={styles.deliveryPanel} accessibilityLiveRegion='polite'>
        <Text style={styles.statusTitle}>Available nearby</Text>
        {status.results.map((result) => (
          <View key={`${result.providerRestaurantId}:${result.providerItemId}`} style={styles.deliveryResult}>
            <Text style={styles.resultName}>{result.restaurantName}</Text>
            <Text style={styles.resultItem}>{result.itemName}</Text>
            {resultMeta(result) ? <Text style={styles.resultMeta}>{resultMeta(result)}</Text> : null}
            <ProviderButton provider='swiggy' item={item} result={result} onFailure={launchFailed} />
          </View>
        ))}
        {launchError ? <Text style={styles.errorText} accessibilityLiveRegion='assertive'>{launchError}</Text> : null}
      </View>
    );
  }

  if (status.state === 'location-required') {
    return (
      <View style={styles.deliveryPanel} accessibilityLiveRegion='polite'>
        <Text style={styles.statusTitle}>Use your delivery location to find this nearby?</Text>
        <Text style={styles.statusText}>Bloom will ask the connected provider to use a saved delivery address. Your health information is never sent.</Text>
        <View style={styles.buttonRow}>
          <Pressable onPress={() => runSearch(true)} accessibilityRole='button' accessibilityLabel={`Continue finding ${item.name} nearby`} style={interactive(styles.providerButton, styles.providerButtonPrimary)}><Text style={[styles.providerButtonText, styles.providerButtonTextPrimary]}>Continue</Text></Pressable>
          <Pressable onPress={() => setStatus({ state: 'idle', results: [] })} accessibilityRole='button' style={interactive(styles.providerButton)}><Text style={styles.providerButtonText}>Not now</Text></Pressable>
        </View>
      </View>
    );
  }

  if (status.state === 'no-results') {
    return (
      <View style={styles.deliveryPanel} accessibilityLiveRegion='polite'>
        <Text style={styles.statusTitle}>Couldn’t find this nearby on Swiggy.</Text>
        <ProviderButton provider='zomato' item={item} onFailure={launchFailed} />
        {launchError ? <Text style={styles.errorText} accessibilityLiveRegion='assertive'>{launchError}</Text> : null}
      </View>
    );
  }

  if (status.state === 'network-error') {
    return (
      <View style={styles.deliveryPanel} accessibilityLiveRegion='polite'>
        <Text style={styles.statusTitle}>We couldn’t check delivery right now.</Text>
        <View style={styles.buttonRow}>
          <Pressable onPress={() => runSearch(false)} accessibilityRole='button' accessibilityLabel={`Try finding ${item.name} nearby again`} style={interactive(styles.providerButton)}><Text style={styles.providerButtonText}>Try again</Text></Pressable>
          <ProviderButton provider='swiggy' item={item} onFailure={launchFailed} />
          <ProviderButton provider='zomato' item={item} onFailure={launchFailed} />
        </View>
        {launchError ? <Text style={styles.errorText} accessibilityLiveRegion='assertive'>{launchError}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.deliveryPanel} accessibilityLiveRegion='polite'>
      <Text style={styles.statusTitle}>Live delivery availability isn’t connected yet.</Text>
      <Text style={styles.statusText}>You can still check this dish directly with a delivery provider.</Text>
      <View style={styles.buttonRow}>
        <ProviderButton provider='swiggy' item={item} onFailure={launchFailed} />
        <ProviderButton provider='zomato' item={item} onFailure={launchFailed} />
      </View>
      {launchError ? <Text style={styles.errorText} accessibilityLiveRegion='assertive'>{launchError}</Text> : null}
    </View>
  );
}

const styles = createThemedStyles({
  findButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingHorizontal: 13, borderRadius: 12, backgroundColor: COLORS.surfaceSoft },
  findButtonText: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontWeight: '700' },
  statusRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  statusText: { ...TYPOGRAPHY.supporting, color: COLORS.body, flexShrink: 1 },
  deliveryPanel: { gap: 9, marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceSoft },
  statusTitle: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontWeight: '700' },
  deliveryResult: { gap: 3, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.hairline },
  resultName: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  resultItem: { ...TYPOGRAPHY.supporting, color: COLORS.body },
  resultMeta: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.hairline, borderRadius: 12, backgroundColor: COLORS.canvas },
  providerButtonPrimary: { borderColor: COLORS.brand, backgroundColor: COLORS.brand },
  providerButtonText: { ...TYPOGRAPHY.supporting, color: COLORS.ink, fontWeight: '700' },
  providerButtonTextPrimary: { color: COLORS.onBrand },
  errorText: { ...TYPOGRAPHY.caption, color: COLORS.danger },
  hovered: { opacity: 0.92 },
  focused: WEB_FOCUS,
  pressed: { opacity: 0.74 },
});
