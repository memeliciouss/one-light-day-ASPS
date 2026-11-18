'use client';
import { useEffect,useState } from 'react';
type Item={id:string;name:string;message:string;prompt_id:string;created_at:string};
export default function AdminPanel(){
  const [password,setPassword]=useState('');
  const [authed,setAuthed]=useState(false);
  const [items,setItems]=useState<Item[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  async function readJson(r:Response){
    const raw=await r.text();
    try{return JSON.parse(raw);}catch{return {error:raw.slice(0,240)||`Server returned an empty response (HTTP ${r.status}).`};}
  }
  async function load(){
    setError('');
    try{
      const r=await fetch('/api/admin/contributions',{cache:'no-store',credentials:'same-origin'});
      const j=await readJson(r);
      if(!r.ok){setError(j.error||`Unable to load messages (HTTP ${r.status}).`);return;}
      setItems(j.items||[]);
    }catch(e){setError(e instanceof Error?e.message:'Network error while loading messages.');}
  }
  async function login(e:React.FormEvent){
    e.preventDefault();setError('');
    try{
      const r=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({password})});
      const j=await readJson(r);
      if(!r.ok){setError(j.error||`Login failed (HTTP ${r.status}).`);return;}
      setAuthed(true);setPassword('');
    }catch(e){setError(e instanceof Error?e.message:'Network error during login.');}
  }
  useEffect(()=>{if(authed)load();},[authed]);
  async function remove(id:string){
    if(!confirm('Permanently delete this transmission?'))return;
    setBusy(id);
    try{
      const r=await fetch('/api/admin/contributions',{method:'DELETE',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({id})});
      const j=await readJson(r);
      if(!r.ok)setError(j.error||`Delete failed (HTTP ${r.status}).`);
      else setItems(v=>v.filter(x=>x.id!==id));
    }catch(e){setError(e instanceof Error?e.message:'Network error while deleting.');}
    setBusy('');
  }
  async function logout(){await fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});setAuthed(false);setItems([]);}
  return <main style={{minHeight:'100vh',background:'#111312',color:'#f0f1e9',padding:'32px 18px',fontFamily:'Arial,sans-serif'}}><div style={{maxWidth:900,margin:'0 auto'}}><p style={{color:'#d5a84c',fontSize:11,letterSpacing:2}}>ASPS · ONE LIGHT-DAY</p><h1 style={{fontSize:28}}>Transmission moderation</h1>{!authed?<form onSubmit={login} style={{maxWidth:380,display:'grid',gap:12,marginTop:28}}><label htmlFor="password">Admin password</label><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={{padding:12,background:'#191c1a',border:'1px solid #4a554c',color:'white'}}/><button style={{padding:12,background:'#f2f2ed',color:'#171914',border:0,cursor:'pointer'}}>Sign in</button></form>:<><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',margin:'20px 0'}}><span>{items.length} transmissions</span><button onClick={logout} style={{padding:'8px 12px'}}>Sign out</button></div>{items.map(x=><article key={x.id} style={{padding:16,border:'1px solid #353c36',marginBottom:10,background:'#191c1a'}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><b>{x.name}</b><time style={{color:'#a0a69d',fontSize:12}}>{new Date(x.created_at).toLocaleString()}</time></div><p style={{lineHeight:1.6}}>{x.message}</p><small style={{color:'#a0a69d'}}>{x.prompt_id}</small><div><button disabled={busy===x.id} onClick={()=>remove(x.id)} style={{marginTop:12,padding:'8px 12px',background:'#6b3028',color:'white',border:0,cursor:'pointer'}}>{busy===x.id?'Deleting…':'Delete transmission'}</button></div></article>)}</>}{error&&<p role="alert" style={{color:'#e99b86',marginTop:16,whiteSpace:'pre-wrap'}}>Error: {error}</p>}</div></main>;
}
