import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PermissionsAndroid, Platform, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { requireOptionalNativeModule, requireNativeViewManager } from 'expo-modules-core';
import { exerciseById } from './exercises';
import { poseEngineIdForExercise } from './poseCapability';
import { createNativePoseSession, normalizeNativePose } from './engine/nativePoseSession';
import { StrengthButton, StrengthHeader, StrengthNote, StrengthScreenFrame } from './components/StrengthUI';
import { STRENGTH_TYPE as T, useStrengthStyles } from './strengthTheme';
const native = requireOptionalNativeModule('BloomPose');
const PoseView = native ? requireNativeViewManager('BloomPose') : null;
export default function TrackedStrengthScreen(props) { return <NativePlayer key={props.exercise.id+':'+props.sets} {...props} />; }
function NativePlayer({ exercise, sets=1, onFallback, onExit, onComplete, onNext, nextLabel }) {
  const { styles:s }=useStrengthStyles(sheet);
  const focused=useIsFocused();
  const session=useMemo(()=>createNativePoseSession(exerciseById(poseEngineIdForExercise(exercise.id)),{sets,targetReps:exercise.defaultReps}),[exercise.id,sets]);
  const [state,setState]=useState(session.snapshot());
  const [camera,setCamera]=useState(false), [foreground,setForeground]=useState(AppState.currentState==='active');
  const [error,setError]=useState(''), [pending,setPending]=useState(false), [saved,setSaved]=useState(false);
  const mounted=useRef(true), saving=useRef(false), summary=useRef(null), attempt=useRef(0);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;attempt.current++;};},[]);
  useEffect(()=>{const sub=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>sub.remove();},[]);
  useEffect(()=>{if(!focused||!foreground) {setState(session.pause());setCamera(false);attempt.current++;}},[focused,foreground,session]);
  useEffect(()=>{const timer=setInterval(()=>setState(session.checkStall()),1000);return()=>clearInterval(timer);},[session]);
  async function openCamera() {
    if(pending || !PoseView) return;
    const version=++attempt.current;setPending(true);setError('');
    try {
      const granted=Platform.OS==='android' ? await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA)===PermissionsAndroid.RESULTS.GRANTED : await native.requestPermission();
      if(!mounted.current||version!==attempt.current) return;
      if(!granted) {setError('Camera permission is off. You can enable it in device settings or continue guided.');return;}
      setState(session.resume());setCamera(true);
    } catch {if(mounted.current&&version===attempt.current)setError('Camera access is unavailable. Continue guided or try again.');}
    finally {if(mounted.current)setPending(false);}
  }
  async function save() {
    if(saving.current||saved)return;
    summary.current=summary.current||session.summary(exercise);if(!summary.current)return;
    saving.current=true;setPending(true);setError('');
    try {await onComplete(summary.current);if(mounted.current)setSaved(true);}
    catch {if(mounted.current)setError('Your result is still here. Try saving again before leaving.');}
    finally {saving.current=false;if(mounted.current)setPending(false);}
  }
  useEffect(()=>{if(state.phase==='complete'){setCamera(false);void save();}},[state.phase]);
  const active=camera&&focused&&foreground&&state.phase!=='complete';
  return <StrengthScreenFrame header={<StrengthHeader title={exercise.name} subtitle='Native camera QA ? device validation pending' onBack={state.started&&state.phase!=='complete'?undefined:onExit} />}>
    <View style={s.content}>
      <StrengthNote icon='information-circle-outline'>Experimental on-device tracking. Counts can be wrong. Stop if you feel pain or unwell.</StrengthNote>
      {active&&PoseView?<PoseView style={s.camera} active={active} inferenceActive={['calibrating','ready','active'].includes(state.phase)} onReady={()=>setError('')} onPose={event=>{const frame=normalizeNativePose(event);if(frame)setState(session.ingest(frame));}} onError={()=>{setState(session.pause());setCamera(false);setError('Camera interrupted. Your counted reps are kept. Reopen the camera to reframe.');}}/>:null}
      <Text accessibilityRole='header' style={s.title}>{state.phase==='complete'?'Session summary':state.instruction}</Text>
      <Text accessibilityLiveRegion='polite' style={s.body}>{state.totalReps} camera-counted reps ? Set {state.currentSet} of {state.sets}</Text>
      {error?<Text accessibilityRole='alert' style={s.body}>{error}</Text>:null}
      {!PoseView?<Text style={s.body}>This build has no native pose module. Guided movement is available.</Text>:null}
      {state.phase==='complete'?<>
        <Text style={s.body}>{saved?'Saved to your workout history.':'Keep this screen open until the result is saved.'}</Text>
        {!saved?<StrengthButton title={pending?'Saving?':'Try saving again'} disabled={pending} onPress={save}/>:<StrengthButton title={nextLabel||'Done'} onPress={onNext||onExit}/>}
      </>:<>
        {!active&&PoseView?<StrengthButton title='Start camera tracking (QA)' disabled={pending||!focused||!foreground} onPress={openCamera}/>:null}
        {active&&state.phase==='ready'?<StrengthButton title='Start measured set' onPress={()=>setState(session.start())}/>:null}
        {active&&state.phase==='active'?<StrengthButton title='Pause' onPress={()=>{setState(session.pause());setCamera(false);}}/>:null}
        {state.phase==='rest'?<StrengthButton title='Ready for next set' onPress={()=>setState(session.nextSet())}/>:null}
        {state.started?<StrengthButton title='Finish and save' variant='secondary' onPress={()=>setState(session.finish())}/>:<StrengthButton title='Continue guided' variant='secondary' onPress={onFallback}/>}
      </>}
      <Text style={s.body}>Camera frames and raw landmarks are processed transiently. Saved records contain session totals only.</Text>
    </View>
  </StrengthScreenFrame>;
}
const sheet=c=>({content:{gap:20,paddingVertical:20},camera:{width:'100%',height:360,backgroundColor:'#121113',borderRadius:16},title:{...T.title,color:c.ink},body:{...T.body,color:c.body}});
