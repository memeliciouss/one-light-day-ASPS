import { NextRequest,NextResponse } from 'next/server';
import { setAdminSession,validAdminPassword } from '@/lib/admin-auth';
export async function POST(req:NextRequest){const body=await req.json().catch(()=>({}));if(!validAdminPassword(String(body.password||'')))return NextResponse.json({error:'Incorrect password.'},{status:401});await setAdminSession();return NextResponse.json({ok:true});}
