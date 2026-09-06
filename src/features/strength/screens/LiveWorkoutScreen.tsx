import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Switch, Text, View} from 'react-native';
import {useFocusEffect, useIsFocused} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {StrengthStackParamList} from '../navigation/types';
import {useStrengthSession} from '../hooks/StrengthTrackingContext';
import {Page, ScreenHeader, Button, Body, Section, Notice} from '../components/Primitives';
import {CameraFrame} from '../components/CameraFrame';
import {RepCounter} from '../components/RepCounter';
import {FormFeedback} from '../components/FormFeedback';
import {TrackingStatus} from '../components/TrackingStatus';
import {SquatIllustration} from '../components/SquatIllustration';
import {SQUAT_CONFIG} from '../exercises/squat/squat.config';
import {tokens} from '../../../theme/tokens';

export function LiveWorkoutScreen({navigation,route}:NativeStackScreenProps<StrengthStackParamList,'LiveWorkout'>) {
  const tracking=useStrengthSession();
  const focused=useIsFocused();
  const manual=route.params.mode==='manual';
  const [manualReps,setManualReps]=useState(0);
  const finished=useRef(false);
  const reps=manual?manualReps:tracking.result.reps;
  const target=SQUAT_CONFIG.targetReps;
  const {deactivate}=tracking;
  useFocusEffect(useCallback(()=>{if(manual)deactivate();return ()=>deactivate();},[deactivate,manual]));
  const finish=useCallback(()=>{
    if(finished.current)return;
    finished.current=true;deactivate();
    navigation.replace('WorkoutComplete',{reps,mode:route.params.mode,reachedTarget:reps>=target});
  },[deactivate,navigation,reps,route.params.mode,target]);
  useEffect(()=>{if(reps>=target)finish();},[finish,reps,target]);
  const unavailable=tracking.adapterState.status==='UNAVAILABLE'||tracking.adapterState.status==='ERROR'||!!tracking.cameraError;
  const status=unavailable?'UNAVAILABLE':tracking.adapterState.status==='INITIALIZING'?'INITIALIZING':tracking.result.trackingStatus;
  return <Page footer={<>
    {manual && <Button label="Log one repetition" onPress={()=>setManualReps(value=>Math.min(target,value+1))}/>}
    <Button label="End workout" variant={manual?'text':'secondary'} onPress={finish}/>
  </>}>
    <ScreenHeader title="Squat" right={<Text style={s.mode}>{manual?'CAMERA-FREE':'BODYWEIGHT'}</Text>}/>
    <RepCounter reps={reps} target={target} manual={manual}/>
    {manual ? <>
      <View style={s.illustration}><SquatIllustration/></View>
      <Section><Notice title="Your pace. Your count.">Form tracking is unavailable in camera-free mode. Tap below after each repetition to keep your own count.</Notice></Section>
      <Button label="Undo last repetition" variant="text" disabled={manualReps===0} onPress={()=>setManualReps(value=>Math.max(0,value-1))}/>
    </> : <>
      <CameraFrame enabled={focused&&tracking.cameraEnabled} permissionGranted={tracking.adapterState.permission==='GRANTED'} nativeTracking={tracking.adapterState.available} onError={tracking.failCamera}/>
      <TrackingStatus status={status}/>
      {tracking.adapterState.permission!=='GRANTED' && <Section><Body>Camera access is needed to track this set.</Body><Button label="Allow camera access" variant="secondary" onPress={()=>void tracking.requestPermission()}/></Section>}
      {unavailable && <Section><Notice title="Tracking has paused">Your completed repetitions are still here. Retry when you’re ready, or finish this set.</Notice><Button label="Retry tracking" variant="secondary" onPress={tracking.retry}/></Section>}
      {tracking.feedbackEnabled && <FormFeedback message={status==='TRACKING'?tracking.feedback:null}/>}
      <View style={s.feedbackToggle}><Text style={s.toggleLabel}>Gentle form cues</Text><Switch accessibilityLabel="Gentle form cues" value={tracking.feedbackEnabled} onValueChange={tracking.toggleFeedback} trackColor={{true:tokens.colors.primary,false:tokens.colors.border}}/></View>
    </>}
  </Page>;
}
const s=StyleSheet.create({mode:{fontSize:9,lineHeight:14,fontWeight:'600',letterSpacing:1,color:tokens.colors.muted},illustration:{backgroundColor:tokens.colors.peach,borderRadius:20,paddingVertical:12},feedbackToggle:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',minHeight:60,gap:12},toggleLabel:{fontSize:13,color:tokens.colors.muted}});
