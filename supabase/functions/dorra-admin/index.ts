import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createAdminHandler} from './handler.mjs';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}});
const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
Deno.serve(createAdminHandler({
  async getUser(token:string){const {data,error}=await admin.auth.getUser(token);return error?null:data.user;},
  rpc:(name:string,args:Record<string,unknown>)=>admin.rpc(name,args),
  async setPassword(userId:string,password:string){const {error}=await admin.auth.admin.updateUserById(userId,{password});return !error;},
  async passwordBinding(password:string){const bytes=await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode('password-retry\0'+password));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');},
  async ipHash(request:Request){const address=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim();const hash=await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(address));return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
}));
