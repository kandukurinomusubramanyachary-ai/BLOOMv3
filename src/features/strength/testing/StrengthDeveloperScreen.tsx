import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Circle, Line} from 'react-native-svg';
import {tokens} from '../../../theme/tokens';
import {Body, Button, Eyebrow, Page, ScreenHeader, Section} from '../components/Primitives';
import {SquatEngine} from '../exercises/squat/squat.engine';
import type {SquatResult} from '../exercises/squat/squat.types';
import type {StrengthStackParamList} from '../navigation/types';
import {LANDMARK} from '../pose/landmarkIds';
import {LandmarkSmoother} from '../pose/landmarkSmoother';
import type {PoseFrame} from '../pose/types';
import {SQUAT_FIXTURES, type SquatFixture} from './squatFixtures';

type Props = NativeStackScreenProps<StrengthStackParamList, 'StrengthDeveloper'>;
type Snapshot = {result: SquatResult; frame: PoseFrame | null; index: number; fps: number | null};

const CONNECTIONS = [
  [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
  [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
  [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
  [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
  [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
  [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
  [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
  [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
] as const;

function Skeleton({frame}: {frame: PoseFrame | null}) {
  const points = new Map(frame?.landmarks.map(point => [point.id, point]));
  const held = new Set(frame?.heldLandmarkIds ?? []);
  const ratio = frame?.aspectRatio ?? 1;
  return <View style={styles.skeleton} accessibilityLabel="Simulated pose landmarks">
    <Svg width="100%" height={220} viewBox={`0 0 ${ratio} 1`}>
      {CONNECTIONS.map(([from, to]) => {
        const start = points.get(from);
        const end = points.get(to);
        return start && end ? <Line key={`${from}-${to}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
          stroke={tokens.colors.ink} strokeWidth={0.008}/> : null;
      })}
      {[...points.values()].map(point => <Circle key={point.id} cx={point.x} cy={point.y} r={0.012}
        fill={held.has(point.id) ? tokens.colors.muted : tokens.colors.primary}/>)}
    </Svg>
    <Text style={styles.source}>SIMULATED · EPHEMERAL LANDMARKS</Text>
  </View>;
}

function Metric({label, value, testID}: {label: string; value: string; testID: string}) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text>
    <Text testID={testID} style={styles.metricValue}>{value}</Text></View>;
}

function DeveloperPlayback({navigation}: Props) {
  const [fixture, setFixture] = useState<SquatFixture>(SQUAT_FIXTURES[0]);
  const [playing, setPlaying] = useState(false);
  const [runtime] = useState(() => ({
    engine: new SquatEngine(), smoother: new LandmarkSmoother(),
    frames: SQUAT_FIXTURES[0].createFrames(), cursor: 0,
    timestamps: [] as number[],
  }));
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({result: runtime.engine.getResult(), frame: null, index: 0, fps: null}));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const reset = useCallback((next: SquatFixture = fixture) => {
    clearTimer();
    setPlaying(false);
    runtime.engine.reset();
    runtime.smoother.reset();
    runtime.frames = next.createFrames();
    runtime.cursor = 0;
    runtime.timestamps = [];
    setFixture(next);
    setSnapshot({result: runtime.engine.getResult(), frame: null, index: 0, fps: null});
  }, [clearTimer, fixture, runtime]);

  const step = useCallback(() => {
    const raw = runtime.frames[runtime.cursor];
    if (!raw) { setPlaying(false); return; }
    const frame = runtime.smoother.process(raw);
    const result = runtime.engine.process(frame);
    runtime.cursor += 1;
    runtime.timestamps.push(raw.timestamp);
    if (runtime.timestamps.length > 12) runtime.timestamps.shift();
    const elapsed = raw.timestamp - runtime.timestamps[0];
    const fps = runtime.timestamps.length > 1 && elapsed > 0
      ? ((runtime.timestamps.length - 1) * 1000) / elapsed : null;
    setSnapshot({result, frame, index: runtime.cursor, fps});
    if (runtime.cursor >= runtime.frames.length) setPlaying(false);
  }, [runtime]);

  useEffect(() => {
    if (!playing) return;
    const next = runtime.frames[runtime.cursor];
    if (!next) return;
    const previous = runtime.frames[runtime.cursor - 1];
    // Playback cadence follows fixture source timestamps, never a fake FPS.
    const delay = previous ? Math.max(0, next.timestamp - previous.timestamp) : 0;
    timer.current = setTimeout(step, delay);
    return clearTimer;
  }, [clearTimer, playing, runtime, snapshot.index, step]);

  useEffect(() => () => {
    clearTimer();
    runtime.engine.reset();
    runtime.smoother.reset();
    runtime.timestamps = [];
  }, [clearTimer, runtime]);

  const togglePlayback = () => {
    clearTimer();
    if (playing) { setPlaying(false); return; }
    if (runtime.cursor >= runtime.frames.length) reset();
    setPlaying(true);
  };
  const angle = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}°`;
  const {result} = snapshot;

  return <Page>
    <ScreenHeader title="Strength lab" onBack={() => navigation.goBack()}/>
    <Eyebrow>DEVELOPER ONLY · SIMULATED</Eyebrow>
    <Text style={styles.title}>Observe the engine.</Text>
    <Body>Replay synthetic landmark sequences through the real smoother and squat engine. No camera, recordings, or workout history.</Body>

    <Section>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Choose a sequence</Text>
      <View style={styles.fixtures}>
        {SQUAT_FIXTURES.map(item => <Pressable key={item.id} accessibilityRole="button"
          accessibilityLabel={item.label} accessibilityState={{selected: item.id === fixture.id}}
          onPress={() => reset(item)}
          style={({pressed}) => [styles.fixture, fixture.id === item.id && styles.selected, pressed && styles.pressed]}>
          <Text style={[styles.fixtureText, fixture.id === item.id && styles.selectedText]}>{item.label}</Text>
        </Pressable>)}
      </View>
      <Body>Expected complete reps: {fixture.expectedReps}</Body>
    </Section>

    <Section>
      <Skeleton frame={snapshot.frame}/>
      <Text testID="dev-frame" style={styles.progress}>Frame {snapshot.index} of {runtime.frames.length}</Text>
      <View style={styles.controls}>
        <View style={styles.control}><Button label={playing ? 'Pause' : snapshot.index === runtime.frames.length ? 'Replay' : 'Play'} onPress={togglePlayback}/></View>
        <View style={styles.control}><Button label="Step frame" variant="secondary" disabled={playing || snapshot.index >= runtime.frames.length} onPress={step}/></View>
      </View>
      <Button label="Reset sequence" variant="text" onPress={() => reset()}/>
    </Section>

    <Section>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Live engine output</Text>
      <View style={styles.metrics}>
        <Metric label="State" value={result.state} testID="dev-state"/>
        <Metric label="Completed reps" value={String(result.reps)} testID="dev-reps"/>
        <Metric label="Confidence" value={`${(result.confidence * 100).toFixed(1)}%`} testID="dev-confidence"/>
        <Metric label="Tracking" value={result.trackingStatus} testID="dev-tracking"/>
        <Metric label="Left knee" value={angle(result.metrics.leftKneeAngle)} testID="dev-left-angle"/>
        <Metric label="Right knee" value={angle(result.metrics.rightKneeAngle)} testID="dev-right-angle"/>
        <Metric label="Source timestamp" value={snapshot.frame ? `${snapshot.frame.timestamp} ms` : '—'} testID="dev-timestamp"/>
        <Metric label="Source FPS" value={snapshot.fps === null ? '—' : snapshot.fps.toFixed(1)} testID="dev-fps"/>
      </View>
      <Body>{result.formFlags.length ? result.formFlags.map(flag => flag.message).join(' ') : 'No form observations in this frame.'}</Body>
    </Section>
  </Page>;
}

/** The navigator also loads this module only inside its __DEV__ branch. */
export default function StrengthDeveloperScreen(props: Props) {
  if (!__DEV__) return null;
  return <DeveloperPlayback {...props}/>;
}

const styles = StyleSheet.create({
  title: {fontSize:32,lineHeight:38,fontWeight:'600',letterSpacing:-1,color:tokens.colors.ink,marginTop:10,marginBottom:12},
  sectionTitle: {fontSize:20,lineHeight:26,fontWeight:'600',color:tokens.colors.ink},
  fixtures: {flexDirection:'row',flexWrap:'wrap',gap:8},
  fixture: {paddingHorizontal:14,paddingVertical:12,minHeight:44,borderRadius:22,borderWidth:1,borderColor:tokens.colors.border},
  selected: {backgroundColor:tokens.colors.ink,borderColor:tokens.colors.ink},
  fixtureText: {fontSize:13,lineHeight:18,color:tokens.colors.ink},selectedText:{color:tokens.colors.white},pressed:{opacity:.7},
  skeleton: {borderRadius:20,backgroundColor:tokens.colors.soft,padding:16},
  source: {fontSize:10,lineHeight:16,letterSpacing:1,color:tokens.colors.muted,textAlign:'center',marginTop:8},
  progress: {fontSize:13,color:tokens.colors.muted,textAlign:'center'},controls:{flexDirection:'row',gap:10},control:{flex:1},
  metrics: {flexDirection:'row',flexWrap:'wrap',borderTopWidth:1,borderTopColor:tokens.colors.line},
  metric: {width:'50%',paddingVertical:14,paddingRight:8,borderBottomWidth:1,borderBottomColor:tokens.colors.line,gap:6},
  metricLabel: {fontSize:12,lineHeight:18,color:tokens.colors.muted},
  metricValue: {fontSize:16,lineHeight:22,fontWeight:'600',fontVariant:['tabular-nums'],color:tokens.colors.ink},
});
