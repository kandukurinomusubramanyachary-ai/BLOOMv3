/* Run with node bloom-analytics/validate.js; no dependencies or live data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(`${__dirname}/index.html`, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1, 'Only the legitimate dashboard script is allowed');
new vm.Script(scripts[0][1]);
const context = vm.createContext({ console });
// Evaluate the actual model/query functions, excluding browser rendering/bindings.
vm.runInContext(scripts[0][1].split('function deltaHtml')[0], context);
vm.runInContext(`globalThis.api={buildPopulation,uPlatformMode,activationMetrics,retention,customRangeUpdate,buildDataset,state,iso,dayDate,WINDOW};`, context);
const a = context.api;
const telemetry = new Set(['st_camera_permission_granted','st_camera_permission_denied','st_pose_success','st_pose_failure','st_camera_error']);
const counts = {};
for (const seed of [20260900, 1, 42, 123456]) {
  const users = a.buildPopulation(seed);
  assert.equal(JSON.stringify(users), JSON.stringify(a.buildPopulation(seed)), 'Fixtures must be deterministic');
  for (const u of users) for (const [index, event] of u.events.entries()) {
    if (telemetry.has(event.t)) {
      assert.equal(u.platform, 'web', 'Camera/pose events belong only to web');
      assert(u.events.slice(0,index).some(e=>e.t==='st_start'&&e.d===event.d&&e.h===event.h), 'Telemetry requires an earlier Strength camera attempt');
    }
  }
  for (const platform of ['android','ios','web']) {
    const sessions = users.filter(u=>u.platform===platform).flatMap(u=>u.events.filter(e=>e.t==='st_start').map(start=>u.events.filter(e=>e.d===start.d&&e.h===start.h&&e.t.startsWith('st_'))));
    assert(sessions.length, `${platform} must have Strength sessions`);
    const count = type => sessions.filter(es=>es.some(e=>e.t===type)).length;
    if (platform !== 'web') {
      assert(count('st_guided_entered')>0);
      assert.equal(count('st_tracked_entered'),0, `${platform} tracked mode is forbidden`);
      assert.equal(count('st_fallback'),0);
      assert(!users.filter(u=>u.platform===platform).some(u=>u.events.some(e=>(telemetry.has(e.t)||['POSE_INIT_FAILED','CAMERA_START_FAILED'].includes(e.code)))), `${platform} camera/pose telemetry is forbidden`);
    } else {
      for(const t of ['st_tracked_entered','st_fallback',...telemetry]) assert(count(t)>0, `Web fixture must exercise ${t}`);
    }
    for (const es of sessions) {
      const has = t=>es.some(e=>e.t===t);
      const position = t=>es.findIndex(e=>e.t===t);
      assert.equal(es.filter(e=>['st_guided_entered','st_tracked_entered'].includes(e.t)).length,1);
      if(has('st_tracked_entered')) {
        assert.equal(platform,'web');
        assert(has('st_camera_permission_granted')&&has('st_pose_success'));
        assert(position('st_pose_success')<position('st_tracked_entered'));
        assert(!has('st_fallback'));
      }
      if(has('st_pose_success')||has('st_pose_failure')||has('st_camera_error')) assert(position('st_camera_permission_granted')>=0);
      const failures=['st_camera_permission_denied','st_pose_failure','st_camera_error'].filter(has);
      if(has('st_fallback')) {
        assert.equal(platform,'web'); assert.equal(failures.length,1);
        assert(has('st_guided_entered')); assert(!has('st_tracked_entered')); assert(!has('st_pose_success'));
        assert(position(failures[0])<position('st_fallback'));
        assert(position('st_fallback')<position('st_guided_entered'));
      }
      if(failures.length) assert(has('st_fallback'));
      if(has('st_camera_permission_denied')) assert(!has('st_camera_permission_granted'));
    }
    if(seed===20260900) counts[platform]={sessions:sessions.length,tracked:count('st_tracked_entered'),guided:count('st_guided_entered'),fallback:count('st_fallback'),cameraPoseEvents:sessions.flat().filter(e=>telemetry.has(e.t)).length};
  }
}
for(const p of ['android','ios']) for(const r of [0,0.58,0.72,0.999999]) assert.equal(a.uPlatformMode(p,()=>r),'guided');
const user=(signup,offsets)=>({signupDay:signup,events:offsets.map(d=>({d:signup+d,t:'ci_done'})),openDays:new Set([signup,...offsets.map(d=>signup+d)])});
for(const [offsets,expected] of [[[0],0],[[0,1],1],[[0,7],1],[[0,8],0],[[1],0]]) assert.equal(a.activationMetrics([user(0,offsets)],0,120).engaged7Users,expected);
assert.equal(a.activationMetrics([user(120,[0])],0,120).engaged7,null);
const ret=a.retention([user(0,[0,1,7,30]),user(0,[0,2,8,31]),user(120,[0])],0,120);
for(const key of ['d1','d7','d30']) { assert.equal(ret.n[key],2); assert.equal(ret.nums[key],1); }
assert.equal(ret.nums.within7,2);
const range=a.customRangeUpdate(a.state,a.iso(a.dayDate(30)),a.iso(a.dayDate(40)));
assert(range.ok); assert.equal(range.next.customStartDay,30); assert.equal(range.next.customEndDay,40);
assert.equal(a.state.range,'d30');
assert(!/review_prompt|review_launch|review_complete|cdn-cgi|challenge-platform|__CF\$cv/.test(html));
assert(html.includes('Bug reporters (unique)'));
assert(!html.match(/<style>([\s\S]*?)<\/style>/)[1].includes('\\n'));
console.table(counts);
console.log('PASS: deterministic Strength architecture (4 seeds), activation/engagement boundaries, mature retention, custom dates, source hygiene, and inline JavaScript syntax.');
