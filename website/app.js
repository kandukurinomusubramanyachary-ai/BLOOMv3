(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const hasMotion = () => !reducedQuery.matches && !!window.gsap;
  const ease = 'power3.out';
  let lenis = null;
  let motionContext = null;
  let lenisTick = null;
  let dialogOpener = null;
  const journal = {energy: null, symptoms: new Set(['Cramps'])};
  let checkinSaved = false;
  const energyNames = {low: 'a little low', steady: 'steady', good: 'feeling good'};
  const symptomNames = {Cramps: 'mild cramps', Tiredness: 'tiredness', Bloating: 'bloating', 'Nothing to add': 'nothing to add'};

  function updateJournal() {
    checkinSaved = false;
    $$('[data-energy]').forEach(button => {
      const selected = button.dataset.energy === journal.energy;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    });
    $$('[data-hero-mood]').forEach(button => {
      const selected = button.dataset.heroMood === journal.energy;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    });
    $$('[data-symptom]').forEach(button => {
      const selected = journal.symptoms.has(button.dataset.symptom);
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
      $('span', button).textContent = selected ? '✓' : '+';
    });
    const messages = {
      low: ['A little low is a valid place to be.', 'Some days ask for a softer pace.', 'You can notice how you feel without having to change it right away.'],
      steady: ['Every feeling belongs here.', 'You don’t have to earn your rest.', 'A slower day is still your day. There’s no perfect score to chase here.'],
      good: ['Make room for the good days, too.', 'Let a good day be a good day.', 'There’s room to enjoy today without expecting tomorrow to feel exactly the same.']
    };
    const message = messages[journal.energy || 'steady'];
    if ($('#hero-feedback')) $('#hero-feedback').textContent = message[0];
    if ($('#gentle-title')) $('#gentle-title').textContent = message[1];
    if ($('#gentle-copy')) $('#gentle-copy').textContent = message[2];
    const symptoms = [...journal.symptoms].map(name => symptomNames[name]).join(', ') || 'none selected';
    if ($('#doctor-summary')) $('#doctor-summary').textContent = `Energy: ${energyNames[journal.energy] || 'not yet selected'}. Symptoms: ${symptoms}.`;
    const y = {low:180, steady:105, good:30}[journal.energy] || 105;
    if ($('#latest-dot')) $('#latest-dot').setAttribute('cy', y);
    if ($('.chart-line')) $('.chart-line').setAttribute('d', `M65 105 145 30 225 105 305 180 385 105 465 180 545 ${y}`);
    if ($('#chart-desc')) $('#chart-desc').textContent = `Seven fictional energy entries. The last entry is ${energyNames[journal.energy]}, reflecting your sample selection.`;
    if ($('#save-checkin')) $('#save-checkin').innerHTML = 'Save a sample check-in <svg class="icon"><use href="#i-check"/></svg>';
    if ($('#save-status')) {$('#save-status').textContent = 'Just a preview. Nothing is stored or sent.'; $('#save-status').className='save-status'; $('#save-status').setAttribute('role','status');}
    if ($('#copy-status')) $('#copy-status').textContent = '';
  }

  function switchTab(name, focus = false) {
    const tab = $(`[data-tab="${name}"]`);
    if (!tab) return;
    $$('[data-tab]').forEach(button => {
      const active = button === tab;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $$('.demo-panel').forEach(panel => {panel.hidden = panel.id !== `panel-${name}`;});
    const panel = $(`#panel-${name}`);
    if (hasMotion()) gsap.fromTo(panel, {y:8}, {y:0,duration:.42,ease,overwrite:true,clearProps:'transform,opacity'});
    if (focus) tab.focus();
    window.ScrollTrigger?.refresh();
  }
  $$('[data-tab]').forEach((button,index,tabs) => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault(); switchTab(tabs[next].dataset.tab, true);
    });
  });
  $$('[data-energy], [data-hero-mood]').forEach(button => button.addEventListener('click', () => {
    journal.energy = button.dataset.energy || button.dataset.heroMood;
    updateJournal();
    if (hasMotion()) gsap.fromTo(button, {scale:.94}, {scale:1,duration:.35,ease,clearProps:'transform'});
  }));
  $$('[data-symptom]').forEach(button => button.addEventListener('click', () => {
    const name = button.dataset.symptom;
    if (journal.symptoms.has(name)) journal.symptoms.delete(name);
    else {
      if (name === 'Nothing to add') journal.symptoms.clear();
      else journal.symptoms.delete('Nothing to add');
      journal.symptoms.add(name);
    }
    updateJournal();
  }));
  $('#save-checkin')?.addEventListener('click', () => {
    if(checkinSaved){switchTab('patterns',true);return;}
    if(!journal.energy){$('#save-status').textContent='Choose how your energy feels to complete this sample.';$('#save-status').className='save-status is-error';$('#save-status').setAttribute('role','alert');$('[data-energy="low"]').focus();return;}
    checkinSaved = true;
    $('#save-checkin').innerHTML = 'See your pattern <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>';
    $('#save-status').textContent = 'Sample check-in complete. Nothing was stored or sent.';
    $('#save-status').className = 'save-status is-success';
  });
  $('#pattern-to-note')?.addEventListener('click', () => switchTab('note',true));
  $('#reset-demo')?.addEventListener('click', async () => {
    const confirmed = await window.BloomUI?.confirmReset($('#reset-demo'));
    if(!confirmed)return;
    journal.energy = null; journal.symptoms = new Set(['Cramps']); updateJournal(); switchTab('today');
    $('#save-status').textContent = 'Preview reset. Nothing was stored or sent.';
  });
  $('#copy-note')?.addEventListener('click', async () => {
    const note = `BLOOM SAMPLE NOTE\nFictional demonstration, not medical advice.\n\nFor my next doctor conversation\n${$('#doctor-summary').textContent}\n\nIn the fictional entries, low energy and cramps sometimes appear together. I’d like help understanding what to track next.\n\nA question to ask: What changes in my symptoms or bleeding should prompt a follow-up?`;
    try {
      if (window.isSecureContext && navigator.clipboard) await navigator.clipboard.writeText(note);
      else {
        const field = document.createElement('textarea');
        field.value = note; field.setAttribute('aria-label','Sample note to copy');
        Object.assign(field.style,{position:'fixed',left:'-9999px',top:'0'});
        document.body.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove(); $('#copy-note').focus();
        if(!copied)throw new Error('Copy not available');
      }
      $('#copy-status').textContent = 'Sample note copied.';
    }
    catch { $('#copy-status').textContent = 'Copy unavailable. You can select the note text instead.'; }
  });
  $('#print-note')?.addEventListener('click', () => { document.body.classList.add('printing-note'); window.print(); });
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-note'));

  const menu = $('#mobile-menu'); const menuToggle = $('.menu-toggle');
  function closeMenu(restoreFocus = false) {
    if (!menu || menu.hidden) return;
    menu.hidden = true; menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','Open navigation');
    if (restoreFocus) menuToggle.focus();
  }
  menuToggle?.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {closeMenu(); return;}
    menu.hidden = false; menuToggle.setAttribute('aria-expanded','true'); menuToggle.setAttribute('aria-label','Close navigation');
    if (hasMotion()) gsap.fromTo(menu, {y:-8}, {y:0,duration:.35,ease,clearProps:'transform,opacity'});
    $('a',menu)?.focus();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu && !menu.hidden) {event.preventDefault(); closeMenu(true);}
    if (event.key === 'Tab' && menu && !menu.hidden) {
      const stops = [menuToggle,...$$('a,button',menu)];
      const first = stops[0], last = stops[stops.length-1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    }
  });
  document.addEventListener('click', event => {
    if (menu && !menu.hidden && !menu.contains(event.target) && !menuToggle?.contains(event.target)) closeMenu();
    const anchor = event.target.closest('a[href^="#"]');
    if (anchor) {
      const target = document.getElementById(anchor.getAttribute('href').slice(1));
      if (target) {event.preventDefault(); closeMenu(); if(lenis)lenis.scrollTo(target,{offset:-125}); else target.scrollIntoView({behavior:reducedQuery.matches?'instant':'smooth'}); history.replaceState(null,'',anchor.getAttribute('href')); target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
    }
  });
  matchMedia('(min-width: 651px)').addEventListener('change', event => {if(event.matches)closeMenu();});

  function showDialog(dialog, trigger) {
    if (!dialog) return;
    closeMenu(); dialogOpener = trigger; dialog.showModal(); lenis?.stop();
    document.body.style.overflow = 'hidden';
    if (hasMotion()) gsap.fromTo(dialog, {y:18,scale:.98}, {y:0,scale:1,duration:.4,ease,clearProps:'transform,opacity'});
  }
  window.BloomCore = {showDialog};
  $$('.bloom-dialog').forEach(dialog => {
    $('.dialog-close',dialog)?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {if(document.querySelector('dialog[open]'))return;document.body.style.overflow='';lenis?.start();dialogOpener?.focus();});
  });
  $$('[data-join]').forEach(button => button.addEventListener('click', () => showDialog($('#join-dialog'),button)));
  $$('[data-policy]').forEach(button => button.addEventListener('click', () => {
    const isPrivacy = button.dataset.policy === 'privacy';
    $('#policy-title').textContent = isPrivacy ? 'Your story belongs to you.' : 'A companion, not a clinician.';
    $('#policy-content').innerHTML = isPrivacy
      ? '<p>Your sample check-in stays in this page’s memory. It is not sent to a server or stored between visits. Search queries and feedback drafts are also kept on the page.</p><p>Essential storage remembers your theme and cookie choice. Optional campaign attribution is only kept after you allow it and is passed to the existing signup site when you continue there. You can change your cookie choices at any time.</p><p>Feedback is only passed to GitHub when you open its draft link. Review it before posting; GitHub issues are public. The waitlist link opens the existing Bloom site, where its own signup questions and consent apply.</p>'
      : '<p>Bloom is designed to help you organize your own observations. It does not provide diagnosis, treatment, or fertility predictions, and it cannot tell you what is causing a symptom.</p><p>The example patterns and doctor note are fictional demonstrations. A qualified healthcare professional should guide decisions about symptoms and care.</p>';
    showDialog($('#policy-dialog'),button);
  }));

  function initMotion() {
    motionContext?.revert(); motionContext=null;
    if(lenisTick){window.gsap?.ticker.remove(lenisTick);lenisTick=null;}
    lenis?.destroy(); lenis=null;
    if(!hasMotion())return;
    gsap.registerPlugin(ScrollTrigger);
    if (window.Lenis && matchMedia('(hover: hover) and (pointer: fine)').matches) {
      lenis = new Lenis({lerp:.12,anchors:false,smoothWheel:true,autoRaf:false});
      lenis.on('scroll',ScrollTrigger.update);
      lenisTick = time => lenis.raf(time*1000); gsap.ticker.add(lenisTick); gsap.ticker.lagSmoothing(0);
    }
    motionContext = gsap.context(() => {
      // Visible HTML is the baseline. Motion starts only after the local engine loads.
      const intro = gsap.timeline({defaults:{ease}});
      intro.from('.availability',{y:8,duration:.6},0)
        .from('.hero h1',{y:16,duration:.8},.04)
        .from('.hero-after, .hero-description, .hero-actions, .quiet-note',{y:12,stagger:.055,duration:.65},.12)
        .from('.journal-card',{y:22,duration:.9},.05)
        .from('.floating-checkin',{y:30,duration:.9},.22);
      if ($('.petal-group')) gsap.to('.petal-group',{rotation:18,transformOrigin:'50% 50%',ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
      $$('.care-list article').forEach(article => gsap.from(article,{x:16,duration:.6,ease,scrollTrigger:{trigger:article,start:'top 95%',once:true}}));
      if($('.story-image')) gsap.from('.story-image',{clipPath:'inset(7% 0 0 0 round 160px 160px 20px 20px)',duration:.9,ease,scrollTrigger:{trigger:'.story-image',start:'top 90%',once:true}});
    });
    document.fonts?.ready.then(() => window.ScrollTrigger?.refresh());
  }
  reducedQuery.addEventListener('change',initMotion);
  initMotion();
  window.addEventListener('pagehide', () => {motionContext?.revert();if(lenisTick)window.gsap?.ticker.remove(lenisTick);lenis?.destroy();});
})();
