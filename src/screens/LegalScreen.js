import React, { useState } from 'react';
import { Linking, Text } from 'react-native';
import ScreenScaffold from '../components/ScreenScaffold';
import ScreenHeader from '../components/ScreenHeader';
import Button from '../components/Button';
import { COLORS, createThemedStyles, TYPOGRAPHY } from '../utils/constants';

const PAGES = require('../legal/drafts');
const publication = require('../../config/legal-publication.json');
const { approvedPublicUrl } = require('../legal/publication');
const URLS = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  terms: process.env.EXPO_PUBLIC_TERMS_URL,
  support: process.env.EXPO_PUBLIC_SUPPORT_URL,
  deletion: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
};

export default function LegalScreen({ navigation, route, page, onBack }) {
  const [selectedPage, setSelectedPage] = useState(page || route?.params?.page || 'privacy');
  const selected = PAGES[selectedPage] || PAGES.privacy;
  const [error, setError] = useState('');
  const url = approvedPublicUrl(URLS[selectedPage], publication);
  async function openLink() {
    setError('');
    try { await Linking.openURL(url); }
    catch { setError('This link could not open. Please try again.'); }
  }
  return (
    <ScreenScaffold>
      <Button title='Back' variant='ghost' onPress={onBack || (() => navigation.goBack())} />
      <ScreenHeader title={selected.title} subtitle={url ? 'Read the published information from Bloom’s owner.' : 'Unpublished draft \u00b7 founder and legal review required'} />
      {url ? <Button title={`Open ${selected.title}`} onPress={openLink} /> : selected.sections.map(([title, body]) => <React.Fragment key={title}><Text accessibilityRole='header' style={styles.heading}>{title}</Text><Text selectable style={styles.body}>{body}</Text></React.Fragment>)}
      {!url && <Text style={styles.note}>TODO · Owner: Bloom founder · Status: awaiting review · Effective date: not set. This draft is not an approved policy.</Text>}
      {Object.entries(PAGES).filter(([key]) => key !== selectedPage).map(([key, value]) => <Button key={key} title={value.title} variant='ghost' onPress={() => { setSelectedPage(key); setError(''); }} />)}
      {error ? <Text style={styles.error} accessibilityRole='alert'>{error}</Text> : null}
    </ScreenScaffold>
  );
}
const styles = createThemedStyles({
  heading: { ...TYPOGRAPHY.body, color: COLORS.ink, fontWeight: '700', fontSize: 18, marginTop: 20 },
  body: { ...TYPOGRAPHY.body, color: COLORS.body, fontSize: 16, lineHeight: 25, marginVertical: 16 },
  note: { ...TYPOGRAPHY.supporting, color: COLORS.muted, marginVertical: 16 },
  error: { color: COLORS.error, marginVertical: 12 },
});
