import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin-auth';
export const dynamic='force-dynamic';
function errorMessage(error:unknown,fallback:string){
  if(error instanceof Error)return error.message;
  if(error&&typeof error==='object'){
    const value=error as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown};
    const parts=[value.message,value.details,value.hint].filter((x):x is string=>typeof x==='string'&&x.length>0);
    if(parts.length)return [typeof value.code==='string'?`[${value.code}]`:null,...parts].filter(Boolean).join(' — ');
  }
  return fallback;
}
function db(){
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both the legacy service-role key and the newer Supabase secret-key name.
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
  if(!url||!key)throw new Error('Missing server Supabase credentials: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in Vercel.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function GET(){
  if(!await isAdmin())return NextResponse.json({error:'Admin session expired. Sign in again.'},{status:401});
  try{
    const {data,error}=await db().from('contributions').select('*').order('created_at',{ascending:false}).limit(500);
    if(error)throw error;
    return NextResponse.json({items:data||[]});
  }catch(e){
    console.error('Admin contributions GET failed:',e);
    return NextResponse.json({error:errorMessage(e,'Unable to load messages.')},{status:500});
  }
}
export async function DELETE(req:NextRequest){
  if(!await isAdmin())return NextResponse.json({error:'Admin session expired. Sign in again.'},{status:401});
  const {id}=await req.json().catch(()=>({}));
  if(typeof id!=='string'||!id)return NextResponse.json({error:'Missing message ID.'},{status:400});
  try{
    const {error}=await db().from('contributions').delete().eq('id',id);
    if(error)throw error;
    return NextResponse.json({ok:true});
  }catch(e){
    console.error('Admin contributions DELETE failed:',e);
    return NextResponse.json({error:errorMessage(e,'Unable to delete message.')},{status:500});
  }
}
