import { notFound } from 'next/navigation';
import AdminPanel from './panel';
export const dynamic='force-dynamic';
export default async function AdminPage({params}:{params:Promise<{secret:string}>}){const {secret}=await params;const expected=process.env.ADMIN_SECRET_PATH;if(!expected||secret!==expected)notFound();return <AdminPanel/>;}
