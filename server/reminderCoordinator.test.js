const test=require('node:test'),assert=require('node:assert/strict');
const {createReminderCoordinator}=require('../src/services/reminderCoordinatorCore');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(){
  const schedules=new Map(),calls=[];let permission=true,fail=false,gate=null;
  const adapter={async getScheduledReminders(){return [...schedules.values()];},async cancelReminder(id){schedules.delete(id);calls.push(['cancel',id]);},async getPermissionStatus(){return {granted:permission};},async requestPermission(){return {granted:permission};},async setupAndroidChannel(){},async scheduleReminder(id,title,body,hour,minute,repeats,weekday){if(gate){const g=gate;gate=null;await g.promise;}if(fail){fail=false;throw new Error('schedule failed');}const item={identifier:id,hour,minute,weekday};schedules.set(id,item);calls.push(['schedule',id]);return id;}};
  const water={async reconcileWaterReminders(value){return {...value,notificationIds:[]};}};
  const coordinator=createReminderCoordinator({adapter,water});
  return {coordinator,schedules,calls,setPermission(v){permission=v;},failNext(){fail=true;},hold(){gate=deferred();return gate;}};
}
const settings=()=>({reminders:{checkin:{enabled:true,time:'20:00'},weekly:{enabled:true,time:'09:00',day:0}},waterReminders:{enabled:false}});
test('startup and foreground reconciliation are idempotent, use local wall time and cancel legacy IDs only',async()=>{
  const f=fixture();f.schedules.set('checkin',{identifier:'checkin'});f.schedules.set('unrelated',{identifier:'unrelated'});await f.coordinator.setOwner('alice');await f.coordinator.reconcile('alice',settings());await f.coordinator.reconcile('alice',settings());
  assert.equal(f.schedules.size,3);assert.equal(f.schedules.get('bloom-reminder-checkin').hour,20);assert.equal(f.schedules.get('bloom-reminder-weekly').weekday,1);assert.ok(f.schedules.has('unrelated'));assert.ok(!f.schedules.has('checkin'));
  await f.coordinator.stop();assert.deepEqual([...f.schedules.keys()],['unrelated']);
});
test('in-flight schedules cannot survive logout or switch and cannot save old-account preferences',async()=>{
  const f=fixture();await f.coordinator.setOwner('alice');const held=f.hold();let saved=false;
  const update=f.coordinator.update('alice',settings(),settings(),async()=>{saved=true;});await new Promise(r=>setImmediate(r));const switchOwner=f.coordinator.setOwner('bob');held.resolve();await assert.rejects(update,{code:'account_changed'});await switchOwner;assert.equal(saved,false);assert.equal(f.schedules.size,0);
  await f.coordinator.reconcile('bob',settings());await f.coordinator.stop();assert.equal(f.schedules.size,0);
});
test('permission denial preserves preferences and clears obsolete schedules without claiming successful activation',async()=>{
  const f=fixture();await f.coordinator.setOwner('alice');await f.coordinator.reconcile('alice',settings());f.setPermission(false);let saved=false;
  await assert.rejects(f.coordinator.update('alice',settings(),settings(),()=>{saved=true;},{requestPermission:true}),{code:'permission'});assert.equal(saved,false);assert.equal(f.schedules.size,0);
});
test('schedule and settings-write failures restore the previous effective schedule',async()=>{
  const f=fixture();await f.coordinator.setOwner('alice');await f.coordinator.reconcile('alice',settings());const next=settings();next.reminders.checkin.time='21:30';f.failNext();let saved=false;
  await assert.rejects(f.coordinator.update('alice',next,settings(),()=>{saved=true;}),/schedule failed/);assert.equal(saved,false);assert.equal(f.schedules.get('bloom-reminder-checkin').hour,20);
  await assert.rejects(f.coordinator.update('alice',next,settings(),()=>{throw new Error('disk failed');}),/disk failed/);assert.equal(f.schedules.get('bloom-reminder-checkin').hour,20);
});
test('invalid weekly days and time formats fail before preferences can be saved',async()=>{
  const f=fixture();await f.coordinator.setOwner('alice');for(const change of [s=>s.reminders.weekly.day=8,s=>s.reminders.checkin.time='99:00']){const next=settings();change(next);await assert.rejects(f.coordinator.update('alice',next,settings(),()=>assert.fail('must not save')));}
});

test('cold logged-out startup clears schedules left by a previous process',async()=>{const f=fixture();f.schedules.set('bloom-reminder-checkin',{identifier:'bloom-reminder-checkin'});await f.coordinator.setOwner(null);assert.equal(f.schedules.size,0);});
