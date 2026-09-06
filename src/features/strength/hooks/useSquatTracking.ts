import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';
import {createNativePoseAdapter} from '../pose/nativePoseAdapter';
import {createNativePoseDriver} from '../pose/nativePoseBridge';
import {cameraPermissions} from '../pose/cameraPermissions';
import {TrackingSession} from '../session/trackingSession';

export function useSquatTracking() {
  const [runtime] = useState(()=>({adapter:createNativePoseAdapter({driver:createNativePoseDriver(),permissions:cameraPermissions}),session:new TrackingSession()}));
  const [adapterState,setAdapterState] = useState(runtime.adapter.getSnapshot());
  const [snapshot,setSnapshot] = useState(runtime.session.getSnapshot());
  const [cameraRequested,setCameraRequested] = useState(false);
  const [appActive,setAppActive] = useState(AppState.currentState==='active');
  const [retryVersion,setRetryVersion] = useState(0);
  const [cameraError,setCameraError] = useState<string|null>(null);
  const [feedbackEnabled,setFeedback] = useState(true);
  const alive=useRef(true);
  const cameraEnabled=cameraRequested&&appActive&&!cameraError;

  useEffect(()=>{
    alive.current=true;
    const offState=runtime.adapter.subscribeState(next=>{
      if(!alive.current)return;
      setAdapterState(next);
      if(next.status!=='RUNNING')setSnapshot(runtime.session.invalidate());
    });
    const offFrame=runtime.adapter.subscribeFrames(frame=>{
      if(alive.current)setSnapshot(runtime.session.process(frame,Date.now()));
    });
    const appSubscription=AppState.addEventListener('change',state=>{
      setAppActive(state==='active');
      if(state!=='active')setSnapshot(runtime.session.invalidate());
    });
    return ()=>{alive.current=false;offState();offFrame();appSubscription.remove();void runtime.adapter.dispose();};
  },[runtime]);

  useEffect(()=>{
    let cancelled=false;
    if(cameraEnabled){
      runtime.session.restartCapture();
      void runtime.adapter.initialize().then(()=>{if(!cancelled)return runtime.adapter.start();});
    }else{
      setSnapshot(runtime.session.invalidate());
      void runtime.adapter.stop();
    }
    return ()=>{cancelled=true;void runtime.adapter.stop();};
  },[cameraEnabled,retryVersion,runtime]);

  useEffect(()=>{
    if(!cameraEnabled)return;
    const timer=setInterval(()=>{
      if(runtime.adapter.getSnapshot().status==='RUNNING'&&!runtime.session.checkFreshness(Date.now()))setSnapshot(runtime.session.getSnapshot());
    },250);
    return ()=>clearInterval(timer);
  },[cameraEnabled,runtime]);

  const activateSetup=useCallback(()=>{
    runtime.session.setup();setSnapshot(runtime.session.getSnapshot());setCameraError(null);setCameraRequested(true);
  },[runtime]);
  const deactivate=useCallback(()=>{setCameraRequested(false);setSnapshot(runtime.session.invalidate());},[runtime]);
  const startWorkout=useCallback(()=>{
    if(runtime.adapter.getSnapshot().status!=='RUNNING'||!runtime.session.beginWorkout(Date.now()))return false;
    setSnapshot(runtime.session.getSnapshot());return true;
  },[runtime]);
  const requestPermission=useCallback(async()=>{
    await runtime.adapter.requestPermission();
    if(alive.current)setRetryVersion(value=>value+1);
  },[runtime]);
  const retry=useCallback(()=>{setCameraError(null);setRetryVersion(value=>value+1);},[]);
  const failCamera=useCallback(()=>{setCameraError('The camera could not open. Try again or continue without it.');setSnapshot(runtime.session.invalidate());},[runtime]);
  const toggleFeedback=useCallback((enabled:boolean)=>{setFeedback(enabled);runtime.session.setFeedbackEnabled(enabled);setSnapshot(runtime.session.getSnapshot());},[runtime]);

  return {...snapshot,adapterState,cameraEnabled,cameraError,feedbackEnabled,activateSetup,deactivate,startWorkout,requestPermission,retry,failCamera,toggleFeedback};
}
export type SquatTracking = ReturnType<typeof useSquatTracking>;
