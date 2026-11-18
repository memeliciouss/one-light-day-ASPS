'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Activity, ArrowUpRight, Clock3, Menu, RadioTower, RefreshCw, Satellite, Search, Send, X, Orbit, ChevronRight } from 'lucide-react';
import { Contribution, prompts, PromptId } from '@/lib/prompts';
import { supabase } from '@/lib/supabase';
const VoyagerScene = dynamic(() => import('@/components/VoyagerScene'), { ssr:false, loading: () => <div className="scene-loading">LOADING NASA SPACECRAFT MODEL…</div> });

const TARGET_KM = 25_902_068_356;
const REFERENCE_DISTANCE_KM = 25_870_000_000;
const REFERENCE_AT = new Date('2026-11-17T00:00:00Z').getTime();
const SPEED_KM_S = 17.0;
const LIGHT_SPEED_KM_S = 299_792.458;
const LAUNCH_AT = new Date('1977-09-05T12:56:00Z').getTime();
const fmt = (n:number) => new Intl.NumberFormat('en-IN').format(Math.round(n));
const formatIST = (value:string|number|Date, options:Intl.DateTimeFormatOptions = {}) => new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',...options}).format(new Date(value));

export default function Home() {
  const [view,setView] = useState('tracker');
  const [contributions,setContributions] = useState<Contribution[]>([]);
  const [selectedPrompt,setSelectedPrompt] = useState<PromptId>('message');
  const [name,setName] = useState(''); const [message,setMessage] = useState('');
  const [notice,setNotice] = useState(''); const [submitting,setSubmitting] = useState(false);
  const [mobileNav,setMobileNav] = useState(false); const [filter,setFilter] = useState('all');
  const [search,setSearch] = useState(''); const [expanded,setExpanded] = useState<string[]>([]);
  const [now,setNow] = useState(Date.now());
  const [cooldownUntil,setCooldownUntil] = useState(0);
  const COOLDOWN_MS = 6 * 60 * 60 * 1000;

  useEffect(() => { const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t); },[]);
  useEffect(() => { document.documentElement.dataset.theme='dark'; const saved=Number(localStorage.getItem('one-light-day-cooldown-until')||0); if(saved>Date.now()) setCooldownUntil(saved); },[]);
  const loadContributions = useCallback(async () => {
    if (!supabase) {
      try { const local=JSON.parse(localStorage.getItem('one-light-day-contributions')||'[]') as Contribution[]; setContributions(local.sort((a,b)=>b.created_at.localeCompare(a.created_at))); } catch { setContributions([]); }
      return;
    }
    const { data,error } = await supabase.from('contributions').select('*').order('created_at',{ascending:false}).limit(200);
    if (!error && data) { setContributions(data as Contribution[]); }
  },[]);
  useEffect(() => { loadContributions(); const client=supabase; if(!client) return; const channel=client.channel('contribution-feed').on('postgres_changes',{event:'INSERT',schema:'public',table:'contributions'},payload=>setContributions(prev=>[payload.new as Contribution,...prev].slice(0,200))).on('postgres_changes',{event:'DELETE',schema:'public',table:'contributions'},payload=>setContributions(prev=>prev.filter(item=>item.id!==String((payload.old as {id?:string}).id)))).subscribe(); return ()=>{client.removeChannel(channel);}; },[loadContributions]);

  const estimatedDistance = Math.min(TARGET_KM, REFERENCE_DISTANCE_KM + Math.max(0,(now-REFERENCE_AT)/1000)*SPEED_KM_S);
  const lightSeconds = estimatedDistance / LIGHT_SPEED_KM_S;
  const voyagerAU = estimatedDistance / 149_597_870.7;
  const voyagerScalePct = Math.min(100, voyagerAU / 200 * 100);
  const nickelScaleKm = (estimatedDistance / 1_392_700) * 0.021;
  const remainingKm = Math.max(0,TARGET_KM-estimatedDistance);
  const daysToLightDay = remainingKm/(SPEED_KM_S*86400);
  const missionDays = (now-LAUNCH_AT)/86400000;
  const collectiveMinutes = contributions.length*10;
  const collectivePct = Math.min(100,collectiveMinutes/1440*100);
  const activePrompt = prompts.find(p=>p.id===selectedPrompt)!;
  const filtered = useMemo(()=>contributions.filter(c=>(filter==='all'||c.prompt_id===filter) && `${c.name} ${c.message}`.toLowerCase().includes(search.toLowerCase())),[contributions,filter,search]);
  const nav = [ {id:'tracker',label:'Voyager tracker',icon:Satellite,tag:'01'}, {id:'send',label:'Send a transmission',icon:Send,tag:'02'}, {id:'archive',label:'Transmission archive',icon:RadioTower,tag:'03'}, {id:'timeline',label:'Mission history',icon:Activity,tag:'04'} ];
  const submit = async (e:FormEvent) => {
    e.preventDefault(); setNotice('');
    const cleanName=name.trim(), cleanMessage=message.trim();
    if(!cleanName||!cleanMessage||cleanMessage.length>300) { setNotice('Enter your name and a message (max. 300 characters).'); return; }
    const nextAllowed=Number(localStorage.getItem('one-light-day-cooldown-until')||0); if(nextAllowed>Date.now()) { setCooldownUntil(nextAllowed); const hours=Math.ceil((nextAllowed-Date.now())/3600000); setNotice(`Your next transmission can be sent in about ${hours} hour${hours===1?'':'s'}.`); return; }
    setSubmitting(true);
    const entry={name:cleanName,prompt_id:selectedPrompt,message:cleanMessage};
    if(supabase) {
      const {error}=await supabase.from('contributions').insert(entry);
      if(error) { setNotice(`Could not send: ${error.message}`); setSubmitting(false); return; }
      await loadContributions();
    } else {
      const item:Contribution={...entry,id:`local-${Date.now()}`,created_at:new Date().toISOString()};
      const local=JSON.parse(localStorage.getItem('one-light-day-contributions')||'[]') as Contribution[];
      localStorage.setItem('one-light-day-contributions',JSON.stringify([item,...local])); setContributions(prev=>[item,...prev]);
    }
    const next=Date.now()+COOLDOWN_MS; localStorage.setItem('one-light-day-cooldown-until',String(next)); setCooldownUntil(next); setName(''); setMessage(''); setNotice('TRANSMISSION RECEIVED — added to the archive.'); setSubmitting(false);
  };
  const pageTitle = nav.find(n=>n.id===view)?.label || 'Voyager tracker';

  return <main className="app-shell">
    <header className="topbar">
      <button className="mobile-menu icon-button" onClick={()=>setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav?<X size={17}/>:<Menu size={17}/>}</button>
      <button className="brand-lockup" onClick={()=>setView('tracker')}><span className="brand-mark"><img src="/asps-logo.png" alt="ASPS"/></span><span><strong>ONE LIGHT-DAY</strong><small>VOYAGER MISSION EXPLORER</small></span></button>
      <div className="top-divider"/><div className="top-spacer"/><span className="top-society">ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span>
    </header>

    <div className={`workspace ${view==='tracker'?'tracker-workspace':'standard-workspace'}`}>
      <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
        <div className="side-heading">EXPLORE</div>
        <div className="nav-list">{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${view===item.id?'active':''}`} onClick={()=>{setView(item.id);setMobileNav(false);}}><Icon size={16}/><span>{item.label}</span><small>{item.tag}</small></button>;})}</div>
        <div className="side-rule"/><div className="side-heading">VOYAGER 1</div>
        <div className="sidebar-fact"><span>LAUNCH DATE</span><b>05 SEP 1977</b></div><div className="sidebar-fact"><span>INTERSTELLAR ENTRY</span><b>AUG 2012</b></div><div className="sidebar-collective"><span>OUR COLLECTIVE JOURNEY</span><strong>{collectivePct.toFixed(1)}%</strong><div className="sidebar-progress"><i style={{width:`${collectivePct}%`}}/></div><small>{contributions.length} messages · {fmt(collectiveMinutes)} min contributed</small></div>
        <div className="sidebar-bottom"><p>A message from Earth. A journey beyond.</p></div>
      </aside>

      <section className="main-column">
        <div className="page-heading"><div><div className="eyebrow">MISSION CONTROL <span>/</span> {pageTitle.toUpperCase()}</div><h1>{view==='tracker'?'Voyager 1 tracker':view==='send'?'Send a transmission':view==='archive'?'Transmissions from Earth':'Voyager mission history'}</h1></div><div className="heading-actions"><span className="utc-clock">{formatIST(now,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})} IST</span><button className="square-button" onClick={()=>loadContributions()} title="Refresh archive"><RefreshCw size={15}/></button></div></div>

        {view==='tracker' && <>
          <section className="tracker-intro"><p>Voyager 1 launched on 5 September 1977. It is now about <strong>25.9 billion kilometres</strong> from Earth. A radio signal takes roughly <strong>24 hours one way</strong> to reach it.</p></section><section className="panel spacecraft-panel"><div className="panel-head"><div><span className="panel-index">01</span><h2>VOYAGER 1 · SPACECRAFT VIEW</h2></div><span className="panel-tag">DRAG TO EXPLORE</span></div><div className="scene-wrap"><VoyagerScene/><div className="scene-caption"><span>VOYAGER 1</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div></div><div className="scene-foot"><span><i className="legend-dot gold"/> SPACECRAFT MODEL</span><span><i className="legend-dot line"/> ORBITAL REFERENCE RINGS</span><button className="send-cta" onClick={()=>setView('send')}>SEND A TRANSMISSION <Send size={14}/></button></div></section>
          <section className="panel facts-panel"><div className="panel-head"><div><span className="panel-index">02</span><h2>MISSION FACTS & DISTANCE</h2></div><span className="panel-tag">APPROXIMATE VALUES</span></div><div className="facts-grid">
            <Fact label="DISTANCE FROM EARTH" value={`${(estimatedDistance/1e9).toFixed(3)} billion`} unit="km" note="Approximate distance estimate"/><Fact label="ONE-WAY LIGHT TIME" value={`${(lightSeconds/3600).toFixed(2)} hours`} unit="" note="Radio signal travel time"/><Fact label="TIME SINCE LAUNCH" value={`${Math.floor(missionDays/365.25)} years`} unit="" note={`${Math.floor(missionDays%365.25)} days elapsed`}/><Fact label="TO ONE LIGHT-DAY" value={`${Math.max(0,daysToLightDay).toFixed(1)} days`} unit="estimated" note={`${fmt(remainingKm)} km remaining`}/>
          </div><div className="facts-foot"><span>REFERENCE TARGET <b>25,902,068,356 KM</b></span><span>CRUISE SPEED <b>≈ 61,200 KM/H</b></span><span>NOT LIVE NASA TELEMETRY</span></div></section>
          <section className="panel distance-panel distance-redesign">
<div className="panel-head"><div><span className="panel-index">03</span><h2>HOW FAR OUT IS VOYAGER 1?</h2></div><span className="panel-tag">A SCALE OF THE OUTER SOLAR SYSTEM</span></div>
<div className="distance-hero"><div><span className="distance-kicker">VOYAGER 1 · CURRENT ESTIMATE</span><strong>{voyagerAU.toFixed(1)} <small>AU</small></strong><p>About {fmt(estimatedDistance)} km from the Sun</p></div><div className="distance-light"><span>RADIO SIGNAL · ONE WAY</span><b>{(lightSeconds/3600).toFixed(2)} hours</b><small>Light takes this long to reach Voyager 1</small></div></div>
<div className="distance-chart-wrap"><div className="distance-chart-title"><div><span className="distance-kicker">THE OUTER SOLAR SYSTEM</span><h3>One shared scale · 0–200 AU</h3></div><span className="distance-scale-note">LINEAR SCALE</span></div>
<div className="distance-chart" role="img" aria-label={`Linear distance scale from the Sun to 200 astronomical units. Neptune at 30 AU, Kuiper Belt from 30 to 50 AU, Voyager 1 at ${voyagerAU.toFixed(1)} AU. The Oort Cloud is beyond this scale.`}>
<div className="distance-axis"><span>0 AU</span><span>50 AU</span><span>100 AU</span><span>150 AU</span><span>200 AU</span></div>
<div className="distance-track"><div className="distance-segment kuiper-segment"><span>KUIPER BELT</span></div><div className="distance-tick sun-tick"><i/><b>SUN</b></div><div className="distance-tick neptune-tick"><i/><b>NEPTUNE <small>30 AU</small></b></div><div className="distance-voyager-marker" style={{left:`${voyagerScalePct}%`}}><i/><b>VOYAGER 1</b><small>{voyagerAU.toFixed(1)} AU</small></div></div>
<div className="distance-beyond"><span>200 AU · CHART EDGE</span><span className="beyond-arrow">→</span><strong>INNER OORT CLOUD</strong><small>~2,000 AU · about 10× beyond this chart</small></div></div>
<div className="distance-legend"><span><i className="legend-sun"/> Sun</span><span><i className="legend-neptune"/> Neptune</span><span><i className="legend-kuiper"/> Kuiper Belt</span><span><i className="legend-voyager"/> Voyager 1</span><span><i className="legend-oort"/> Oort Cloud · off-scale</span></div></div>
<div className="distance-analogy"><span className="distance-kicker">PUT IT INTO PERSPECTIVE</span><h3>If the Sun were the size of a nickel…</h3><p>Imagine a Sun about 21 mm across. At that scale, Earth would be roughly <b>2.3 metres</b> away, Neptune about <b>68 metres</b>, and Voyager 1 around <b>{(nickelScaleKm*1000).toFixed(0)} metres</b> away.</p><div className="analogy-line"><span>21 mm SUN</span><i/><span>2.3 m EARTH</span><i/><span>68 m NEPTUNE</span><i className="analogy-long"/><b>~{nickelScaleKm.toFixed(2)} km VOYAGER 1</b></div><small>The inner Oort Cloud could begin around 4.5 km away in this same scale. These are illustrative distances, not a map to scale.</small></div>
<div className="distance-footnote">1 AU is the average Earth–Sun distance (about 149.6 million km). The Kuiper Belt and Oort Cloud boundaries are approximate; the Oort Cloud is not directly mapped as a sharp edge.</div></section>
<section className="panel history-strip"><div className="panel-head"><div><span className="panel-index">03</span><h2>KEY MISSION MILESTONES</h2></div><button className="text-action" onClick={()=>setView('timeline')}>FULL MISSION HISTORY <ChevronRight size={14}/></button></div><div className="milestone-row">{[{year:'1977',label:'Launch'},{year:'1979',label:'Jupiter flyby'},{year:'1980',label:'Saturn flyby'},{year:'1990',label:'Pale Blue Dot'},{year:'2012',label:'Interstellar space'},{year:'2026',label:'One light-day'}].map(x=><div className="milestone" key={x.year}><b>{x.year}</b><span>{x.label}</span></div>)}</div></section>
        </>}

        {view==='send' && <section className="panel send-panel"><div className="panel-head"><div><span className="panel-index">04</span><h2>YOUR MESSAGE TO THE UNKNOWN</h2></div><span className="panel-tag">SIX-HOUR COOLDOWN · +10 MIN</span></div><div className="send-intro"><strong>What would you send from Earth?</strong><span>Choose a prompt. Leave a message. Add your voice to our collective record.</span></div><form className="submission-form" onSubmit={submit}>
          <label className="field-label">CHOOSE A PROMPT<select value={selectedPrompt} onChange={e=>setSelectedPrompt(e.target.value as PromptId)}>{prompts.map(p=><option key={p.id} value={p.id}>{p.number} · {p.title}</option>)}</select></label>
          <div className="selected-question"><span>THE QUESTION</span><p>{activePrompt.question}</p></div>
          <div className="form-row"><label className="field-label">YOUR NAME<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Name or callsign" required/></label><label className="field-label">YOUR MESSAGE <span>{message.length}/300</span><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} rows={4} placeholder="A thought from Earth…" required/></label></div>
          <div className="form-bottom"><span>{cooldownUntil>now?`Next transmission in ${Math.ceil((cooldownUntil-now)/3600000)}h`:'One transmission every six hours per browser · Keep it thoughtful.'}</span><button className="primary-button" type="submit" disabled={submitting}>{submitting?'SENDING…':'SEND TRANSMISSION'} <Send size={15}/></button></div>{notice&&<div className={`form-notice ${notice.startsWith('TRANSMISSION')?'success':''}`}>{notice}</div>}
        </form></section>}

        {view==='archive' && <section className="panel content-panel"><div className="panel-head"><div><span className="panel-index">05</span><h2>TRANSMISSIONS FROM EARTH</h2></div><span className="panel-tag">{contributions.length} ENTRIES</span></div><div className="archive-toolbar"><label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names or messages…"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">ALL PROMPTS</option>{prompts.map(p=><option key={p.id} value={p.id}>{p.title.toUpperCase()}</option>)}</select></div><div className="transmission-list">{filtered.length===0?<div className="empty-state">NO MATCHING TRANSMISSIONS.</div>:filtered.map((item,i)=>{const p=prompts.find(x=>x.id===item.prompt_id);const isLong=item.message.length>145;const isExpanded=expanded.includes(item.id);return <article className="transmission" key={item.id}><div className="profile-avatar">{item.name.trim().slice(0,2).toUpperCase()}</div><div className="transmission-body"><div className="signal-number">TRANSMISSION {String(contributions.length-i).padStart(4,'0')}</div><div className="transmission-meta"><span>{p?.title||'EARTH TRANSMISSION'}</span><time>{formatIST(item.created_at,{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST</time></div><p className={!isExpanded&&isLong?'clamped':''}>“{item.message}”</p>{isLong&&<button className="expand-message" onClick={()=>setExpanded(prev=>isExpanded?prev.filter(x=>x!==item.id):[...prev,item.id])}>{isExpanded?'SHOW LESS':'READ FULL MESSAGE'}</button>}<strong>— {item.name}</strong></div><span className="signal-credit">+10 MIN</span></article>;})}</div></section>}

        {view==='timeline' && <section className="panel content-panel"><div className="panel-head"><div><span className="panel-index">06</span><h2>VOYAGER 1 · MISSION HISTORY</h2></div><span className="panel-tag">1977 — PRESENT</span></div><div className="timeline-summary"><strong>Voyager 1: from launch to interstellar space.</strong><span>The dates and discoveries that shaped the mission.</span></div><div className="timeline">{[{year:'1977',title:'Launch',desc:'Voyager 1 launched on 5 September from Cape Canaveral, beginning its journey through the outer Solar System.',image:'https://images-assets.nasa.gov/image/PIA17464/PIA17464~medium.jpg',credit:'NASA/JPL'},{year:'1979',title:'Jupiter flyby',desc:'Voyager 1 returned detailed observations of Jupiter, its atmosphere, rings and moons.',image:'https://images-assets.nasa.gov/image/PIA01371/PIA01371~medium.jpg',credit:'NASA/JPL'},{year:'1980',title:'Saturn flyby',desc:'Voyager 1 explored Saturn and its moon Titan before heading outwards from the planetary region.',image:'https://images-assets.nasa.gov/image/PIA01969/PIA01969~medium.jpg',credit:'NASA/JPL'},{year:'1990',title:'The Pale Blue Dot',desc:'Voyager 1 turned its camera back toward home and captured Earth as a tiny point of light.',image:'https://images-assets.nasa.gov/image/PIA00452/PIA00452~medium.jpg',credit:'NASA/JPL'},{year:'2012',title:'Interstellar space',desc:'Voyager 1 became the first human-made object to enter interstellar space.',image:'https://images-assets.nasa.gov/image/PIA17046/PIA17046~medium.jpg',credit:'NASA/JPL-Caltech'},{year:'2026',title:'One light-day milestone',desc:'At approximately 25.9 billion kilometres, a radio signal takes about 24 hours to travel one way.',image:'https://images-assets.nasa.gov/image/PIA23645/PIA23645~medium.jpg',credit:'NASA/JPL-Caltech'}].map((item,i)=><div className="timeline-item" key={item.year}><div className="timeline-marker">{String(i+1).padStart(2,'0')}</div><div className="timeline-copy"><span>{item.year}</span><h3>{item.title}</h3><p>{item.desc}</p><small>{item.credit}</small></div>{item.image&&<img className="timeline-image" src={item.image} alt={`${item.title} — Voyager 1 mission`} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src="https://images-assets.nasa.gov/image/PIA00452/PIA00452~medium.jpg";}}/>}</div>)}</div><div className="timeline-facts"><Fact label="LAUNCH DATE" value="05 Sep 1977" unit="" note="Cape Canaveral, Florida"/><Fact label="INTERSTELLAR ENTRY" value="August 2012" unit="" note="Beyond the heliosphere"/><Fact label="REFERENCE SPEED" value="≈ 61,200" unit="km/h" note="Approximate cruise speed"/></div></section>}
        <footer className="main-footer"><span>ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span><span>A MESSAGE FROM EARTH</span></footer>
      </section>

      <aside className="collective-rail"><div className="collective-sticky"><div className="rail-kicker">ASPS · PEC</div><div className="rail-title">OUR COLLECTIVE JOURNEY</div><p className="rail-copy">A shared effort by students at PEC, inspired by Voyager 1's journey.</p><div className="rail-number">{collectivePct.toFixed(1)}%</div><div className="rail-label">OF OUR ONE LIGHT-DAY GOAL</div><div className="rail-progress"><span style={{width:`${collectivePct}%`}}/></div><div className="rail-progress-meta"><span>{fmt(collectiveMinutes)} MINUTES CONTRIBUTED</span><span>24 HOURS</span></div><div className="rail-stats"><div><b>{contributions.length}</b><span>MESSAGES</span></div><div><b>{Math.max(0,144-contributions.length)}</b><span>TO GOAL</span></div></div><button className="rail-cta" onClick={()=>setView('send')}>ADD YOUR TRANSMISSION <Send size={15}/></button><div className="rail-note">Each message adds 10 minutes to our shared symbolic journey.</div><div className="rail-recent"><div className="rail-recent-head">LATEST SIGNALS <button onClick={()=>setView('archive')}>VIEW ALL <ArrowUpRight size={12}/></button></div>{contributions.slice(0,3).map((c,i)=><div className="rail-person" key={c.id}><span className="mini-avatar">{c.name.trim().slice(0,1).toUpperCase()}</span><b>{c.name}</b><small>+10 MIN</small></div>)}</div></div></aside>
    </div>
  </main>;
}
function Fact({label,value,unit,note}:{label:string;value:string;unit:string;note:string}) { return <div className="fact"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>; }
