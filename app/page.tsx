'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Activity, ArrowUpRight, Menu, MessageCircle, RadioTower, RefreshCw, Satellite, Search, Send, X } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { Contribution } from '@/lib/prompts';
import { supabase } from '@/lib/supabase';

const VoyagerScene = dynamic(() => import('@/components/VoyagerScene'), {
  ssr: false,
  loading: () => <div className="scene-loading">LOADING VOYAGER 1…</div>
});

const TARGET_KM = 25_902_068_356;
const REFERENCE_DISTANCE_KM = 25_870_000_000;
const REFERENCE_AT = new Date('2026-11-17T00:00:00Z').getTime();
const SPEED_KM_S = 17;
const LIGHT_SPEED_KM_S = 299_792.458;
const LAUNCH_AT = new Date('1977-09-05T12:56:00Z').getTime();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 7;
const LIGHT_TRAVEL_KM_PER_MESSAGE = LIGHT_SPEED_KM_S * 600;
const TARGET_MESSAGES = Math.ceil(TARGET_KM / LIGHT_TRAVEL_KM_PER_MESSAGE);
const fmt = (n: number) => new Intl.NumberFormat('en-IN').format(Math.round(n));
const formatIST = (value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
  new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...options }).format(new Date(value));
export default function Home() {
  const [view, setView] = useState('tracker');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [recordImageIndex, setRecordImageIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center', containScroll: false, slidesToScroll: 1 });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
  }, []);

  const loadContributions = useCallback(async () => {
    if (!supabase) {
      try {
        const local = JSON.parse(localStorage.getItem('one-light-day-contributions') || '[]') as Contribution[];
        setContributions([...new Map(local.map(item => [item.id, item])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      } catch {
        setContributions([]);
      }
      return;
    }
    const { data, error } = await supabase.from('contributions').select('*').order('created_at', { ascending: false });
    if (!error && data) setContributions([...new Map((data as Contribution[]).map(item => [item.id, item])).values()]);
  }, []);

  useEffect(() => {
    loadContributions();
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel('contribution-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'contributions' }, payload =>
        setContributions(prev => [...new Map([payload.new as Contribution, ...prev].map(item => [item.id, item])).values()])
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'contributions' }, payload =>
        setContributions(prev => prev.filter(item => item.id !== String((payload.old as { id?: string }).id)))
      )
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [loadContributions]);

  const estimatedDistance = Math.min(
    TARGET_KM,
    REFERENCE_DISTANCE_KM + Math.max(0, (now - REFERENCE_AT) / 1000) * SPEED_KM_S
  );
  const lightHours = estimatedDistance / LIGHT_SPEED_KM_S / 3600;
  const voyagerAU = estimatedDistance / 149_597_870.7;
  const missionDays = (now - LAUNCH_AT) / 86400000;
  const collectiveDistance = contributions.length * LIGHT_TRAVEL_KM_PER_MESSAGE;
  const collectivePct = Math.min(100, (collectiveDistance / TARGET_KM) * 100);
  const shuffledMessages = useMemo(() => {
    const stableHash = (value: string) => {
      let hash = 2166136261;
      for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
      return hash >>> 0;
    };
    return [...contributions].sort((a, b) =>
      stableHash(a.id + a.created_at) - stableHash(b.id + b.created_at)
    );
  }, [contributions]);
  useEffect(() => {
    if (!emblaApi) return;
    const syncSelected = () => setActiveMessageIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', syncSelected);
    syncSelected();
    return () => { emblaApi.off('select', syncSelected); };
  }, [emblaApi]);
  useEffect(() => {
    if (!emblaApi || shuffledMessages.length < 2) return;
    const autoplay = window.setInterval(() => emblaApi.scrollNext(), 3000);
    return () => window.clearInterval(autoplay);
  }, [emblaApi, shuffledMessages.length]);
  const activeMessage = shuffledMessages.length ? shuffledMessages[activeMessageIndex % shuffledMessages.length] : null;
  const filtered = useMemo(
    () => contributions.filter(c => (c.name + ' ' + c.message).toLowerCase().includes(search.toLowerCase())),
    [contributions, search]
  );
  const nav = [
    { id: 'tracker', label: 'Mission tracker', icon: Satellite },
    { id: 'dossier', label: 'Mission dossier', icon: Activity },
    { id: 'archive', label: 'Transmission archive', icon: RadioTower }
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice('');
    const cleanName = name.trim();
    const cleanMessage = message.trim();
    if (!cleanName || !cleanMessage || cleanMessage.length > 300) {
      setNotice('Please enter your name and a message of up to 300 characters.');
      return;
    }
    const nowMs = Date.now();
    const recentSends = (JSON.parse(localStorage.getItem('one-light-day-send-log') || '[]') as number[])
      .filter(timestamp => Number.isFinite(timestamp) && nowMs - timestamp < RATE_WINDOW_MS);
    if (recentSends.length >= MAX_MESSAGES_PER_WINDOW) {
      setNotice('Please try again a little later.');
      return;
    }

    setSubmitting(true);
    const entry = { name: cleanName, prompt_id: 'message', message: cleanMessage };
    if (supabase) {
      const { error } = await supabase.from('contributions').insert(entry);
      if (error) {
        setNotice('Could not send your transmission: ' + error.message);
        setSubmitting(false);
        return;
      }
      await loadContributions();
    } else {
      const item: Contribution = { ...entry, id: 'local-' + Date.now(), created_at: new Date().toISOString() };
      const local = JSON.parse(localStorage.getItem('one-light-day-contributions') || '[]') as Contribution[];
      localStorage.setItem('one-light-day-contributions', JSON.stringify([item, ...local]));
      setContributions(prev => [item, ...prev]);
    }

    localStorage.setItem('one-light-day-send-log', JSON.stringify([...recentSends, nowMs]));
    setName('');
    setMessage('');
    setNotice('TRANSMISSION RECEIVED — your message is now part of the archive.');
    setSubmitting(false);
  };

  const pageTitle = nav.find(item => item.id === view)?.label || 'Mission tracker';

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation">
          {mobileNav ? <X size={17} /> : <Menu size={17} />}
        </button>
        <button className="brand-lockup" onClick={() => setView('tracker')}>
          <span className="brand-mark"><img src="/asps-logo.png" alt="ASPS" /></span>
          <span><strong>ONE LIGHT-DAY</strong><small>VOYAGER MISSION EXPLORER</small></span>
        </button>
        <div className="top-divider" />
        <div className="top-spacer" />
        <span className="top-society">ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span>
      </header>

      <div className="workspace redesigned-workspace">
        <aside className={'sidebar ' + (mobileNav ? 'sidebar-open' : '')}>
          <div className="side-heading">EXPLORE</div>
          <div className="nav-list">
            {nav.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={'nav-item ' + (view === item.id ? 'active' : '')}
                  onClick={() => { setView(item.id); setMobileNav(false); }}>
                  <Icon size={16} /><span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="sidebar-bottom"><p>A message from Earth. A journey beyond.</p></div>
        </aside>

        <section className="main-column">
          <div className="page-heading">
            <div className="page-heading-copy">
              <div className="eyebrow">ONE LIGHT-DAY <span>/</span> {pageTitle.toUpperCase()}</div>
              <h1>{view === 'tracker' ? 'Voyager 1' : view === 'archive' ? 'Transmissions from Earth' : 'The mission behind the signal'}</h1>
              {view === 'tracker' && (
                <p className="mission-intro">
                  Launched in 1977, Voyager 1 has travelled farther than any other human-made object. On 18 November 2026, it reaches a remarkable milestone: one light-day from Earth. It still carries the Golden Record, a collection of sounds, music and greetings from our world.
                </p>
              )}
            </div>
            <div className="heading-actions">
              {view === 'tracker' ? (
                <>
                  <button className="heading-link-button" onClick={() => setView('dossier')}>MISSION DOSSIER <ArrowUpRight size={11} /></button>
                  <button className="heading-link-button" onClick={() => setView('archive')}>TRANSMISSION ARCHIVE <ArrowUpRight size={11} /></button>
                </>
              ) : (
                <button className="heading-link-button" onClick={() => setView('tracker')}>MISSION TRACKER <ArrowUpRight size={11} /></button>
              )}
              <span className="utc-clock">{formatIST(now, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST</span>
              <button className="square-button" onClick={loadContributions} title="Refresh transmissions"><RefreshCw size={15} /></button>
            </div>
          </div>

          {view === 'tracker' && (
            <div className="tracker-redesign">
              <div className="desktop-mission-layout">
              <section className="panel spacecraft-panel redesign-spacecraft">
                <div className="panel-head">
                  <div><span className="panel-index">01</span><h2>VOYAGER 1</h2></div>
                  <span className="panel-tag">INTERACTIVE MODEL</span>
                </div>
                <div className="scene-wrap"><VoyagerScene /></div>
                <div className="scene-foot redesign-scene-foot">
                  <span><i className="legend-dot gold" /> DRAG TO ROTATE</span>
                  <span>SCROLL TO ZOOM</span>
                </div>
              </section>

              <div className="mission-side-stack">
                <section className="panel journey-card">
                  <div className="panel-head">
                    <div><span className="panel-index">02</span><h2>OUR COLLECTIVE JOURNEY</h2></div>
                    <span className="panel-tag">{contributions.length} TRANSMISSIONS</span>
                  </div>
                  <div className="journey-progress-block">
                    <div className="progress-heading">
                      <div><span>OUR COMPILED DISTANCE</span><strong>{collectivePct.toFixed(1)}%</strong></div>
                      <small>{contributions.length} messages received</small>
                    </div>
                    <div className="collective-track signal-track"><span style={{ width: collectivePct + '%' }} /></div>
                    <div className="progress-foot">
                      <span>{fmt(collectiveDistance)} km represented</span>
                      <span>GOAL · {fmt(TARGET_KM)} km</span>
                    </div>
                  </div>
                  <div className="journey-progress-block voyager-reference">
                    <div className="progress-heading">
                      <div><span>VOYAGER 1 · CURRENT DISTANCE</span></div>
                      <small>{fmt(estimatedDistance)} km from the Sun</small>
                    </div>
                    <div className="collective-track voyager-track icon-track"><span style={{ width: '100%' }} />
                      <i className="distance-marker sun-marker" style={{ left: '0%' }} title="The Sun" aria-label="The Sun" />
                      <i className="distance-marker uranus-marker" style={{ left: ((19.2 / voyagerAU) * 100) + '%' }} title="Uranus · 19.2 AU" aria-label="Uranus, 19.2 astronomical units" />
                      <i className="distance-marker neptune-marker" style={{ left: ((30.1 / voyagerAU) * 100) + '%' }} title="Neptune · 30.1 AU" aria-label="Neptune, 30.1 astronomical units" />
                      <i className="distance-marker kuiper-marker" style={{ left: ((50 / voyagerAU) * 100) + '%' }} title="Kuiper Belt · about 30–50 AU" aria-label="Kuiper Belt, about 30 to 50 astronomical units" />
                      <img className="voyager-track-icon" src="data:image/png;base64,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" alt="Voyager 1" /></div>
                    <div className="distance-marker-legend" aria-label="Distance scale landmarks">
                      <span><i className="legend-sun" />Sun</span>
                      <span><i className="legend-uranus" />Uranus</span>
                      <span><i className="legend-neptune" />Neptune</span>
                      <span><i className="legend-kuiper" />Kuiper Belt</span>
                    </div>
                    <div className="progress-foot">
                      <span>THE SUN</span>
                      <span>VOYAGER 1 · {voyagerAU.toFixed(1)} AU</span>
                    </div>
                  </div>
                  <p className="journey-explainer">Each message adds 10 minutes of light travel. Together, we're working towards one light-day.</p>
                </section>

                <section className="panel message-carousel-panel">                  <div className="message-carousel-section">
                    <div className="carousel-heading">
                      <span>MESSAGES FROM EARTH</span>
                      <button className="text-action" onClick={() => setView('archive')}>VIEW ARCHIVE <ArrowUpRight size={13} /></button>
                    </div>
                    {activeMessage ? (
                      <div className="message-carousel-stage" aria-label="Rotating messages from the transmission archive">
                        <div className="embla-viewport" ref={emblaRef}>
                          <div className="embla-container">
                            {shuffledMessages.map((item, index) => (
                              <div className="embla-slide" key={item.id}>
                                <article className="message-marquee-item message-featured">
                                  <div className="message-featured-top"><MessageCircle size={15} /><span>TRANSMISSION {String(index + 1).padStart(2, '0')} / {String(shuffledMessages.length).padStart(2, '0')}</span></div>
                                  <p>“{item.message}”</p>
                                  <span className="message-author">— {item.name}</span>
                                </article>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="message-carousel-dots" aria-hidden="true">{shuffledMessages.slice(0, Math.min(shuffledMessages.length, 8)).map((item, index) => <i key={item.id} className={index === activeMessageIndex % Math.min(shuffledMessages.length, 8) ? 'active' : ''} />)}</div>
                      </div>                    ) : (
                      <div className="carousel-empty">Your message could be the first one here.</div>
                    )}
                  </div></section>

              </div>
              </div>
              <section className="panel transmission-card transmission-full-row">
                <div className="panel-head">
                  <div><span className="panel-index">03</span><h2>SEND YOUR TRANSMISSION</h2></div>
                  <span className="panel-tag">1-HOUR COOLDOWN</span>
                </div>
                <form className="submission-form redesigned-form" onSubmit={submit}>
                  <div className="single-prompt"><span>YOUR QUESTION</span><p>What message would you like to send to Voyager 1?</p></div>
                  <div className="transmission-form-grid">
                    <label className="field-label">
                      <span className="field-label-title">YOUR NAME</span>
                      <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="Name or callsign" required />
                    </label>
                    <label className="field-label">
                      <span className="field-label-title"><span>YOUR MESSAGE</span><span className="field-count">{message.length}/300</span></span>
                      <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={300} rows={3} placeholder="Write your message…" required />
                    </label>
                  </div>
                  <div className="form-bottom redesigned-form-bottom">
                    <span />
                    <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'SENDING…' : 'SEND TRANSMISSION'} <Send size={15} /></button>
                  </div>
                  {notice && <div className={'form-notice ' + (notice.startsWith('TRANSMISSION') ? 'success' : '')}>{notice}</div>}
                </form>
              </section>
            </div>
          )}

          {view === 'archive' && (
            <section className="panel content-panel redesigned-archive">
              <div className="panel-head">
                <div><span className="panel-index">01</span><h2>TRANSMISSION ARCHIVE</h2></div>
                <span className="panel-tag">{contributions.length} MESSAGES</span>
              </div>
              <div className="archive-toolbar">
                <label className="search-box"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search names or messages…" /></label>
              </div>
              <div className="transmission-list">
                {filtered.length === 0 ? <div className="empty-state">NO MATCHING TRANSMISSIONS.</div> : filtered.map((item, index) => {
                  const isLong = item.message.length > 145;
                  const isExpanded = expanded.includes(item.id);
                  return (
                    <article className="transmission" key={item.id}>
                      <div className="profile-avatar"><MessageCircle size={17} strokeWidth={1.8} /></div>
                      <div className="transmission-body">
                        <div className="signal-number">TRANSMISSION {String(contributions.length - index).padStart(4, '0')}</div>
                        <div className="transmission-meta">
                          <time>{formatIST(item.created_at, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} IST</time>
                        </div>
                        <p className={!isExpanded && isLong ? 'clamped' : ''}>“{item.message}”</p>
                        {isLong && <button className="expand-message" onClick={() => setExpanded(prev => isExpanded ? prev.filter(x => x !== item.id) : [...prev, item.id])}>{isExpanded ? 'SHOW LESS' : 'READ FULL MESSAGE'}</button>}
                        <strong>— {item.name}</strong>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {view === 'dossier' && (
            <div className="mission-dossier dossier-gallery">
              <section className="golden-record-hero">
                <div className="golden-record-copy">
                  <span className="dossier-kicker">THE VOYAGER GOLDEN RECORD · 1977</span>
                  <h2>A little of Earth,<br />sent into the universe.</h2>
                  <p>Two Voyager spacecraft carry a message from our world: sounds, music, greetings and images chosen to show what life on Earth is like.</p>
                  <a className="dossier-external-link" href="https://science.nasa.gov/mission/voyager/voyager-golden-record-overview/" target="_blank" rel="noreferrer">EXPLORE NASA’S GOLDEN RECORD <ArrowUpRight size={13} /></a>
                </div>
                <a className="golden-record-art" href="https://science.nasa.gov/image-detail/voyager-gold-record-front/" target="_blank" rel="noreferrer" aria-label="View the Golden Record at NASA">
                  <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia14/pia14113/PIA14113.jpg?crop=faces%2Cfocalpoint&fit=clip&h=552&w=981" alt="NASA illustration showing the Golden Record and where it is carried on Voyager" />
                  <span>THE SOUNDS OF EARTH <small>NASA / JPL-CALTECH</small></span>
                </a>
              </section>

              <section className="golden-record-intro">
                <div className="golden-record-cover">
                  <img src="https://images-assets.nasa.gov/image/PIA21740/PIA21740~medium.jpg" alt="Engineers installing the Golden Record cover on Voyager in 1977" loading="lazy" />
                  <span>AN OBJECT MADE TO OUTLAST US</span>
                </div>
                <div className="golden-record-story">
                  <span className="dossier-kicker">A MESSAGE IN A BOTTLE</span>
                  <h3>Not just a record.<br />A portrait of our planet.</h3>
                  <p>The 12-inch, gold-plated copper disc was designed as a time capsule for anyone who might find it. Its protective cover carries symbolic instructions for playing the record and locating the origin of the spacecraft.</p>
                  <div className="record-stats">
                    <div><strong>115</strong><span>IMAGES</span></div>
                    <div><strong>55</strong><span>LANGUAGES</span></div>
                    <div><strong>90 min</strong><span>OF MUSIC</span></div>
                  </div>
                  <a className="spotify-record-link" href="https://open.spotify.com/album/1DPVwnfFe2VdRCPXKzou6q" target="_blank" rel="noreferrer">
                    <span>LISTEN ON SPOTIFY</span><strong>The Golden Record: Greetings and Sounds of the Earth <small>4-track greetings and sounds EP · NASA’s music selection is linked separately below</small></strong><ArrowUpRight size={15} />
                  </a>
                </div>
              </section>

              <section className="golden-image-feature">
                <div className="golden-image-feature-copy">
                  <span className="dossier-kicker">THE IMAGES ON THE GOLDEN RECORD</span>
                  <h3>115 pictures.<br />One portrait of Earth.</h3>
                  <p>From human anatomy and DNA to landscapes, animals, cities and everyday life — these are the images selected to introduce our world to whoever might find Voyager.</p>
                  <a className="dossier-external-link" href="https://science.nasa.gov/gallery/images-on-the-golden-record/" target="_blank" rel="noreferrer">EXPLORE NASA’S GOLDEN RECORD IMAGE GALLERY <ArrowUpRight size={13} /></a>
                </div>
                <a className="golden-image-feature-art" href="https://science.nasa.gov/gallery/images-on-the-golden-record/" target="_blank" rel="noreferrer">
                  <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia14/pia14113/PIA14113.jpg?crop=faces%2Cfocalpoint&fit=clip&h=600&w=900" alt="The Voyager Golden Record and its image collection" loading="lazy" />
                  <span>NASA’S OFFICIAL IMAGE COLLECTION</span>
                </a>
              </section>

              <section className="record-contents-section">
                <div className="dossier-section-heading">
                  <span className="dossier-kicker">WHAT DID WE SEND?</span>
                  <h3>Sounds, sights, and greetings from Earth.</h3>
                </div>
                <div className="record-content-grid">
                  <a className="record-content-card record-sounds" href="https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/" target="_blank" rel="noreferrer">
                    <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia17/pia17046/PIA17046.jpg?crop=faces%2Cfocalpoint&fit=clip&h=600&w=900" alt="Artist's concept of Voyager travelling through interstellar space" loading="lazy" />
                    <span className="record-card-index">01 / LISTEN</span><h4>The sounds of Earth</h4>
                    <p>Whales, thunder, birds, footsteps, laughter and the sounds of a living planet.</p>
                    <b>EXPLORE THE SOUNDS <ArrowUpRight size={12} /></b>
                  </a>
                  <a className="record-content-card record-music" href="https://open.spotify.com/playlist/4gPhGa5PrRwjEqiMFKPyNK" target="_blank" rel="noreferrer">
                    <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia23/pia23645/PIA23645.jpg?crop=faces%2Cfocalpoint&fit=clip&h=600&w=900" alt="Voyager spacecraft in deep space" loading="lazy" />
                    <span className="record-card-index">02 / MUSIC</span><h4>A playlist for the universe</h4>
                    <p>From Bach and Mozart to Chuck Berry and Indian classical music — a snapshot of music across cultures.</p>
                    <b>OPEN THE GOLDEN RECORD PLAYLIST <ArrowUpRight size={12} /></b>
                  </a>
                  <a className="record-content-card record-greetings" href="https://science.nasa.gov/mission/voyager/golden-record-contents/greetings/" target="_blank" rel="noreferrer">
                    <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia17/pia17464/PIA17464.jpg?crop=faces%2Cfocalpoint&fit=clip&h=600&w=900" alt="Voyager spacecraft being prepared for its journey" loading="lazy" />
                    <span className="record-card-index">03 / HELLO</span><h4>55 ways to say hello</h4>
                    <p>Greetings from people on Earth, in languages from around the world — including Hindi and Bengali.</p>
                    <b>HEAR THE GREETINGS <ArrowUpRight size={12} /></b>
                  </a>
                  <a className="record-content-card record-images" href="https://science.nasa.gov/gallery/images-on-the-golden-record/" target="_blank" rel="noreferrer">
                    <img src="https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia14/pia14113/PIA14113.jpg?crop=faces%2Cfocalpoint&fit=clip&h=600&w=900" alt="The Voyager Golden Record image collection" loading="lazy" />
                    <span className="record-card-index">04 / EXPLORE</span><h4>115 pictures from Earth</h4>
                    <p>Explore the images chosen to introduce our planet — people, places, science and the natural world.</p>
                    <b>OPEN NASA’S IMAGE GALLERY <ArrowUpRight size={12} /></b>
                  </a>
                </div>
              </section>

              <section className="record-image-section">
                <div className="dossier-section-heading">
                  <span className="dossier-kicker">A GALLERY FROM OUR WORLD</span>
                  <h3>Voyager’s view of the outer worlds.</h3>
                  <p>A selection of iconic photographs returned by Voyager 1 — from Jupiter and Saturn to the Pale Blue Dot. The Golden Record’s separate collection of 115 images is available in NASA’s archive below.</p>
                </div>
                <div className="voyager-gallery-carousel">
                  {[
                    { title: 'The Pale Blue Dot', detail: 'Earth, seen from 6 billion kilometres away · 1990', image: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia23/pia23645/PIA23645.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1000&w=1800', credit: 'NASA / JPL-CALTECH' },
                    { title: 'Jupiter', detail: 'Voyager 1’s first close-up look at the giant planet · 1979', image: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia01/pia01371/PIA01371.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1000&w=1800', credit: 'NASA / JPL' },
                    { title: 'Saturn', detail: 'A world of rings, captured during the 1980 flyby', image: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia01/pia01969/PIA01969.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1000&w=1800', credit: 'NASA / JPL' },
                    { title: 'Jupiter in detail', detail: 'Early images from Voyager 1’s approach to Jupiter · 1978', image: 'https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia00/pia00454/PIA00454.jpg?crop=faces%2Cfocalpoint&fit=clip&h=1000&w=1800', credit: 'NASA / JPL' }
                  ].map((item, index) => (
                    <article className={'voyager-gallery-slide ' + (index === recordImageIndex ? 'active' : '')} key={item.title} aria-hidden={index !== recordImageIndex}>
                      <a href={item.image} target="_blank" rel="noreferrer" tabIndex={index === recordImageIndex ? 0 : -1}>
                        <img src={item.image} alt={item.title + ' — Voyager mission image'} loading={index === recordImageIndex ? 'eager' : 'lazy'} />
                      </a>
                      <div className="voyager-gallery-caption"><span>{item.credit}</span><h4>{item.title}</h4><p>{item.detail}</p></div>
                    </article>
                  ))}
                  <div className="voyager-gallery-controls">
                    <span>{String(recordImageIndex + 1).padStart(2, '0')} <i>/</i> 04</span>
                    <div><button type="button" onClick={() => setRecordImageIndex(index => (index + 3) % 4)} aria-label="Previous Voyager image">←</button><button type="button" onClick={() => setRecordImageIndex(index => (index + 1) % 4)} aria-label="Next Voyager image">→</button></div>
                  </div>
                </div>
                <p className="record-image-note">NASA’s online gallery displays a subset of the images; some original photographs are copyright-protected.</p>
              </section>

              <section className="dossier-facts">
                <div className="dossier-section-heading">
                  <span className="dossier-kicker">THE SPACECRAFT CARRYING IT ALL</span>
                  <h3>Voyager 1, at a glance.</h3>
                </div>
                <div className="facts-grid">
                  <Fact label="DISTANCE FROM THE SUN" value={fmt(estimatedDistance)} unit="km" note="Estimated current distance" />
                  <Fact label="ONE-WAY LIGHT TIME" value={lightHours.toFixed(2)} unit="hours" note="Signal travel time" />
                  <Fact label="TIME SINCE LAUNCH" value={Math.floor(missionDays / 365.25) + ' years'} unit="" note={Math.floor(missionDays % 365.25) + ' days elapsed'} />
                  <Fact label="CRUISE SPEED" value="≈ 61,200" unit="km/h" note="Approximate speed" />
                </div>
                <div className="facts-foot"><span>LAUNCH DATE <b>05 SEP 1977</b></span><span>INTERSTELLAR ENTRY <b>AUG 2012</b></span><span>NOT LIVE NASA TELEMETRY</span></div>
              </section>

              <section className="panel dossier-distance">
                <div className="panel-head"><div><span className="panel-index">02</span><h2>HOW FAR OUT IS VOYAGER 1?</h2></div></div>
                <div className="journey-visual">
                  <div className="journey-endpoints"><span>THE SUN</span><span>THE OORT CLOUD</span></div>
                  <div className="journey-track" role="img" aria-label="Voyager 1's position on a simplified scale extending to the Oort Cloud.">
                    <div className="journey-progress" style={{ width: Math.min(100, voyagerAU / 2000 * 100) + '%' }} />
                    <div className="journey-dots">
                      {[{ name: 'Earth', au: 1 }, { name: 'Jupiter', au: 5.2 }, { name: 'Saturn', au: 9.6 }, { name: 'Uranus', au: 19.2 }, { name: 'Neptune', au: 30.1 }, { name: 'Kuiper Belt', au: 40 }].map(item =>
                        <span key={item.name} className="journey-dot-static" style={{ left: (item.au / 2000 * 100) + '%' }} title={item.name} />
                      )}
                      <div className="journey-voyager voyager-image-marker" style={{ left: Math.min(100, voyagerAU / 2000 * 100) + '%' }}><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABGCAYAAAAzbZETAAAUG0lEQVR42u1deXxU1b3/nnPvnX1JJslkQvYNkhAgQAFlkUUQF9RiOxTBSlkatJ8iDxHE+njj9LXV98S6oFSxtgW3NmPlIbRiXTAqKmWHQAKGJSF7JjNJZp+7nPdHEoi4sSqG+f01uZNz7zm/7+/3/S3nfs4A5yn/O9M6uHSq9V4AcACUMUa7vyKIyVnLWSvL4QB1OsF+NS1xKKXsCUFQD99ztJ0UFOTuEcSAMeJvdWs536zGNLRN9kJxAQDscLlcckzNXy382f+rA4CTZV91zZrD/oRRu9/6K7LjKVraxdFpghdp2fnQ5I+/ybn08RfWggJgAFwxDX+DcGfrKeXl5QwAbh6mvd8YZzTvOupjuWNupTRcq+hGL5cTS+zMd9D1Xompc9zEwcYluapA4+3X5Vjf3udpBpzk/XLAGdP3eQOAMjs41yGwJK2UWHng4EQp1CEKaj1nLbqGJOSO4GSRp8d3v329qE6aKhPdQH1a0bzc3CGl9TvXlZc+WHVsYJmdc7kOsZjKzzMGACAEYBmZiMtPjKsdOTDNOGhA/wXrdqpv5MLNtynearmtpYVLy8uXs/oPFUcPH/A3dNQUhtr23uer89b/4s+fnQCgdD8zBsT5ZCysG4S3Hh42ae1Ow/S6qrY1OrnyRZUhfljmoKvk/Px8klBwCwmJ6qcqXrD/PjmzX6lFLe9BoNOenpUpDxxx6/yXty8WnU4on7svY6QLYcJiAJzdGAYA9kzY0m768RGOE4xyZztGZvqUkC5v3rwVf1nnWLTI5AnV/DRX25wpumtKJbXN3CkUTnj4+VfL7XY715MdMcY4QsgXPseyoK9xhDI7uA9tefzq1dVNPz2y9yObRTO1pcl3sslgzNQ1vfYPgKC16V2FSepgrTXbOqIk1xxxnwh1eEN+hwP00KHTlk8Ike1FDpXtWgshhES6r7EYAF8jM1yQHY5qBoCYLbbfa0y6f3UywfteC104LX50B7AWtYer540dUfTbdvidqn6j692edv1bm//PvacJCuA6Ze0Vbu8SlUq9SMVTco9z3mOEkKfLGONmXCGewJ/vwB4ef7rso3cAvNN9eV3n+PFd90wpGWY0aQ0mykaGfYElEU/t7HnTB+zpl2H+caal5ENCiFjp9f46Oy5uZScAIwCNVr260esPphDypyuFjrgLvQFjIICDlpeXAwykZu4JBjgxbt6jn7C24296IlK1v7M1u6WtQe9VDKP1iMyp/+zdF5/5WCq0GTXrghJEjSgRLc8UAgqOsEm33HzzX1JTU/0AaE/9EQvC5ylLl84uklorb000ROo+qUV+thHbRF/2h8vWv7g7OT6uf0BSFAsFp6IUACQAfEuL+9fJyUkOxhhPCJFiyeo5isMBWlo6XHDYi1SEAPcsnLL8vjsL73v9d9cmAMDW3fsWBBljDYyJbllmClNYt8iMMcXv9x0tKytTdaenfbq5x1+o99jtoC4XlO7UlLCuYkEBdikAcMPMmT/wBEJtpF2xrXl9XzGA8oRE470CwHhZJnrKQE5PgwJQdHpDzpgxbt6W2Y9z4H9Q6rU5XwAAAABJRU5ErkJggg==" alt="Voyager 1" /></div>
                    </div>
                  </div>
                  <div className="journey-caption"><span>THE SUN</span><span>VOYAGER 1 · {voyagerAU.toFixed(1)} AU</span><span>OUTWARD</span></div>
                </div>
              </section>

              <section className="panel dossier-history">
                <div className="panel-head"><div><span className="panel-index">03</span><h2>MISSION HISTORY</h2></div><span className="panel-tag">1977 — PRESENT</span></div>
                <div className="timeline-summary"><strong>From launch to interstellar space.</strong><span>The milestones that shaped Voyager 1's journey.</span></div>
                <div className="timeline">
                  {[
                    { year: '1977', title: 'Launch', desc: 'Voyager 1 launched on 5 September from Cape Canaveral, beginning its journey through the outer Solar System.', image: 'https://images-assets.nasa.gov/image/PIA17464/PIA17464~medium.jpg', credit: 'NASA/JPL' },
                    { year: '1979', title: 'Jupiter flyby', desc: 'Voyager 1 returned detailed observations of Jupiter, its atmosphere, rings and moons.', image: 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia01/pia01371/PIA01371.jpg', credit: 'NASA/JPL' },
                    { year: '1980', title: 'Saturn flyby', desc: 'Voyager 1 explored Saturn and its moon Titan before heading outwards from the planetary region.', image: 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia01/pia01969/PIA01969.jpg', credit: 'NASA/JPL' },
                    { year: '1990', title: 'The Pale Blue Dot', desc: 'Voyager 1 turned its camera back toward home and captured Earth as a tiny point of light.', image: 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia00/pia00452/PIA00452.jpg', credit: 'NASA/JPL' },
                    { year: '2012', title: 'Interstellar space', desc: 'Voyager 1 became the first human-made object to enter interstellar space.', image: 'https://images-assets.nasa.gov/image/PIA17046/PIA17046~medium.jpg', credit: 'NASA/JPL-Caltech' },
                    { year: '2026', title: 'One light-day milestone', desc: 'At approximately 25.9 billion kilometres, a radio signal takes about 24 hours to travel one way.', image: 'https://images-assets.nasa.gov/image/PIA23645/PIA23645~medium.jpg', credit: 'NASA/JPL-Caltech' }
                  ].map((item, index) => (
                    <div className="timeline-item" key={item.year}>
                      <div className="timeline-marker">{String(index + 1).padStart(2, '0')}</div>
                      <div className="timeline-copy"><span>{item.year}</span><h3>{item.title}</h3><p>{item.desc}</p><small>{item.credit}</small></div>
                      <img className="timeline-image" src={item.image} alt={item.title + ' — Voyager 1 mission'} loading="lazy" />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          <footer className="main-footer"><span>ASTRONOMY & SPACE PHYSICS SOCIETY · PEC</span><span>A MESSAGE FROM MARS</span></footer>
        </section>
      </div>
    </main>
  );
}

function Fact({ label, value, unit, note }: { label: string; value: string; unit: string; note: string }) {
  return <div className="fact"><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>;
}