import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { COLORS, createThemedStyles, SIZES, TYPOGRAPHY } from '../../utils/constants';
import { MotionScrollView, ScrollReveal } from '../../components/Motion';
import { storage } from '../../services/storage';
import { EXERCISE_LIBRARY, FOCUS_AREAS, exercisesByFocus } from './data/exerciseLibrary';
import { summarizeSessions } from './data/strengthStats';
import StatsHeader from './components/StatsHeader';
import ExerciseCard from './components/ExerciseCard';
import ExerciseDetail from './components/ExerciseDetail';
import SessionPlayer from './components/SessionPlayer';
import TrackedStrengthScreen from './TrackedStrengthScreen.web';
import { modeForExercise } from './poseCapability';

// Web Strength entry. Selecting a move leads to the pose-tracked session
// (camera + MediaPipe + deterministic engine). If the camera/engine is
// unavailable or the user declines, we fall back to the camera-free guided
// session for the same move. Guided mode never silently replaces pose
// tracking — it is reached only via an explicit fallback/choice.
export default function StrengthScreen() {
  const [view, setView] = useState('catalog');
  const [focus, setFocus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [session, setSession] = useState(null); // { exercise, sets, mode }
  const [sessions, setSessions] = useState([]);

  const loadSessions = useCallback(async () => {
    try {
      const stored = await storage.getStrengthSessions();
      setSessions(Array.isArray(stored) ? stored : []);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const stats = useMemo(() => summarizeSessions(sessions), [sessions]);
  const filtered = useMemo(() => exercisesByFocus(focus), [focus]);

  const handleSelect = useCallback((exercise) => {
    setSelected(exercise);
    setView('detail');
  }, []);

  // Choose the mode from the canonical capability map: pose-tracked only for
  // movements with a real deterministic pose engine; guided otherwise.
  // Guided is an explicit fallback, never a silent replacement of pose mode.
  const handleStart = useCallback((exercise, sets) => {
    const mode = modeForExercise(exercise?.id);
    setSession({ exercise, sets, mode });
    setView('session');
  }, []);

  const handleFallbackGuided = useCallback(() => {
    setSession((current) => (current ? { ...current, mode: 'guided' } : current));
  }, []);

  const handleComplete = useCallback(async (summary) => {
    try {
      const next = await storage.saveStrengthSession(summary);
      setSessions(Array.isArray(next) ? next : [summary, ...sessions]);
    } catch {
      setSessions((current) => [summary, ...current]);
    }
  }, [sessions]);

  const handleExitSession = useCallback(() => {
    setSession(null);
    setSelected(null);
    setView('catalog');
    loadSessions();
  }, [loadSessions]);

  if (view === 'session' && session) {
    if (session.mode === 'pose') {
      return (
        <TrackedStrengthScreen
          exercise={session.exercise}
          sets={session.sets}
          onExit={handleExitSession}
          onFallback={handleFallbackGuided}
        />
      );
    }
    return (
      <SessionPlayer
        exercise={session.exercise}
        sets={session.sets}
        onExit={handleExitSession}
        onComplete={handleComplete}
      />
    );
  }

  if (view === 'detail' && selected) {
    return (
      <ExerciseDetail
        exercise={selected}
        onBack={() => { setView('catalog'); setSelected(null); }}
        onStart={handleStart}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>Strength</Text>
        <View style={styles.libraryPill}>
          <Icon name="barbell-outline" size={14} color={COLORS.brand} />
          <Text style={styles.libraryPillText}>{EXERCISE_LIBRARY.length} moves</Text>
        </View>
      </View>

      <MotionScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <StatsHeader stats={stats} />

        <ScrollReveal style={styles.filterWrap}>
          <View style={styles.filterRow}>
            {FOCUS_AREAS.map((area) => {
              const active = area.id === focus;
              return (
                <Pressable
                  key={area.id}
                  onPress={() => setFocus(area.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed, hovered }) => [
                    styles.chip,
                    hovered && styles.chipHover,
                    active && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{area.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollReveal>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Choose a move</Text>
          <Text style={styles.listCount}>{filtered.length} {filtered.length === 1 ? 'move' : 'moves'}</Text>
        </View>

        <View style={styles.list}>
          {filtered.map((exercise, index) => (
            <ScrollReveal key={exercise.id} delay={index * 40}>
              <ExerciseCard exercise={exercise} onPress={handleSelect} testID={`exercise-${exercise.id}`} />
            </ScrollReveal>
          ))}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No moves in this group yet.</Text>
            </View>
          ) : null}
        </View>
      </MotionScrollView>
    </SafeAreaView>
  );
}

const styles = createThemedStyles({
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  topBar: { width: '100%', maxWidth: 600, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.gutter, paddingTop: 24, paddingBottom: 20 },
  wordmark: { ...TYPOGRAPHY.screenTitle, color: COLORS.ink },
  libraryPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.brandSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  libraryPillText: { ...TYPOGRAPHY.caption, color: COLORS.brand, fontWeight: '700' },
  scroll: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: SIZES.gutter, paddingTop: SIZES.xs, gap: SIZES.md, paddingBottom: 48 },
  filterWrap: { marginTop: SIZES.xs },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: COLORS.surfaceSoft, borderWidth: 1, borderColor: COLORS.hairline },
  chipHover: { backgroundColor: COLORS.surfaceStrong },
  chipActive: { backgroundColor: COLORS.ink, borderColor: COLORS.ink },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipText: { ...TYPOGRAPHY.supporting, color: COLORS.muted, fontWeight: '600' },
  chipTextActive: { color: COLORS.canvas },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: SIZES.xs },
  listTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  listCount: { ...TYPOGRAPHY.caption, color: COLORS.muted },
  list: { gap: SIZES.compact },
  empty: { alignItems: 'center', paddingVertical: SIZES.xl },
  emptyText: { ...TYPOGRAPHY.supporting, color: COLORS.muted },
});
