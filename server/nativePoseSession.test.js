const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeNativePose,createNativePoseSession}=require('../src/features/strength/engine/nativePoseSession');
const exercise=require('../src/features/strength/exercises/squat');
const {modeForExercise}=require('../src/features/strength/poseCapability');
const raw=()=>({ts:1,sourceWidth:480,sourceHeight:640,mirrored:true,poses:[Array.from({length:33},(_,id)=>({id,x:0.5,y:id/34,z:0,visibility:1,presence:1}))]});
test('native bridge requires all 33 measured landmarks and discards undeclared payload data',()=>{
  const input=raw();input.frames='must-not-propagate';input.measurements={fakeRep:true};const frame=normalizeNativePose({nativeEvent:input});assert.equal(frame.landmarks.length,33);assert.equal(frame.landmarks[32].id,32);assert.equal(frame.frames,undefined);assert.equal(frame.measurements,undefined);assert.equal(frame.landmarks[0].aspectRatio,0.75);
  for(const bad of [{...raw(),sourceWidth:0},{...raw(),ts:NaN},{...raw(),poses:[raw().poses[0].slice(0,19)]},{...raw(),poses:[raw().poses[0],raw().poses[0],raw().poses[0]]}])assert.equal(normalizeNativePose(bad),null);
  const bad=raw();bad.poses[0][31].x=Infinity;assert.equal(normalizeNativePose(bad),null);
});
test('native tracking is opt-in and only supported catalog movements can use pose',()=>{
  for(const platform of ['android','ios']) {assert.equal(modeForExercise('bodyweight-squat',platform),'guided');assert.equal(modeForExercise('bodyweight-squat',platform,true),'pose');assert.equal(modeForExercise('bird-dog',platform,true),'guided');}
});
test('native session preserves accepted reps across interruption and emits only scalar summaries',()=>{
  let clock=1000, count=0, interrupted=0;
  const f=createNativePoseSession(exercise,{targetReps:2,now:()=>clock,coachFactory:()=>({reset(){},process:frame=>({ready:frame.poseCount===1,instruction:'Ready'})}),engineFactory:()=>({process:()=>({reps:++count,events:[]}),interrupt(){interrupted++;}})});
  const frame=()=>{const r=raw();r.ts=++clock;return normalizeNativePose(r);};
  assert.equal(f.start().phase,'calibrating');f.ingest(frame());f.start();f.ingest(frame());assert.equal(f.snapshot().totalReps,1);
  f.pause();f.ingest(frame());assert.equal(f.snapshot().totalReps,1);f.resume();f.ingest(frame());f.start();f.ingest(frame());assert.equal(f.snapshot().phase,'complete');assert.ok(interrupted);
  const s=f.summary({id:'bodyweight-squat',name:'Squat'});assert.equal(s.reps,2);assert.equal(s.sessionMode,'pose');assert.equal(s.completionState,'completed');for(const value of Object.values(s)) assert.ok(['number','string'].includes(typeof value));
});
test('native session drops stale frames, rechecks framing after geometry changes and pauses a stalled camera',()=>{
  let clock=1000;const f=createNativePoseSession(exercise,{now:()=>clock,coachFactory:()=>({reset(){},process:()=>({ready:true,instruction:'Ready'})})});
  const r=raw();f.ingest(normalizeNativePose(r));clock+=1600;assert.equal(f.start().phase,'calibrating');r.ts++;f.ingest(normalizeNativePose(r));f.start();clock+=1600;assert.equal(f.checkStall().phase,'paused');assert.equal(f.snapshot().totalReps,0);f.finish();assert.equal(f.summary({id:'squat',name:'Squat'}).completionState,'stopped');
});

test('native and web bundle the same complete pose model, and CocoaPods resources stay within the pod root',()=>{const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');const root=path.resolve(__dirname,'..');const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');assert.equal(digest('public/strength/pose_landmarker_lite.task'),digest('modules/bloom-pose/ios/Resources/pose_landmarker_lite.task'));const pod=fs.readFileSync(path.join(root,'modules/bloom-pose/ios/BloomPose.podspec'),'utf8');assert.match(pod,/'Resources\/pose_landmarker_lite.task'/);assert.doesNotMatch(pod,/resource_bundles.*\.\.\//);});
