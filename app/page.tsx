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

export default function Home() {
  const [view,setView] = useState('tracker');
  const [contributions,setContributions] = useState<Contribution[]>([]);
  const [selectedPrompt,setSelectedPrompt] = useState<PromptId>('message');
  const [name,setName] = useState(''); const [message,setMessage] = useState('');
  const [notice,setNotice] = useState(''); const [submitting,setSubmitting] = useState(false);
  const [mobileNav,setMobileNav] = useState(false); const [filter,setFilter] = useState('all');
  const [search,setSearch] = useState(''); const [expanded,setExpanded] = useState<string[]>([]);
  const [now,setNow] = useState(Date.now());

  useEffect(() => { const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t); },[]);
  useEffect(() => { document.documentElement.dataset.theme='dark'; },[]);
  const loadContributions = useCallback(async () => {
    if (!supabase) {
      try { const local=JSON.parse(localStorage.getItem('one-light-day-contributions')||'[]') as Contribution[]; setContributions(local.sort((a,b)=>b.created_at.localeCompare(a.created_at))); } catch { setContributions([]); }
      return;
    }
    const { data,error } = await supabase.from('contributions').select('*').order('created_at',{ascending:false}).limit(200);
    if (!error && data) { setContributions(data as Contribution[]); }
  },[]);
  useEffect(() => { loadContributions(); if(!supabase) return; const channel=supabase.channel('contribution-feed').on('postgres_changes',{event:'INSERT',schema:'public',table:'contributions'},payload=>setContributions(prev=>[payload.new as Contribution,...prev].slice(0,200))).subscribe(); return ()=>{supabase.removeChannel(channel);}; },[loadContributions]);

  const estimatedDistance = Math.min(TARGET_KM, REFERENCE_DISTANCE_KM + Math.max(0,(now-REFERENCE_AT)/1000)*SPEED_KM_S);
  const lightSeconds = estimatedDistance / LIGHT_SPEED_KM_S;
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
    if(localStorage.getItem('one-light-day-submitted')==='yes') { setNotice('A transmission has already been sent from this browser.'); return; }
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
    localStorage.setItem('one-light-day-submitted','yes'); setName(''); setMessage(''); setNotice('TRANSMISSION RECEIVED — added to the archive.'); setSubmitting(false);
  };
  const pageTitle = nav.find(n=>n.id===view)?.label || 'Voyager tracker';

  return <main className="app-shell">
    <header className="topbar">
      <button className="mobile-menu icon-button" onClick={()=>setMobileNav(!mobileNav)} aria-label="Toggle navigation">{mobileNav?<X size={17}/>:<Menu size={17}/>}</button>
      <button className="brand-lockup" onClick={()=>setView('tracker')}><span className="brand-mark"><Orbit size={22}/></span><span><strong>ONE LIGHT-DAY</strong><small>VOYAGER MISSION EXPLORER</small></span></button>
      <div className="top-divider"/><div className="top-spacer"/><span className="top-society">ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span>
    </header>

    <div className={`workspace ${view==='tracker'?'tracker-workspace':'standard-workspace'}`}>
      <aside className={`sidebar ${mobileNav?'sidebar-open':''}`}>
        <div className="side-heading">EXPLORE</div>
        <div className="nav-list">{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-item ${view===item.id?'active':''}`} onClick={()=>{setView(item.id);setMobileNav(false);}}><Icon size={16}/><span>{item.label}</span><small>{item.tag}</small></button>;})}</div>
        <div className="side-rule"/><div className="side-heading">VOYAGER 1</div>
        <div className="sidebar-fact"><span>LAUNCH DATE</span><b>05 SEP 1977</b></div><div className="sidebar-fact"><span>INTERSTELLAR ENTRY</span><b>AUG 2012</b></div>
        <div className="sidebar-bottom"><p>A message from Earth. A journey beyond.</p></div>
      </aside>

      <section className="main-column">
        <div className="page-heading"><div><div className="eyebrow">MISSION CONTROL <span>/</span> {pageTitle.toUpperCase()}</div><h1>{view==='tracker'?'Voyager 1 tracker':view==='send'?'Send a transmission':view==='archive'?'Transmissions from Earth':'Voyager mission history'}</h1></div><div className="heading-actions"><span className="utc-clock">{new Date(now).toISOString().slice(11,19)} UTC</span><button className="square-button" onClick={()=>loadContributions()} title="Refresh archive"><RefreshCw size={15}/></button></div></div>

        {view==='tracker' && <>
          <section className="panel spacecraft-panel"><div className="panel-head"><div><span className="panel-index">01</span><h2>VOYAGER 1 · SPACECRAFT VIEW</h2></div><span className="panel-tag">DRAG TO EXPLORE</span></div><div className="scene-wrap"><VoyagerScene/><div className="scene-caption"><span>VOYAGER 1</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div></div><div className="scene-foot"><span><i className="legend-dot gold"/> SPACECRAFT MODEL</span><span><i className="legend-dot line"/> ORBITAL REFERENCE RINGS</span><button className="send-cta" onClick={()=>setView('send')}>SEND A TRANSMISSION <Send size={14}/></button></div></section>
          <section className="panel facts-panel"><div className="panel-head"><div><span className="panel-index">02</span><h2>MISSION FACTS & DISTANCE</h2></div><span className="panel-tag">APPROXIMATE VALUES</span></div><div className="facts-grid">
            <Fact label="DISTANCE FROM EARTH" value={`${(estimatedDistance/1e9).toFixed(3)} billion`} unit="km" note="Approximate distance estimate"/><Fact label="ONE-WAY LIGHT TIME" value={`${(lightSeconds/3600).toFixed(2)} hours`} unit="" note="Radio signal travel time"/><Fact label="TIME SINCE LAUNCH" value={`${Math.floor(missionDays/365.25)} years`} unit="" note={`${Math.floor(missionDays%365.25)} days elapsed`}/><Fact label="TO ONE LIGHT-DAY" value={`${Math.max(0,daysToLightDay).toFixed(1)} days`} unit="estimated" note={`${fmt(remainingKm)} km remaining`}/>
          </div><div className="facts-foot"><span>REFERENCE TARGET <b>25,902,068,356 KM</b></span><span>CRUISE SPEED <b>≈ 61,200 KM/H</b></span><span>NOT LIVE NASA TELEMETRY</span></div></section>
          <section className="panel history-strip"><div className="panel-head"><div><span className="panel-index">03</span><h2>KEY MISSION MILESTONES</h2></div><button className="text-action" onClick={()=>setView('timeline')}>FULL MISSION HISTORY <ChevronRight size={14}/></button></div><div className="milestone-row">{[{year:'1977',label:'Launch'},{year:'1979',label:'Jupiter flyby'},{year:'1980',label:'Saturn flyby'},{year:'1990',label:'Pale Blue Dot'},{year:'2012',label:'Interstellar space'},{year:'2026',label:'One light-day'}].map(x=><div className="milestone" key={x.year}><b>{x.year}</b><span>{x.label}</span></div>)}</div></section>
        </>}

        {view==='send' && <section className="panel send-panel"><div className="panel-head"><div><span className="panel-index">04</span><h2>YOUR MESSAGE TO THE UNKNOWN</h2></div><span className="panel-tag">ONE ENTRY · +10 MIN</span></div><div className="send-intro"><strong>What would you send from Earth?</strong><span>Choose a prompt. Leave a message. Add your voice to our collective record.</span></div><form className="submission-form" onSubmit={submit}>
          <label className="field-label">CHOOSE A PROMPT<select value={selectedPrompt} onChange={e=>setSelectedPrompt(e.target.value as PromptId)}>{prompts.map(p=><option key={p.id} value={p.id}>{p.number} · {p.title}</option>)}</select></label>
          <div className="selected-question"><span>THE QUESTION</span><p>{activePrompt.question}</p></div>
          <div className="form-row"><label className="field-label">YOUR NAME<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} placeholder="Name or callsign" required/></label><label className="field-label">YOUR MESSAGE <span>{message.length}/300</span><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} rows={4} placeholder="A thought from Earth…" required/></label></div>
          <div className="form-bottom"><span>One transmission per browser · Keep it thoughtful.</span><button className="primary-button" type="submit" disabled={submitting}>{submitting?'SENDING…':'SEND TRANSMISSION'} <Send size={15}/></button></div>{notice&&<div className={`form-notice ${notice.startsWith('TRANSMISSION')?'success':''}`}>{notice}</div>}
        </form></section>}

        {view==='archive' && <section className="panel content-panel"><div className="panel-head"><div><span className="panel-index">05</span><h2>TRANSMISSIONS FROM EARTH</h2></div><span className="panel-tag">{contributions.length} ENTRIES</span></div><div className="archive-toolbar"><label className="search-box"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search names or messages…"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">ALL PROMPTS</option>{prompts.map(p=><option key={p.id} value={p.id}>{p.title.toUpperCase()}</option>)}</select></div><div className="transmission-list">{filtered.length===0?<div className="empty-state">NO MATCHING TRANSMISSIONS.</div>:filtered.map((item,i)=>{const p=prompts.find(x=>x.id===item.prompt_id);const isLong=item.message.length>145;const isExpanded=expanded.includes(item.id);return <article className="transmission" key={item.id}><div className="profile-avatar">{item.name.trim().slice(0,2).toUpperCase()}</div><div className="transmission-body"><div className="signal-number">TRANSMISSION {String(contributions.length-i).padStart(4,'0')}</div><div className="transmission-meta"><span>{p?.title||'EARTH TRANSMISSION'}</span><time>{new Date(item.created_at).toLocaleString()}</time></div><p className={!isExpanded&&isLong?'clamped':''}>“{item.message}”</p>{isLong&&<button className="expand-message" onClick={()=>setExpanded(prev=>isExpanded?prev.filter(x=>x!==item.id):[...prev,item.id])}>{isExpanded?'SHOW LESS':'READ FULL MESSAGE'}</button>}<strong>— {item.name}</strong></div><span className="signal-credit">+10 MIN</span></article>;})}</div></section>}

        {view==='timeline' && <section className="panel content-panel"><div className="panel-head"><div><span className="panel-index">06</span><h2>VOYAGER 1 · MISSION HISTORY</h2></div><span className="panel-tag">1977 — PRESENT</span></div><div className="timeline-summary"><strong>A journey measured in decades — and now in light-days.</strong><span>Key events, spacecraft facts and the milestones behind the distance.</span></div><div className="timeline">{[{year:'1977',title:'Launch',desc:'Voyager 1 launched on 5 September from Cape Canaveral, beginning its journey through the outer Solar System.'},{year:'1979',title:'Jupiter flyby',desc:'Returned detailed observations of Jupiter, its atmosphere, rings and moons.'},{year:'1980',title:'Saturn flyby',desc:'Explored Saturn and its moon Titan before heading outwards from the planetary region.'},{year:'1990',title:'The Pale Blue Dot',desc:'Turned its camera back toward home and captured Earth as a tiny point of light.'},{year:'2012',title:'Interstellar space',desc:'Voyager 1 became the first human-made object to enter interstellar space.'},{year:'2026',title:'One light-day milestone',desc:'At approximately 25.9 billion kilometres, a radio signal takes about 24 hours to travel one way.'}].map((item,i)=><div className="timeline-item" key={item.year}><div className="timeline-marker">{String(i+1).padStart(2,'0')}</div><div><span>{item.year}</span><h3>{item.title}</h3><p>{item.desc}</p></div></div>)}</div><div className="timeline-facts"><Fact label="LAUNCH DATE" value="05 Sep 1977" unit="" note="Cape Canaveral, Florida"/><Fact label="INTERSTELLAR ENTRY" value="August 2012" unit="" note="Beyond the heliosphere"/><Fact label="REFERENCE SPEED" value="≈ 61,200" unit="km/h" note="Approximate cruise speed"/></div></section>}
        <footer className="main-footer"><span>ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span><span>A MESSAGE FROM EARTH</span></footer>
      </section>

      <aside className="collective-rail"><div className="collective-sticky"><div className="rail-kicker">ASPS · PEC</div><div className="rail-title">OUR COLLECTIVE JOURNEY</div><p className="rail-copy">A shared effort by students at PEC, inspired by Voyager 1's journey.</p><div className="rail-number">{collectivePct.toFixed(1)}%</div><div className="rail-label">OF OUR ONE LIGHT-DAY GOAL</div><div className="rail-progress"><span style={{width:`${collectivePct}%`}}/></div><div className="rail-progress-meta"><span>{fmt(collectiveMinutes)} MINUTES CONTRIBUTED</span><span>24 HOURS</span></div><div className="rail-stats"><div><b>{contributions.length}</b><span>MESSAGES</span></div><div><b>{Math.max(0,144-contributions.length)}</b><span>TO GOAL</span></div></div><button className="rail-cta" onClick={()=>setView('send')}>ADD YOUR TRANSMISSION <Send size={15}/></button><div className="rail-note">Each message adds 10 minutes to our shared symbolic journey.</div><div className="rail-recent"><div className="rail-recent-head">LATEST SIGNALS <button onClick={()=>setView('archive')}>VIEW ALL <ArrowUpRight size={12}/></button></div>{contributions.slice(0,3).map((c,i)=><div className="rail-person" key={c.id}><span className="mini-avatar">{c.name.trim().slice(0,1).toUpperCase()}</span><b>{c.name}</b><small>+10 MIN</small></div>)}</div></div></aside>
    </div>
  </main>;
}
function Fact({label,value,unit,note}:{label:string;value:string;unit:string;note:string}) { return <div className="fact"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>; }
