import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const COOKIE='one-light-day-admin';
function signature(value:string){const secret=process.env.ADMIN_SESSION_SECRET;if(!secret)throw new Error('ADMIN_SESSION_SECRET is not configured');return createHmac('sha256',secret).update(value).digest('hex');}
export function validAdminPassword(password:string){const expected=process.env.ADMIN_PASSWORD||'';if(!expected)return false;const a=Buffer.from(password);const b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
export async function setAdminSession(){const value=String(Date.now()+8*60*60*1000);const token=value+'.'+signature(value);(await cookies()).set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:8*60*60});}
export async function isAdmin(){const token=(await cookies()).get(COOKIE)?.value||'';const [value,sig]=token.split('.');if(!value||!sig||Number(value)<Date.now())return false;try{const expected=signature(value);const a=Buffer.from(sig);const b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}catch{return false;}}
export async function clearAdminSession(){(await cookies()).delete(COOKIE);}
