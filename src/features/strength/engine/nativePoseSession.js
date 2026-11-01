const { createPositioningCoach } = require('./positioningCoach');
const { createRepStateMachine } = require('./repStateMachine');
const { midpoint, point } = require('./jointAngles');
function normalizeNativePose(event) {
  const value = event?.nativeEvent || event;
  if (!value || !Number.isFinite(value.ts) || !Number.isFinite(value.sourceWidth) || !Number.isFinite(value.sourceHeight) || value.sourceWidth <= 0 || value.sourceHeight <= 0 || !Array.isArray(value.poses) || value.poses.length > 2) return null;
  const poses = [];
  for (const pose of value.poses) {
    if (!Array.isArray(pose) || pose.length !== 33 || pose.some(p => !p || !['x','y','z','visibility','presence'].every(k => Number.isFinite(p[k])))) return null;
    poses.push(pose.map((p,id) => ({ id, x:p.x, y:p.y, z:p.z, visibility:p.visibility, presence:p.presence, aspectRatio:value.sourceWidth/value.sourceHeight })));
  }
  return { ts:value.ts, sourceWidth:value.sourceWidth, sourceHeight:value.sourceHeight, mirrored:value.mirrored === true, poseCount:poses.length, landmarks:poses[0] || [] };
}
function createNativePoseSession(exercise, { sets=1, targetReps=8, now=Date.now, coachFactory=createPositioningCoach, engineFactory=createRepStateMachine }={}) {
  if (!exercise) throw new Error('Unsupported pose exercise');
  sets=Math.max(1,Math.min(10,Math.floor(sets)||1)); targetReps=Math.max(1,Math.min(100,Math.floor(targetReps)||8));
  let coach=coachFactory({cameraView:exercise.camera, mirrored:true}), engine=null, baseline=null;
  let phase='calibrating', instruction='Hold your full body in view.', currentSet=1, completedSets=0, totalReps=0, reps=0, receivedAt=0, lastTs=-Infinity, geometry=null, latest=null, startedAt=null, finishedAt=null;
  const snapshot=()=>({phase,instruction,currentSet,completedSets,sets,targetReps,reps,totalReps:totalReps+reps,started:startedAt!==null});
  function reframe() { engine?.interrupt(); coach.reset(); phase='calibrating'; latest=null; instruction='Hold your full body in view before continuing.'; }
  function ingest(frame) {
    if (!frame || phase==='complete' || frame.ts <= lastTs) return snapshot();
    lastTs=frame.ts; receivedAt=now();
    const nextGeometry=[frame.sourceWidth,frame.sourceHeight,frame.mirrored].join(':');
    if (geometry && geometry!==nextGeometry) reframe();
    geometry=nextGeometry;
    if (phase==='paused' || phase==='rest') return snapshot();
    latest=frame;
    const framing=coach.process(frame); instruction=framing.instruction;
    if (phase==='calibrating' || phase==='ready') {
      phase=framing.ready ? 'ready':'calibrating'; return snapshot();
    }
    if (phase==='active') {
      const result=engine.process(frame); reps=result.reps;
      if (result.events.some(e=>e.type==='pauseRequested')) reframe();
      if (reps >= targetReps) {
        totalReps+=reps; reps=0; completedSets++;
        if (completedSets>=sets) { phase='complete'; finishedAt=now(); latest=null; }
        else { phase='rest'; instruction='Rest. Continue when you are ready.'; }
      }
    }
    return snapshot();
  }
  function start() {
    if (phase!=='ready' || !latest || now()-receivedAt>1500) { if (phase==='ready') reframe(); return snapshot(); }
    const visibility=side=>[side?12:11,side?24:23,side?26:25,side?28:27].reduce((sum,id)=>sum+(point(latest.landmarks,id)?.visibility||0),0);
    const nextBaseline={activeSide:visibility(true)>visibility(false)?'right':'left',shoulderMid:midpoint(point(latest.landmarks,11),point(latest.landmarks,12)),hipMid:midpoint(point(latest.landmarks,23),point(latest.landmarks,24)),hipDeviation:0};
    if (!engine) { baseline=nextBaseline; engine=engineFactory(exercise,baseline); } else { Object.assign(baseline,nextBaseline); engine.interrupt(); }
    if (startedAt===null) startedAt=now(); phase='active'; return snapshot();
  }
  function pause() { if (['active','ready','calibrating'].includes(phase)) { engine?.interrupt(); phase='paused'; latest=null; } return snapshot(); }
  function resume() { if (phase==='paused') reframe(); return snapshot(); }
  function nextSet() { if (phase==='rest') { currentSet++; engine=null; reps=0; reframe(); } return snapshot(); }
  function finish() { if (startedAt!==null) { finishedAt=now(); phase='complete'; latest=null; } return snapshot(); }
  function summary(catalog) {
    if (phase!=='complete' || startedAt===null) return null;
    return {id:'strength-native-'+startedAt,exerciseId:catalog.id,name:catalog.name,sessionMode:'pose',completionState:completedSets>=sets?'completed':'stopped',reps:totalReps+reps,sets,completedSets,targetReps,durationSec:Math.max(1,Math.round((finishedAt-startedAt)/1000)),completedAt:new Date(finishedAt).toISOString()};
  }
  return {ingest,start,pause,resume,nextSet,finish,summary,snapshot,checkStall(){if(phase==='active' && now()-receivedAt>1500) pause();return snapshot();}};
}
function createCameraPermissionGuard() {
  let revision=0,awaiting=false;
  return {
    begin(){if(awaiting)return null;awaiting=true;return ++revision;},
    invalidate(){revision++;awaiting=false;},
    leave({focused}){if(!focused||!awaiting)this.invalidate();},
    isCurrent(token){return token!==null&&token===revision;},
    finish(token){if(token===revision)awaiting=false;},
  };
}
module.exports={normalizeNativePose,createNativePoseSession,createCameraPermissionGuard};
