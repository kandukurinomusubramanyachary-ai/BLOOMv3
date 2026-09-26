import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import { COLORS, createThemedStyles, LAYOUT, TYPOGRAPHY } from '../utils/constants';
import { useProductTour } from '../components/productTour';

const GROUPS = [
  { title: 'Getting around Bloom', items: [{ id: 'appOverview', label: 'Getting around Bloom', route: 'Today' }] },
  { title: 'Everyday', items: [
    { id: 'today', label: 'Today', route: 'Today' },
    { id: 'checkin', label: 'Daily Check-In', route: 'DailyCheckIn' },
    { id: 'timeline', label: 'Timeline', route: 'Timeline' },
  ] },
  { title: 'Support', items: [{ id: 'meg', label: 'Meg', route: 'Meg' }] },
  { title: 'Movement', items: [
    { id: 'strengthHome', label: 'Strength basics', route: 'Strength' },
    { id: 'strengthWorkout', label: 'First workout', route: 'Strength' },
    { id: 'strengthSummary', label: 'Workout summary', route: 'Strength' },
  ] },
  { title: 'Settings', items: [{ id: 'profile', label: 'Profile & appearance', route: 'Profile' }] },
];

export default function LearnBloomScreen({ navigation }) {
  const { tourProgress, startTour } = useProductTour();

  function status(id) {
    const value = tourProgress[id]?.status;
    if (value === 'completed') return 'Completed';
    if (value === 'skipped') return 'Skipped';
    return 'Not viewed';
  }

  function replay(item) {
    if (item.route === 'DailyCheckIn') navigation.navigate(item.route);
    else if (item.route === 'Profile') navigation.navigate(item.route);
    else navigation.navigate('Main', { screen: item.route });
    setTimeout(() => startTour(item.id, 0), 350);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton icon='chevron-back' accessibilityLabel='Back to Profile' onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Learn Bloom</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Learn Bloom</Text>
        <Text style={styles.subtitle}>Short, optional guides for the places that matter. Replay anything whenever you want.</Text>
        {GROUPS.map(group => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.card}>
              {group.items.map((item, index) => (
                <Pressable
                  key={item.id}
                  onPress={() => replay(item)}
                  accessibilityRole='button'
                  accessibilityLabel={`${item.label}. ${status(item.id)}. Replay guide`}
                  style={({ pressed, hovered, focused }) => [styles.row, index < group.items.length - 1 && styles.rowBorder, hovered && styles.rowHover, focused && styles.rowFocus, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.label}</Text>
                    <Text style={styles.rowStatus}>{status(item.id)}</Text>
                  </View>
                  <Icon name='chevron-forward' size={19} color={COLORS.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safeArea: { flex: 1, backgroundColor: COLORS.canvas },
  header: { minHeight: 60, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  headerSpacer: { width: 48 },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 20, paddingBottom: 48 },
  title: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  subtitle: { marginTop: 8, ...TYPOGRAPHY.body, color: COLORS.body },
  group: { marginTop: 26 },
  groupTitle: { marginBottom: 8, ...TYPOGRAPHY.componentTitle, color: COLORS.ink },
  card: { overflow: 'hidden', borderRadius: LAYOUT.cardRadius, backgroundColor: COLORS.surface },
  row: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.ink },
  rowStatus: { marginTop: 3, ...TYPOGRAPHY.caption, color: COLORS.muted },
  rowHover: { backgroundColor: COLORS.surfaceSoft },
  rowFocus: { outlineStyle: 'solid', outlineWidth: 2, outlineColor: COLORS.brand, outlineOffset: -2 },
  rowPressed: { opacity: 0.72 },
});
