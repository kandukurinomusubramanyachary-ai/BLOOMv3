async function waitForLocalApp(origin) {
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{const r=await fetch(origin+'/status',{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}
  throw new Error('Local Expo server did not become ready.');
}
module.exports={waitForLocalApp};
