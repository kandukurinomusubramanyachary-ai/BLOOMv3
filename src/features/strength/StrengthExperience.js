import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import Icon from '../../components/Icon';
import { storage } from '../../services/storage';
import accountWork from '../../services/accountWork';
import { EXERCISE_LIBRARY, FOCUS_AREAS, LEVELS } from './data/exerciseLibrary';
import { WORKOUT_PLANS, planMinutes, planEquipment, singleMovePlan } from './data/workoutPlans';
import { historyStats, normalizeHistory } from './data/sessionHistory';
import { modeForExercise } from './poseCapability';
import { useStrengthStyles, STRENGTH_TYPE as T } from './strengthTheme';
import { StrengthButton, StrengthHeader, StrengthScreenFrame, StrengthNote, StrengthEmpty, StrengthSkeleton } from './components/StrengthUI';
import ExerciseCard from './components/ExerciseCard';
import ExerciseDetail from './components/ExerciseDetail';
import StatsHeader from './components/StatsHeader';
import SessionPlayer from './components/SessionPlayer';
import MovementGuide from './components/MovementGuide';

// THESIS: One movement decision, then the interface recedes.
// OWN-WORLD: Cream, clay, charcoal, sage; Bloom icons and open lists.
// STORY: Choose, prepare, move, recover, see an honest record.
// FIRST VIEWPORT: Invitation, one recommendation and action, then weekly activity.
// FORM: User-pinned mobile Operate flow. No unrelated app or engine changes.
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
export default function StrengthExperience({ TrackedPlayer }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const ownerRef = useRef(uid); ownerRef.current = uid;
  const local = useMemo(() => uid ? storage.forUser(uid) : null, [uid]);
  const navigation = useNavigation();
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  const [view, setView] = useState('home');
  const [returnView, setReturnView] = useState('home');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [plan, setPlan] = useState(null);
  const [selected, setSelected] = useState(null);
  const [inspectIndex, setInspectIndex] = useState(null);
  const [run, setRun] = useState(null);
  const [filter, setFilter] = useState({ kind: 'workouts', area: 'all', level: 'all', time: 'all' });
  const [moreFilters, setMoreFilters] = useState(false);
  const [recentRecord, setRecentRecord] = useState(null);
  const loadVersion = useRef(0);
  const stats = useMemo(() => historyStats(records), [records]);
  const immersive = ['session', 'transition', 'finished'].includes(view);

  const load = useCallback(async () => {
    if (!local) { setLoading(false); return; }
    const version = ++loadVersion.current;
    const epoch = accountWork.epoch(uid);
    const current = () => ownerRef.current === uid && version === loadVersion.current && accountWork.isCurrent(uid, epoch);
    setLoading(true); setLoadError(false);
    try { const next = await local.getStrengthSessions(); if (current()) setRecords(next); }
    catch { if (current()) setLoadError(true); }
    finally { if (current()) setLoading(false); }
  }, [local, uid]);
  useEffect(() => { setRecords([]); setRun(null); setRecentRecord(null); setSelected(null); setPlan(null); setView('home'); void load(); return () => { loadVersion.current++; }; }, [load]);
  useEffect(() => {
    navigation.setOptions({ tabBarStyle: immersive ? { display: 'none' } : undefined });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [immersive, navigation]);
  useEffect(() => {
    if (!immersive) return undefined;
    // Session controls own save/exit; hardware navigation must not discard reps.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [immersive]);

  const choosePlan = value => { setPlan({ ...value, exercises: value.exercises.map(item => ({ ...item })) }); setReturnView(view); setView('overview'); };
  const chooseExercise = exercise => { setSelected(exercise); setInspectIndex(null); setReturnView(view); setView('detail'); };
  const start = value => {
    setRun({ id: 'workout-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), owner: uid, epoch: accountWork.epoch(uid), plan: value, index: 0, guided: false, results: [] });
    setView('session');
  };
  const exit = () => { setRun(null); setView('home'); void load(); };
  const save = useCallback(async (summary, completed) => {
    if (!run || !local || run.owner !== ownerRef.current || !accountWork.isCurrent(uid, run.epoch)) throw new Error('Your account changed. Please reopen Strength.');
    // `completed` ({ exercise, sets }) is passed by continuous tracked
    // transitions: the plan index has already advanced to the NEXT exercise,
    // so the saved record must describe the movement that just finished.
    const item = completed || run.plan.exercises[run.index];
    const normalized = normalizeHistory(summary, { ...item, workoutId: run.id, workoutName: run.plan.name });
    const next = await local.saveStrengthSession(normalized);
    if (run.owner !== ownerRef.current || !accountWork.isCurrent(uid, run.epoch)) throw new Error('Your account changed. Please reopen Strength.');
    setRecords(next);
    setRun(current => current?.id === run.id ? { ...current, results: [...current.results.filter(result => result.id !== normalized.id), normalized] } : current);
    return normalized;
  }, [local, run, uid]);
  const next = () => {
    if (run.index + 1 >= run.plan.exercises.length) { setView('finished'); return; }
    setRun(current => ({ ...current, index: current.index + 1, guided: false })); setView('transition');
  };

  if (view === 'detail' && selected) return <ExerciseDetail key={selected.id} exercise={selected}
    inspectOnly={inspectIndex != null} initialSets={inspectIndex != null ? plan.exercises[inspectIndex].sets : undefined}
    onChangeSets={inspectIndex == null ? undefined : sets => setPlan(current => ({ ...current, exercises: current.exercises.map((item, i) => i === inspectIndex ? { ...item, sets } : item) }))}
    onBack={() => setView(inspectIndex != null ? 'overview' : returnView)} onStart={(exercise, sets) => start(singleMovePlan(exercise, sets))} />;

  if (view === 'session' && run) {
    const { exercise, sets } = run.plan.exercises[run.index];
    const pose = TrackedPlayer && !run.guided && modeForExercise(exercise.id, Platform.OS) === 'pose';
    const Player = pose ? TrackedPlayer : SessionPlayer;
    const nextItem = run.index + 1 < run.plan.exercises.length ? run.plan.exercises[run.index + 1] : null;
    const continuousNext = pose && nextItem && modeForExercise(nextItem.exercise.id, Platform.OS) === 'pose' ? nextItem : null;
    // One camera, one workout: the tracked player stays mounted across
    // exercises (stable key), so the camera and MediaPipe session start
    // exactly once per workout. Guided players keep per-exercise keys.
    return <Player key={pose ? 'tracked:' + run.id : 'guided:' + run.id + ':' + run.index} exercise={exercise} sets={sets}
      onExit={exit} onComplete={save} onNext={next} nextLabel={nextItem ? 'Next exercise' : 'Finish workout'}
      workoutProgress={{ current: run.index + 1, total: run.plan.exercises.length }}
      onFallback={() => setRun(current => ({ ...current, guided: true }))}
      nextExercise={continuousNext || undefined}
      onAdvance={continuousNext ? () => setRun(current => current && current.id === run.id ? { ...current, index: current.index + 1 } : current) : undefined}
      onEndWorkout={pose ? () => setView('finished') : undefined} />;
  }
  if (view === 'transition' && run) {
    const { exercise, sets } = run.plan.exercises[run.index];
    return <StrengthScreenFrame header={<StrengthHeader title="Next movement" subtitle={'Exercise ' + (run.index + 1) + ' of ' + run.plan.exercises.length} onBack={() => setView('finished')} backLabel="Finish workout here" progress={run.index / run.plan.exercises.length} />}
      footer={<><StrengthButton title="I’m ready" onPress={() => setView('session')} /><StrengthButton title="Finish here" variant="ghost" onPress={() => setView('finished')} /></>}>
      <Text style={s.title}>{exercise.name}</Text><Text style={s.body}>{sets} sets · {exercise.mode === 'hold' ? exercise.holdSec + 's hold' : exercise.defaultReps + ' reps per set'}</Text><MovementGuide exercise={exercise} /><StrengthNote icon="leaf-outline">Take the time you need. The next movement starts only when you are ready.</StrengthNote>
    </StrengthScreenFrame>;
  }
  if (view === 'finished' && run) {
    const completeCount = run.results.filter(item => item.completionState === 'completed').length;
    const measured = run.results.filter(item => item.sessionMode === 'pose').reduce((sum, item) => sum + item.reps, 0);
    const paced = run.results.filter(item => item.sessionMode !== 'pose').reduce((sum, item) => sum + item.reps, 0);
    return <StrengthScreenFrame header={<StrengthHeader title="Your workout" />} footer={<><StrengthButton title="Done" onPress={exit} /><StrengthButton title="View progress" variant="ghost" onPress={() => { setRun(null); setView('progress'); }} /></>}>
      <View style={s.finishMark}><Icon name="checkmark-circle-outline" size={40} color={c.sage} /></View>
      <Text style={s.title}>Beautiful work.</Text><Text style={s.body}>You made time for yourself today.</Text><Text style={s.sectionTitle}>{run.plan.name}</Text>
      <View style={s.metrics}><Metric value={completeCount + ' / ' + run.plan.exercises.length} label="exercises completed" /><Metric value={Math.round(run.results.reduce((sum, item) => sum + item.durationSec, 0) / 60) + ' min'} label="session time" /></View>
      {measured > 0 ? <Text style={s.body}>{measured} camera-counted reps</Text> : null}{paced > 0 ? <Text style={s.body}>{paced} paced reps · not measured</Text> : null}
      <StatsHeader stats={stats} /><Text style={s.supporting}>Your movement summaries are saved on this device. Camera sessions sync when available.</Text>
    </StrengthScreenFrame>;
  }
  if (view === 'overview' && plan) return <StrengthScreenFrame header={<StrengthHeader title="Workout overview" onBack={() => setView(returnView)} />} footer={<StrengthButton title="Start workout" icon="play" onPress={() => start(plan)} />}>
    <Text style={s.title}>{plan.name}</Text><Text style={s.body}>{plan.intro}</Text>
    <View style={s.metaRow}><Meta text={'~' + planMinutes(plan) + ' min'} /><Meta text={LEVELS[plan.level].label} /><Meta text={areaLabel(plan.focus)} /></View>
    <Text style={s.body}>{plan.exercises.length} exercises · No weights needed</Text><Text style={s.supporting}>{planEquipment(plan)}</Text>
    <View><Text style={s.sectionTitle}>Your movements</Text><Text style={[s.supporting, { marginTop: 8 }]}>Tap a movement to read its guide or adjust sets.</Text>{plan.exercises.map((item, i) => <ExerciseCard key={item.exercise.id} {...item} index={i} onPress={exercise => { setSelected(exercise); setInspectIndex(i); setView('detail'); }} />)}</View>
    <StrengthNote title="Room to breathe" icon="time-outline">30–50 seconds of planned rest between sets. Take longer or finish early whenever you need.</StrengthNote>
    <Text style={s.supporting}>{Platform.OS === 'web' && TrackedPlayer ? 'Camera guidance is optional for supported movements. Other movements use camera-free pacing. No camera starts without your permission.' : 'This app uses camera-free pacing. Follow the timer and count your own repetitions; your movement is not measured.'}</Text>
  </StrengthScreenFrame>;

  if (recentRecord) return <StrengthScreenFrame header={<StrengthHeader title="Session summary" onBack={() => setRecentRecord(null)} />} footer={<StrengthButton title="Done" onPress={() => setRecentRecord(null)} />}>
    <Text style={s.title}>{recentRecord.name}</Text><Text style={s.body}>{new Date(recentRecord.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
    <Text style={s.body}>{recentRecord.completionState !== 'completed' ? 'Finished early. Your movement still counts.' : 'Movement completed.'}</Text>
    <View style={s.metrics}><Metric value={recentRecord.mode === 'hold' ? recentRecord.holdSec + ' sec' : recentRecord.reps} label={recentRecord.mode === 'hold' ? 'per paced hold' : recentRecord.sessionMode === 'pose' ? 'camera-counted reps' : 'paced reps'} /><Metric value={Math.round(recentRecord.durationSec / 60) + ' min'} label="including rests" /></View>
    <Text style={s.supporting}>{recentRecord.sessionMode === 'pose' ? 'Rep counts are based on visible movement, not a medical or fitness assessment.' : 'This was a timer-paced session. Repetitions were not measured by a camera.'}</Text>
  </StrengthScreenFrame>;

  const header = <StrengthHeader title="Strength" icon="fitness-outline" />;
  const loadingState = loading ? <StrengthSkeleton /> : loadError ? <StrengthEmpty title="Your history couldn’t load" body="Your workout choices are still available. Try loading your saved activity again." action="Try again" onAction={load} icon="alert-circle-outline" /> : null;
  const nav = <View style={s.nav}>{['home', 'library', 'progress'].map(destination => <StrengthButton key={destination} title={{ home: 'Today', library: 'Library', progress: 'Progress' }[destination]} variant={view === destination ? 'secondary' : 'ghost'} style={s.navItem} accessibilityState={{ selected: view === destination }} onPress={() => setView(destination)} />)}</View>;
  if (view === 'library') {
    const entries = filter.kind === 'workouts' ? WORKOUT_PLANS : EXERCISE_LIBRARY.map(item => singleMovePlan(item));
    const visible = entries.filter(item => (filter.area === 'all' || item.focus === filter.area) && (filter.level === 'all' || item.level === filter.level) && (filter.time === 'all' || (filter.time === 'short' ? planMinutes(item) <= 10 : filter.time === 'medium' ? planMinutes(item) > 10 && planMinutes(item) <= 20 : planMinutes(item) > 20)));
    return <StrengthScreenFrame header={header}>{nav}<Text style={s.title}>Find your kind of movement.</Text>
      <View style={s.nav}>{['workouts', 'movements'].map(kind => <StrengthButton key={kind} title={kind === 'workouts' ? 'Workouts' : 'Single movements'} variant={filter.kind === kind ? 'secondary' : 'ghost'} style={s.flex} accessibilityState={{ selected: filter.kind === kind }} onPress={() => setFilter(current => ({ ...current, kind }))} />)}</View>
      <FilterRow label="Target area" values={FOCUS_AREAS} value={filter.area} onChange={area => setFilter(current => ({ ...current, area }))} />
      <StrengthButton title={moreFilters ? 'Fewer filters' : 'Time & effort filters'} variant="ghost" icon="options-outline" onPress={() => setMoreFilters(!moreFilters)} />
      {moreFilters ? <><FilterRow label="Time" values={[{ id: 'all', label: 'Any time' }, { id: 'short', label: 'Up to 10 min' }, { id: 'medium', label: '10–20 min' }, { id: 'long', label: '20+ min' }]} value={filter.time} onChange={time => setFilter(current => ({ ...current, time }))} /><FilterRow label="Effort" values={[{ id: 'all', label: 'Any effort' }, ...Object.values(LEVELS)]} value={filter.level} onChange={level => setFilter(current => ({ ...current, level }))} /></> : null}
      <Text style={s.supporting}>{visible.length} {filter.kind} · At home · No weights needed</Text>
      <View>{visible.map(item => filter.kind === 'workouts' ? <WorkoutRow key={item.id} plan={item} onPress={() => choosePlan(item)} /> : <ExerciseCard key={item.id} exercise={item.exercises[0].exercise} onPress={chooseExercise} />)}</View>
      {visible.length === 0 ? <StrengthEmpty title="A different combination?" body="Try a shorter session or another focus area." action="Clear filters" onAction={() => setFilter(current => ({ ...current, area: 'all', level: 'all', time: 'all' }))} /> : null}
    </StrengthScreenFrame>;
  }
  const recent = <View style={s.section}><Text style={s.sectionTitle}>Recent movement</Text>{!records.length ? <StrengthEmpty title="Your first workout belongs here." body="Choose something that feels right today. Your saved sessions will appear here." action="Explore workouts" onAction={() => setView('library')} /> : records.slice(0, view === 'progress' ? 20 : 3).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'View ' + item.name + ' session'} onPress={() => setRecentRecord(item)} style={({ pressed }) => [s.activity, pressed && { opacity: 0.65 }]}><View style={s.flex}><Text style={s.activityTitle}>{item.name}</Text><Text style={s.supporting}>{new Date(item.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {item.sessionMode === 'pose' ? 'Camera guidance' : 'Paced guidance'}{item.completionState === 'stopped' ? ' · Finished early' : ''}</Text></View><Icon name="chevron-forward" size={20} color={c.muted} /></Pressable>)}</View>;
  if (view === 'progress') return <StrengthScreenFrame header={header}>{nav}<Text style={s.title}>Little by little.</Text><Text style={s.body}>A record of showing up, not a score to chase.</Text>{loadingState}{!loading && !loadError ? <><StatsHeader stats={stats} />{records.length > 0 ? <><View style={s.metrics}><Metric value={stats.sessions} label="movement sessions" /><Metric value={stats.totalMinutes} label="total minutes" /></View><Text style={s.supporting}>Time includes rests. Guided reps are paced, not measured.</Text>{stats.areas.length ? <View style={s.section}><Text style={s.sectionTitle}>Where you’ve moved</Text>{stats.areas.map(([area, count]) => <View key={area} style={s.areaRow}><Text style={s.body}>{areaLabel(area)}</Text><Text style={s.supporting}>{count} sessions</Text></View>)}</View> : null}</> : null}{recent}</> : null}</StrengthScreenFrame>;
  return <StrengthScreenFrame header={header}>{nav}<View style={s.section}><Text style={s.title}>Ready to move?</Text><Text style={s.body}>A little strength. A little time for you.</Text></View>
    {Platform.OS !== 'web' ? <StrengthNote icon="time-outline" title="Guided Strength">Camera-free workouts with paced reps and rest timers. Reps follow the timer; they are not measured from your movement.</StrengthNote> : null}
    <View style={s.recommendation}><View style={s.recommendTop}><Icon name="fitness-outline" size={28} color={c.accent} /><Text style={s.supporting}>Today’s suggestion</Text></View><Text style={s.recommendName}>{WORKOUT_PLANS[0].name}</Text><Text style={s.body}>Three familiar movements. Room to go at your own pace.</Text><Text style={s.metaText}>~{planMinutes(WORKOUT_PLANS[0])} min · Steady · Full body</Text><Text style={s.supporting}>3 exercises · No weights needed</Text><StrengthButton title="View today’s workout" icon="arrow-forward" onPress={() => choosePlan(WORKOUT_PLANS[0])} /></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Choose a gentle start" onPress={() => choosePlan(WORKOUT_PLANS[1])} style={({ pressed }) => [s.gentle, pressed && { opacity: 0.65 }]}><Icon name="leaf-outline" size={24} color={c.sage} /><View style={s.flex}><Text style={s.activityTitle}>A lower-energy day?</Text><Text style={s.supporting}>Keep it gentle with a shorter session.</Text></View><Icon name="chevron-forward" size={20} color={c.sage} /></Pressable>
    {loadingState}{!loading && !loadError ? <StatsHeader stats={stats} /> : null}<StrengthButton title="Explore workouts" variant="secondary" onPress={() => setView('library')} />{!loading && !loadError ? recent : null}
  </StrengthScreenFrame>;
}

function areaLabel(id) { return FOCUS_AREAS.find(item => item.id === id)?.label || 'Full body'; }
function Meta({ text }) { const { styles: s } = useStrengthStyles(sheet); return <Text style={s.meta}>{text}</Text>; }
function Metric({ value, label }) { const { styles: s } = useStrengthStyles(sheet); return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.supporting}>{label}</Text></View>; }
function FilterRow({ label, values, value, onChange }) {
  const { styles: s } = useStrengthStyles(sheet);
  return <View style={s.filter}><Text style={s.supporting}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterItems}>{values.map(item => <StrengthButton key={item.id} title={item.label} variant={value === item.id ? 'primary' : 'secondary'} accessibilityState={{ selected: value === item.id }} onPress={() => onChange(item.id)} />)}</ScrollView></View>;
}
function WorkoutRow({ plan, onPress }) {
  const { colors: c, styles: s } = useStrengthStyles(sheet);
  return <Pressable accessibilityRole="button" accessibilityLabel={plan.name + ', ' + planMinutes(plan) + ' minutes'} onPress={onPress} style={({ pressed, focused }) => [s.workoutRow, pressed && { opacity: 0.65 }, focused && { borderColor: c.accent }]}><Icon name={plan.icon} size={28} color={c.accent} /><View style={s.flex}><Text style={s.activityTitle}>{plan.name}</Text><Text style={s.supporting}>~{planMinutes(plan)} min · {LEVELS[plan.level].label} · {areaLabel(plan.focus)}</Text><Text style={s.supporting}>{plan.exercises.length} exercises · No weights</Text></View><Icon name="chevron-forward" size={18} color={c.muted} /></Pressable>;
}
const sheet = c => ({
  flex: { flex: 1, minWidth: 0 }, title: { ...T.title, color: c.ink }, body: { ...T.body, color: c.body }, supporting: { ...T.supporting, color: c.muted },
  section: { gap: 12 }, sectionTitle: { ...T.heading, color: c.ink }, nav: { flexDirection: 'row', gap: 4 }, navItem: { flex: 1, paddingHorizontal: 8 },
  recommendation: { backgroundColor: c.surface, borderRadius: 16, padding: 24, gap: 16 }, recommendTop: { flexDirection: 'row', gap: 12, alignItems: 'center' }, recommendName: { ...T.title, color: c.ink, fontSize: 28, lineHeight: 34 },
  metaText: { ...T.supporting, color: c.body, fontWeight: '600' }, gentle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 76 },
  activity: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderColor: c.line }, activityTitle: { ...T.body, color: c.ink, fontWeight: '600', marginBottom: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, meta: { ...T.supporting, color: c.body, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  workoutRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 104, paddingVertical: 20, borderBottomWidth: 1, borderColor: c.line },
  filter: { gap: 8 }, filterItems: { gap: 8, paddingVertical: 4, paddingHorizontal: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }, metric: { flex: 1, minWidth: 110, gap: 8 }, metricValue: { ...T.title, color: c.ink, fontVariant: ['tabular-nums'] },
  areaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 12 }, finishMark: { paddingTop: 24, paddingBottom: 8 },
});
