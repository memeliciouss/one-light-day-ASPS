import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdmin } from '@/lib/admin-auth';
export const dynamic='force-dynamic';
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
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to load messages.'},{status:500});
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
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to delete message.'},{status:500});
  }
}
