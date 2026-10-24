(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const open = (dialog, trigger) => window.BloomCore?.showDialog(dialog,trigger);
  const getStorage = key => {try{return localStorage.getItem(key)}catch{return null}};
  const putStorage = (key, value) => {try{localStorage.setItem(key,value)}catch{}};
  const removeStorage = key => {try{localStorage.removeItem(key)}catch{}};
  const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The approved PNG artwork is never tinted, stretched or inverted.
  function setTheme(theme, remember=false){
    document.documentElement.dataset.theme=theme;
    $$('[data-theme-toggle]').forEach(button=>{
      button.setAttribute('aria-pressed',String(theme==='dark'));
      button.setAttribute('aria-label',`Switch to ${theme==='dark'?'light':'dark'} mode`);
      $('use',button)?.setAttribute('href',theme==='dark'?'#i-sun':'#i-moon');
    });
    if(remember)putStorage('bloom_theme',theme);
    $('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#121113':'#fffefe');
  }
  setTheme(document.documentElement.dataset.theme||'light');
  $$('[data-theme-toggle]').forEach(button=>button.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true)));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',event=>{if(!getStorage('bloom_theme'))setTheme(event.matches?'dark':'light')});

  // Real pending asset work, without blocking the content or a fake progress counter.
  const loading=$('#asset-loading');
  if(loading){
    loading.hidden=false;
    const finish=()=>{loading.hidden=true};
    const limit=setTimeout(finish,2500);
    const images=$$('header img,.hero-stage img');
    Promise.allSettled([document.fonts?.ready,...images.map(image=>image.decode?.())]).then(()=>{clearTimeout(limit);finish()});
  }
  function updateProgress(){
    const max=document.documentElement.scrollHeight-innerHeight;
    document.documentElement.style.setProperty('--scroll-progress',max>0?String(Math.min(1,Math.max(0,scrollY/max))):'0');
    const top=$('#back-to-top');if(top)top.hidden=scrollY<600;
  }
  let progressPending=false;
  addEventListener('scroll',()=>{if(progressPending)return;progressPending=true;requestAnimationFrame(()=>{updateProgress();progressPending=false})},{passive:true});
  addEventListener('resize',updateProgress);
  if(window.ResizeObserver)new ResizeObserver(updateProgress).observe(document.body);
  updateProgress();
  $('#back-to-top')?.addEventListener('click',()=>{
    scrollTo({top:0,behavior:motion()?'smooth':'instant'});
    $('.brand')?.focus({preventScroll:true});
  });

  const params=new URLSearchParams(location.search);
  const campaignKeys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content'];
  const incoming=Object.fromEntries(campaignKeys.filter(key=>params.has(key)).map(key=>[key,params.get(key).replace(/[\u0000-\u001f<>]/g,'').slice(0,120)]));
  const readConsent=()=>document.cookie.split('; ').find(v=>v.startsWith('bloom_consent='))?.split('=')[1]||null;
  let attribution=null;
  function applyAttribution(allowed){
    if(!allowed){removeStorage('bloom_attribution');attribution=null;}
    else {
      let saved=null;try{saved=JSON.parse(getStorage('bloom_attribution'))}catch{}
      if(Object.keys(incoming).length) saved={values:incoming,expiresAt:Date.now()+30*86400000};
      if(saved?.expiresAt>Date.now()){attribution=saved.values;putStorage('bloom_attribution',JSON.stringify(saved));}
      else {removeStorage('bloom_attribution');attribution=null;}
    }
    const link=$('#join-dialog a.button');
    if(link){const url=new URL('https://bloom-nine-eta.vercel.app/');if(attribution)Object.entries(attribution).forEach(([key,value])=>url.searchParams.set(key,value));link.href=url.href;}
  }
  const banner=$('#cookie-banner');
  function bannerSize(){document.documentElement.style.setProperty('--consent-height',banner&&!banner.hidden?`${banner.getBoundingClientRect().height+24}px`:'0px')}
  function showBanner(){if(banner){banner.hidden=false;document.body.classList.add('has-consent-banner');bannerSize();}}
  function chooseCookies(choice){
    document.cookie=`bloom_consent=${choice}; Path=/; Max-Age=15552000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
    if(banner)banner.hidden=true;document.body.classList.remove('has-consent-banner');bannerSize();applyAttribution(choice==='campaign');
  }
  const choice=readConsent();applyAttribution(choice==='campaign');if(!choice)showBanner();
  $$('[data-cookie-choice]').forEach(button=>button.addEventListener('click',()=>chooseCookies(button.dataset.cookieChoice)));
  $$('[data-cookie-settings]').forEach(button=>button.addEventListener('click',()=>{showBanner();$('[data-cookie-choice="essential"]')?.focus()}));
  if(banner&&window.ResizeObserver)new ResizeObserver(bannerSize).observe(banner);

  // A local content index. Nothing is sent to an external search service.
  const index=[
    {title:'The Bloom way',text:'PCOS PCOD irregular cycles check-ins care without guilt',url:'/#care'},
    {title:'Try the sample journal',text:'Today energy mood symptoms cramps tiredness bloating sleep check-in',url:'/#demo'},
    {title:'Patterns and doctor notes',text:'Observations diary timeline symptom pattern doctor appointment report print copy',url:'/#demo'},
    {title:'Why Bloom Was Created',text:'story promise startup helplessness someone cared PCOD pain invisible care rare',url:'/story/'},
    {title:'Join the waitlist',text:'early access launch coming soon opening signup',action:'join'},
    {title:'About your privacy',text:'privacy data consent tracking cookies health private storage',action:'privacy'},
    {title:'Contact Bloom',text:'contact help questions feedback support issue GitHub',action:'contact'},
  ];
  fetch('/content/story-search.json').then(response=>response.ok?response.json():null).then(data=>{if(data?.text){index.find(entry=>entry.url==='/story/').text+=' '+data.text;if($('#search-dialog')?.open)search()}}).catch(()=>{});
  function search(){
    const query=$('#site-search').value.toLowerCase().trim().slice(0,160);
    const words=query.split(/\s+/).filter(Boolean);
    const results=index.filter(entry=>words.every(word=>(entry.title+' '+entry.text).toLowerCase().includes(word)));
    $('#search-results').replaceChildren();
    $('#search-count').textContent=results.length?`${results.length} ${results.length===1?'place':'places'} to explore`:'No match yet. Try “story”, “journal”, or “privacy”.';
    results.forEach(entry=>{
      const row=document.createElement('li');const target=document.createElement(entry.url?'a':'button');
      target.textContent=entry.title;target.className='search-result';
      if(entry.url)target.href=entry.url;
      else target.addEventListener('click',()=>{
        $('#search-dialog').close();
        if(entry.action==='join')$('[data-join]').click();
        else if(entry.action==='privacy')$('[data-policy="privacy"]').click();
        else $('[data-contact]').click();
      });
      row.append(target);$('#search-results').append(row);
    });
  }
  $$('[data-open-search]').forEach(button=>button.addEventListener('click',()=>{open($('#search-dialog'),button);search();$('#site-search').focus()}));
  $('#site-search')?.addEventListener('input',search);
  $('#site-search')?.addEventListener('keydown',event=>{if(event.key==='Enter'){$('.search-result')?.click();}});
  addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!$('dialog[open]'))$('[data-open-search]')?.click()}});
  $('#search-results')?.addEventListener('click',event=>{if(event.target.closest('a'))$('#search-dialog').close()});

  let resetResolve=null;
  window.BloomUI={confirmReset(trigger){return new Promise(resolve=>{resetResolve=resolve;open($('#confirm-dialog'),trigger)})}};
  $('#confirm-reset')?.addEventListener('click',()=>{const resolve=resetResolve;resetResolve=null;$('#confirm-dialog').close();resolve?.(true)});
  $('#cancel-reset')?.addEventListener('click',()=>$('#confirm-dialog').close());
  $('#confirm-dialog')?.addEventListener('close',()=>{resetResolve?.(false);resetResolve=null});

  $$('[data-contact]').forEach(button=>button.addEventListener('click',()=>open($('#contact-dialog'),button)));
  let feedbackDraft='';
  $('#contact-form')?.addEventListener('submit',event=>{
    event.preventDefault();
    const subject=$('#contact-subject'),message=$('#contact-message');
    const invalidSubject=subject.value.trim().length<3,invalidMessage=message.value.trim().length<10;
    subject.setAttribute('aria-invalid',String(invalidSubject));message.setAttribute('aria-invalid',String(invalidMessage));
    if(invalidSubject||invalidMessage){$('#contact-error').textContent=invalidSubject?'Add a subject with at least 3 characters.':'Write at least 10 characters so the team can understand your feedback.';(invalidSubject?subject:message).focus();return;}
    $('#contact-error').textContent='';feedbackDraft=`${subject.value.trim()}\n\n${message.value.trim()}`;
    const url=new URL('https://github.com/kandukurinomusubramanyachary-ai/BLOOMv3/issues/new');
    url.searchParams.set('title',subject.value.trim());url.searchParams.set('body',message.value.trim()+'\n\nSubmitted from the Bloom website feedback draft.');
    $('#feedback-link').href=url.href;$('#contact-form').hidden=true;$('#contact-success').hidden=false;
    $('#contact-success h3').tabIndex=-1;$('#contact-success h3').focus();
  });
  $('#edit-feedback')?.addEventListener('click',()=>{$('#contact-form').hidden=false;$('#contact-success').hidden=true;$('#contact-subject').focus()});
  $('#copy-feedback')?.addEventListener('click',async()=>{
    try{
      if(isSecureContext&&navigator.clipboard)await navigator.clipboard.writeText(feedbackDraft);
      else{const area=document.createElement('textarea');area.value=feedbackDraft;area.style.cssText='position:fixed;left:-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();$('#copy-feedback').focus();if(!ok)throw new Error();}
      $('#feedback-status').textContent='Draft copied. Nothing has been posted.';
    }catch{$('#feedback-status').textContent='Copy is unavailable. You can return to the message fields and select the text.';}
  });
})();
