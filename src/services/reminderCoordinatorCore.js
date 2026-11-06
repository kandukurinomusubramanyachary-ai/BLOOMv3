const { REMINDER_CONFIGS, mergeReminders } = require('./reminderDefinitions');
const LEGACY_IDS = new Set(REMINDER_CONFIGS.map(item => item.key));
function isOwnedReminder(item) {
  const id=String(item?.identifier||'');
  return LEGACY_IDS.has(id)||id.startsWith('bloom-reminder-')||id.startsWith('bloom-water-reminders-');
}
function reminderTime(value) {
  const match=/^(\d{2}):(\d{2})$/.exec(String(value));
  if(!match || Number(match[1])>23 || Number(match[2])>59) throw new Error('Reminder time is invalid.');
  return match.slice(1).map(Number);
}
function createReminderCoordinator({adapter,water,platform='ios'}) {
  let owner=undefined,revision=0,tail=Promise.resolve();
  const enqueue=fn=>{const task=tail.catch(()=>undefined).then(fn);tail=task;return task;};
  const current=(uid,version)=>Boolean(uid&&uid===owner&&version===revision);
  const stale=()=>Object.assign(new Error('Your account changed. Reopen reminders.'),{code:'account_changed'});
  async function cancelOwned() { if(platform==='web')return; const items=await adapter.getScheduledReminders();for(const item of items.filter(isOwnedReminder))await adapter.cancelReminder(item.identifier); }
  async function apply(uid,settings,version,{requestPermission=false}={}) {
    if(!current(uid,version))throw stale();
    if(platform==='web')return settings;
    await cancelOwned();if(!current(uid,version))throw stale();
    const reminders=mergeReminders(settings.reminders);
    for(const item of Object.values(reminders)) reminderTime(item.time);
    const wantsAny=Object.values(reminders).some(item=>item.enabled)||settings.waterReminders?.enabled!==false;
    if(!wantsAny)return {...settings,reminders};
    const permission=await (requestPermission?adapter.requestPermission():adapter.getPermissionStatus());
    if(!current(uid,version))throw stale();
    if(!permission.granted) {
      if(requestPermission)throw Object.assign(new Error('Notifications are turned off for Bloom. Enable them in device settings to receive reminders.'),{code:'permission'});
      return {...settings,reminders};
    }
    await adapter.setupAndroidChannel();
    for(const config of REMINDER_CONFIGS) {
      if(!current(uid,version))throw stale();
      const reminder=reminders[config.key]; if(!reminder.enabled)continue;
      const [hour,minute]=reminderTime(reminder.time);
      const weekday=config.key==='weekly'?Number(reminder.day)+1:null;
      if(weekday!==null&&(!Number.isInteger(weekday)||weekday<1||weekday>7))throw new Error('Reminder weekday is invalid.');
      // DAILY/WEEKLY use device-local wall-clock time. Never convert to a fixed UTC offset.
      await adapter.scheduleReminder('bloom-reminder-'+config.key,config.title,config.body,hour,minute,true,weekday);
    }
    if(!current(uid,version))throw stale();
    const waterReminders=await water.reconcileWaterReminders(settings.waterReminders||{});
    if(!current(uid,version))throw stale();
    return {...settings,reminders,waterReminders};
  }
  return {
    setOwner(uid) {
      const next=uid||null;if(owner===next)return tail;
      owner=next;revision++;return enqueue(cancelOwned);
    },
    stop(){owner=null;revision++;return enqueue(cancelOwned);},
    reconcile(uid,settings) {const version=revision;return enqueue(async()=>{try{return await apply(uid,settings,version);}catch(error){await cancelOwned();throw error;}});},
    update(uid,next,previous,save,options={}) {
      const version=revision;
      return enqueue(async()=>{
        try {const scheduled=await apply(uid,next,version,options);if(!current(uid,version))throw stale();await save(scheduled);if(!current(uid,version))throw stale();return scheduled;}
        catch(error) {
          await cancelOwned();
          if(current(uid,version)) {try{await apply(uid,previous,version);}catch(restoreError){await cancelOwned();error.restorationFailed=true;}}
          throw error;
        }
      });
    },
    drain(){return tail;},
  };
}
module.exports={createReminderCoordinator,isOwnedReminder,reminderTime};
