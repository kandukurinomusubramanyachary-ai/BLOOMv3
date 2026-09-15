// Local browser integration check. Uses synthetic camera/pose/speech fixtures;
// it never accesses a physical camera and cannot certify audible phone speech.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function installFixtures() {
  localStorage.setItem('@bloom_user:v1:dev-user:bloom_settings', JSON.stringify({theme:'dark'}));
  const fixture = window.strengthFixture = { mode:'full', width:640, height:480, speech:[], overlap:0, active:null, arcs:[], tracks:[] };
  fixture.points = () => {
    const points = Array.from({length:33},(_,id)=>({id,x:.5,y:.15,visibility:1,presence:1}));
    for (const [id,x,y] of [[0,.5,.12],[11,.49,.3],[12,.51,.3],[13,.48,.43],[14,.52,.43],[15,.47,.54],[16,.53,.54],[23,.49,.55],[24,.51,.55],[25,.49,.72],[26,.51,.72],[27,.49,.87],[28,.51,.87],[29,.48,.89],[30,.52,.89],[31,.46,.9],[32,.54,.9]]) points[id]={...points[id],x,y};
    if (fixture.mode==='far' || fixture.mode==='close') {
      const scale=fixture.mode==='far'?.5:1.2;
      points.forEach(p=>{p.x=.5+(p.x-.5)*scale;p.y=.5+(p.y-.5)*scale;});
    }
    if (fixture.mode==='partial') { points[27].y=1.1; points[28].y=1.1; }
    if (fixture.mode==='confidence') { points[11].presence=.1; points[12].presence=.1; }
    if (fixture.mode==='edge') points.forEach(p=>p.x-=.32);
    return points;
  };
  const originalArc=CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc=function(...args){
    if (this.canvas.getAttribute('aria-hidden')==='true') {
      fixture.arcs.push(args.slice(0,3)); fixture.arcs=fixture.arcs.slice(-13);
    }
    return originalArc.apply(this,args);
  };
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
    const canvas=document.createElement('canvas'); canvas.width=fixture.width;canvas.height=fixture.height;
    const ctx=canvas.getContext('2d');
    const paint=()=>{
      canvas.width=fixture.width;canvas.height=fixture.height;
      ctx.fillStyle='#55545B';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle='#343139';ctx.fillRect(0,canvas.height*.92,canvas.width,canvas.height*.08);
      const points=fixture.points();
      ctx.strokeStyle='#B9BCC5';ctx.lineWidth=18;ctx.lineCap='round';
      for(const [a,b] of [[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28]]) {
        ctx.beginPath();ctx.moveTo(points[a].x*canvas.width,points[a].y*canvas.height);ctx.lineTo(points[b].x*canvas.width,points[b].y*canvas.height);ctx.stroke();
      }
      ctx.fillStyle='#D5C4B7';ctx.beginPath();ctx.arc(points[0].x*canvas.width,points[0].y*canvas.height,16,0,Math.PI*2);ctx.fill();
    };
    paint(); const timer=setInterval(paint,40); const stream=canvas.captureStream(24);
    for(const track of stream.getTracks()) {
      fixture.tracks.push(track);
      const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};
    }
    return stream;
  }});
  window.Vision={FilesetResolver:{forVisionTasks:async()=>({})},PoseLandmarker:{createFromOptions:async()=>({
    detectForVideo:()=>({landmarks:[fixture.points()],close(){}}),close(){},
  })}};
  const synth=new EventTarget();
  synth.getVoices=()=>[{lang:'en-IN',name:'Test voice',default:true}];
  synth.speak=utterance=>{
    if(fixture.active)fixture.overlap++;
    fixture.active=utterance;
    fixture.speech.push({text:utterance.text,gesture:navigator.userActivation.isActive});
    setTimeout(()=>{if(fixture.active===utterance){fixture.active=null;utterance.onend?.();}},300);
  };
  synth.cancel=()=>{fixture.active=null;};synth.resume=()=>{};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(text){this.text=text;}}});
}

async function enter(page, guided=false) {
  await page.goto(process.env.BLOOM_PREVIEW_URL || 'http://localhost:8090',{waitUntil:'commit',timeout:30000});
  await page.getByRole('tab',{name:'Strength',exact:true}).click({timeout:60000});
  await page.getByRole('button',{name:'View today’s workout',exact:true}).click();
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('button',{name:guided?'Continue guided':'Enable camera',exact:true}).click();
}

async function reachable(page, name) {
  const box=await page.getByRole('button',{name,exact:true}).boundingBox();
  const viewport=page.viewportSize();
  assert.ok(box && box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width+1 && box.y+box.height<=viewport.height+1,`${name} within ${viewport.width}x${viewport.height}`);
  assert.ok(box.height>=44,`${name} touch target`);
}

async function main() {
  const output=path.join(os.tmpdir(),'bloom-strength-mobile');fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({channel:process.env.BLOOM_BROWSER_CHANNEL || 'msedge',headless:true});
  const results=[];
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
    await context.addInitScript(installFixtures);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await enter(page);
    await page.getByRole('button',{name:'Start exercise',exact:true}).waitFor({timeout:15000});
    assert.ok(await page.evaluate(()=>strengthFixture.speech.some(cue=>cue.gesture)), 'voice starts from camera user action');
    for(const [mode,copy] of [['far','Come a little closer.'],['close','Step back a little.'],['partial','Step back so I can see both feet.'],['confidence','I need a clearer view.'],['edge','Move slightly']]) {
      await page.evaluate(mode=>strengthFixture.mode=mode,mode);
      await page.getByText(copy,{exact:false}).waitFor({timeout:7000});
      assert.equal(await page.getByRole('button',{name:'Start exercise',exact:true}).count(),0,'invalid framing cannot start');
    }
    await page.evaluate(()=>strengthFixture.mode='full');
    await page.getByRole('button',{name:'Start exercise',exact:true}).click({timeout:7000});
    await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:7000});
    for(const width of [360,375,390,412,430]) for(const landscape of [false,true]) {
      const viewport=landscape?{width:844,height:width}:{width,height:844};
      await page.setViewportSize(viewport);await page.waitForTimeout(250);
      const geometry=await page.evaluate(()=>{
        const video=document.querySelector('video');const canvas=document.querySelector('canvas[aria-hidden="true"]');
        const v=video.getBoundingClientRect(),c=canvas.getBoundingClientRect();
        const styles=getComputedStyle(video);const scale=Math.min(v.width/video.videoWidth,v.height/video.videoHeight);
        const nose=strengthFixture.arcs[0];const p=strengthFixture.points()[0];
        const expectedX=v.width-((v.width-video.videoWidth*scale)/2+p.x*video.videoWidth*scale);
        const expectedY=(v.height-video.videoHeight*scale)/2+p.y*video.videoHeight*scale;
        return {same:Math.abs(v.width-c.width)<.1&&Math.abs(v.height-c.height)<.1&&Math.abs(v.x-c.x)<.1&&Math.abs(v.y-c.y)<.1,
          overflow:document.documentElement.scrollWidth>innerWidth,fit:styles.objectFit,mirror:styles.transform,
          aligned:nose&&Math.abs(nose[0]-expectedX)<1&&Math.abs(nose[1]-expectedY)<1,
          retina:canvas.width===Math.round(c.width*Math.min(3,devicePixelRatio)),cameraBottom:v.bottom};
      });
      assert.equal(geometry.same,true);assert.equal(geometry.overflow,false);assert.equal(geometry.fit,'contain');assert.equal(geometry.aligned,true);assert.equal(geometry.retina,true);
      assert.match(geometry.mirror,/-1/);await reachable(page,'Pause');await reachable(page,'Mute');
      results.push({viewport,...geometry});
      if(width===390)await page.screenshot({path:path.join(output,landscape?'landscape.png':'portrait.png')});
    }
    // Source rotation, independently from CSS viewport rotation.
    await page.evaluate(()=>{strengthFixture.width=480;strengthFixture.height=640;});
    await page.getByRole('button',{name:'Start exercise',exact:true}).waitFor({timeout:10000});
    await page.getByRole('button',{name:'Start exercise',exact:true}).click();
    await page.getByRole('button',{name:'Pause',exact:true}).waitFor({timeout:7000});
    await page.getByRole('button',{name:'Mute',exact:true}).click();
    const mutedCount=await page.evaluate(()=>strengthFixture.speech.length);
    await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(350);
    assert.equal(await page.evaluate(()=>strengthFixture.speech.length),mutedCount);
    await page.getByRole('button',{name:'Unmute',exact:true}).click();
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    assert.ok(await page.evaluate(()=>strengthFixture.speech.some(cue=>/Resum|Continue|starting position/i.test(cue.text))));
    assert.equal(await page.evaluate(()=>strengthFixture.overlap),0);
    await page.getByRole('button',{name:'Finish and save session',exact:true}).click();
    await page.getByRole('button',{name:/Next exercise|Next movement|Done/i}).first().waitFor({timeout:10000});
    assert.equal(await page.evaluate(()=>strengthFixture.tracks.every(track=>track.readyState==='ended')),true);

    await enter(page,true);
    await page.getByRole('button',{name:'Start exercise',exact:true}).click();
    await page.waitForTimeout(3500);
    assert.ok(await page.evaluate(()=>strengthFixture.speech.some(cue=>/begin in three/.test(cue.text)&&cue.gesture)));
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.getByRole('button',{name:'End exercise',exact:true}).click();
    await page.getByRole('button',{name:'Leave exercise',exact:true}).click();
    assert.equal(await page.evaluate(()=>strengthFixture.active),null);
    assert.equal(await page.evaluate(()=>strengthFixture.overlap),0);
    await page.getByRole('tab',{name:'Timeline',exact:true}).click();
    assert.equal(await page.evaluate(()=>strengthFixture.active),null);
    assert.deepEqual(errors,[]);
    await context.close();

    const unsupported=await browser.newContext({viewport:{width:375,height:812}});
    await unsupported.addInitScript(installFixtures);
    await unsupported.addInitScript(()=>{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});});
    const silent=await unsupported.newPage();await enter(silent,true);
    await silent.getByRole('button',{name:'Start exercise',exact:true}).click();
    await silent.getByRole('button',{name:'Pause',exact:true}).waitFor();
    assert.equal(await silent.getByRole('button',{name:'Mute',exact:true}).count(),0);
    await unsupported.close();
    console.log(JSON.stringify({status:'PASS',fixtures:'Synthetic camera, landmarks and speech; no physical-phone or audible-speech certification',results,screenshots:output},null,2));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
