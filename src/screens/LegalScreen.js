import React, { useState } from 'react';
import { Linking, Text } from 'react-native';
import ScreenScaffold from '../components/ScreenScaffold';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../utils/constants';

// Founder-owned release slots. Never substitute invented legal approval.
const PAGES = {
  privacy: {
    title: 'Privacy Policy', url: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    template: 'A reviewed Privacy Policy has not been published for this beta. Before public release, Bloom’s owner must identify the data controller, contact details, processing purposes, service providers, international transfers, retention and backup deletion periods, and applicable privacy rights. Required operational consent and optional model-improvement consent must stay separate.',
  },
  terms: {
    title: 'Terms of Use', url: process.env.EXPO_PUBLIC_TERMS_URL,
    template: 'Reviewed Terms of Use have not been published for this beta. Before public release, Bloom’s owner must confirm eligibility and age limits, acceptable use, account responsibilities, service limitations, termination, dispute handling and applicable jurisdiction. Bloom’s tracking and Meg features are not a diagnosis or emergency service.',
  },
  support: {
    title: 'Contact / Support', url: process.env.EXPO_PUBLIC_SUPPORT_URL,
    template: 'A support contact has not been configured for this beta. Contact the person who invited you to test Bloom. Before public release, Bloom’s owner must provide a monitored support channel, privacy-request contact and response expectations. Do not send passwords, access tokens or full health records in a support request.',
  },
};

export default function LegalScreen({ navigation, route, page, onBack }) {
  const selected = PAGES[page || route?.params?.page] || PAGES.privacy;
  const [error, setError] = useState('');
  let url;
  try {
    const parsed = new URL(selected.url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) url = parsed.href;
  } catch {}
  async function openLink() {
    setError('');
    try { await Linking.openURL(url); }
    catch { setError('This link could not open. Please try again.'); }
  }
  return (
    <ScreenScaffold>
      <Button title='Back' variant='ghost' onPress={onBack || (() => navigation.goBack())} />
      <ScreenHeader title={selected.title} subtitle={url ? 'Read the published information from Bloom’s owner.' : 'Beta template · founder and legal review required'} />
      {url ? <Button title={`Open ${selected.title}`} onPress={openLink} /> : <Text selectable style={styles.body}>{selected.template}</Text>}
      {!url && <Text style={styles.note}>TODO · Owner: Bloom founder · Status: awaiting review · Effective date: not set. This template is not an approved policy.</Text>}
      {error ? <Text style={styles.error} accessibilityRole='alert'>{error}</Text> : null}
    </ScreenScaffold>
  );
}
const styles = createThemedStyles({
  body: { ...TYPOGRAPHY.body, color: COLORS.body, fontSize: 16, lineHeight: 25, marginVertical: 16 },
  note: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginVertical: 16 },
  error: { color: COLORS.error, marginVertical: 12 },
});
