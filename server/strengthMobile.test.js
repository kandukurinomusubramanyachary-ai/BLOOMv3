const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');
const { checkBodyFraming, requiredLandmarksVisible } = require('../src/features/strength/engine/bodyFraming');
const { createRepStateMachine } = require('../src/features/strength/engine/repStateMachine');
const { EXERCISES } = require('../src/features/strength/exercises');
const { createCoverTransform, mapNormalizedPoint } = require('../src/features/strength/engine/poseTransform');

function body() {
  const points = Array.from({ length: 33 }, (_, id) => ({ id, x: 0.5, y: 0.15, visibility: 1, presence: 1 }));
  for (const [id, x, y] of [[0,.5,.12],[11,.38,.3],[12,.62,.3],[13,.33,.44],[14,.67,.44],[15,.3,.54],[16,.7,.54],[23,.42,.55],[24,.58,.55],[25,.42,.73],[26,.58,.73],[27,.42,.88],[28,.58,.88],[29,.42,.88],[30,.58,.88],[31,.4,.9],[32,.6,.9]]) points[id] = { ...points[id], x, y };
  return points;
}

test('framing distinguishes a complete body, distance, cropped head/limbs and uncertain joints', () => {
  const full = body();
  assert.equal(checkBodyFraming(full, 'front-view').ok, true);
  const scaled = scale => full.map(p => ({ ...p, x:.5+(p.x-.5)*scale, y:.5+(p.y-.5)*scale }));
  assert.equal(checkBodyFraming(scaled(.5), 'front-view').reason, 'too_far');
  assert.equal(checkBodyFraming(scaled(1.2), 'front-view').reason, 'too_close');
  for (const [id, axis, value, expected] of [[0,'y',-.02,'head_out'],[15,'x',1.1,'body_out'],[27,'y',1.1,'feet_out'],[11,'presence',.2,'low_confidence'],[0,'visibility',NaN,'low_confidence']]) {
    const points = body(); points[id][axis] = value;
    assert.equal(checkBodyFraming(points, 'front-view').reason, expected);
  }
  assert.equal(checkBodyFraming([{x:NaN,y:NaN,visibility:1}], 'front-view').reason, 'no_pose');
});

test('side-view framing accepts an occluded far arm without accepting a missing visible side', () => {
  const points = body();
  for (const id of [11,12,23,24]) points[id].x = id % 2 ? .49 : .51;
  for (const id of [12,14,16,24,26]) points[id].presence = .2;
  assert.equal(checkBodyFraming(points, 'side-view').ok, true);
  points[15].presence = .2;
  assert.equal(checkBodyFraming(points, 'side-view').reason, 'low_confidence');
});

test('out-of-frame predictions and low presence use the existing tracking pause instead of counting', () => {
  for (const invalid of [{x:1.1}, {y:-.1}, {presence:.1}, {presence:NaN}]) {
    const landmarks = body(); Object.assign(landmarks[25], invalid);
    assert.equal(requiredLandmarksVisible(landmarks,[25]).ok,false);
    const engine = createRepStateMachine(EXERCISES[0],{activeSide:'left'});
    const events=[];
    for(let ts=0;ts<=2100;ts+=100) events.push(...engine.process({ts,landmarks,poseCount:1}).events);
    assert.ok(events.some(event=>event.type==='pauseRequested' && event.reason==='low_confidence'));
    assert.equal(engine.snapshot().reps,0);
  }
});

test('every key joint shares object-fit video geometry across phone sizes, rotation, source ratios and mirroring', () => {
  for (const width of [360,375,390,412,430]) for (const landscape of [false,true]) {
    const view = landscape ? {viewWidth:844,viewHeight:width} : {viewWidth:width,viewHeight:844};
    for (const [sourceWidth,sourceHeight] of [[640,480],[480,640],[1920,1080]]) for (const fit of ['contain','cover']) for (const mirrored of [false,true]) {
      const transform = createCoverTransform({sourceWidth,sourceHeight,...view,fit,mirrored});
      const scale = (fit === 'contain' ? Math.min : Math.max)(view.viewWidth/sourceWidth,view.viewHeight/sourceHeight);
      for (const point of body()) {
        const actual = mapNormalizedPoint(point,transform);
        const x = (view.viewWidth-sourceWidth*scale)/2 + point.x*sourceWidth*scale;
        assert.ok(Math.abs(actual.x-(mirrored?view.viewWidth-x:x))<1e-8);
        assert.ok(Math.abs(actual.y-((view.viewHeight-sourceHeight*scale)/2+point.y*sourceHeight*scale))<1e-8);
      }
    }
  }
});

// Execute the real overlay component with a canvas and lifecycle harness. No
// copied drawing implementation: verify resize without a new pose callback.
function overlayFixture(dpr) {
  const calls = [];
  let bounds = {width:333.3,height:251.7};
  const context = new Proxy({}, { get: (_,name) => (...args) => calls.push([name,...args]), set: () => true });
  const canvas = {width:0,height:0,getBoundingClientRect:()=>bounds,getContext:()=>context};
  const listeners = new Map(); const effects = []; let refIndex = 0; let observer;
  const react = { forwardRef:fn=>fn, useRef:()=>({current:refIndex++===0?canvas:null}), useEffect:fn=>effects.push(fn), useImperativeHandle:(ref,fn)=>Object.assign(ref,fn()) };
  const window = {devicePixelRatio:dpr,addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key),matchMedia:()=>({addEventListener(){},removeEventListener(){}})};
  class ResizeObserver { constructor(fn) { observer = this; this.callback = fn; } observe() {} disconnect() { this.disconnected = true; } }
  const filename = path.resolve(__dirname,'../src/features/strength/components/PoseOverlay.web.js');
  const transformed = babel.transformFileSync(filename,{babelrc:false,configFile:false,presets:[['babel-preset-expo',{lazyImports:false}]]});
  const mod = {exports:{}};
  const localRequire = request => request==='react' ? react : request.includes('utils/constants') ? {DARK_COLORS:{canvas:'#121113',ink:'#F7F4F5',accent:'#EE718B'}} : request.startsWith('.') ? require(path.resolve(path.dirname(filename),request)) : require(request);
  new Function('require','module','exports','window','ResizeObserver',transformed.code)(localRequire,mod,mod.exports,window,ResizeObserver);
  const ref = {}; mod.exports.default({},ref); const cleanup = effects.map(fn=>fn());
  return {canvas,calls,ref,listeners,resize:next=>{bounds=next;observer.callback();},cleanup:()=>cleanup.forEach(fn=>fn?.()),get observer(){return observer;}};
}

test('Retina overlay redraws on resize/rotation, includes the nose, and clears without reviving stale joints', () => {
  for (const dpr of [1,2,3]) {
    const f = overlayFixture(dpr);
    f.ref.draw({landmarks:body(),sourceWidth:640,sourceHeight:480,fit:'contain',mirrored:true});
    assert.equal(f.canvas.width,Math.round(333.3*dpr));
    assert.equal(f.calls.filter(call=>call[0]==='arc').length,13);
    f.calls.length=0;
    f.resize({width:601.2,height:197.4});
    assert.equal(f.canvas.width,Math.round(601.2*dpr));
    assert.equal(f.canvas.height,Math.round(197.4*dpr));
    assert.equal(f.calls.filter(call=>call[0]==='arc').length,13);
    f.calls.length=0; f.listeners.get('orientationchange')();
    assert.equal(f.calls.filter(call=>call[0]==='arc').length,13);
    f.ref.clear(); f.calls.length=0; f.resize({width:300,height:400});
    assert.equal(f.calls.filter(call=>call[0]==='arc').length,0);
    f.cleanup(); assert.equal(f.listeners.size,0); assert.equal(f.observer.disconnected,true);
  }
});
