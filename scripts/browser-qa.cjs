async function waitForLocalApp(origin) {
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{const r=await fetch(origin+'/status',{signal:AbortSignal.timeout(2000)});if(r.ok){
      const html=await (await fetch(origin,{signal:AbortSignal.timeout(10000)})).text();
      for(const match of html.matchAll(/<script[^>]*src="([^"]+)"/g)){
        const url=new URL(match[1].replaceAll('&amp;','&'),origin);
        if(url.origin===new URL(origin).origin){const bundle=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!bundle.ok)throw Error('Local bundle failed');await bundle.arrayBuffer();}
      }
      return;
    }}catch{}await new Promise(r=>setTimeout(r,500));}
  throw new Error('Local Expo server did not become ready.');
}
module.exports={waitForLocalApp};
