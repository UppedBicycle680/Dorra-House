import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createLoginHandler} from './handler.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, serviceKey, {auth: {persistSession: false, autoRefreshToken: false}});
const hashKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(serviceKey), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);

Deno.serve(createLoginHandler({
  async lookup(username: string, ipHash: string) {
    const {data, error} = await admin.rpc('dorra_username_login_attempt', {p_username: username, p_ip_hash: ipHash});
    if (error) throw new Error('Username lookup unavailable');
    return data;
  },
  async getEmail(userId: string) {
    const {data, error} = await admin.auth.admin.getUserById(userId);
    if (error) throw new Error('Auth user unavailable');
    return data.user?.email || null;
  },
  async authenticate(email: string, password: string) {
    // A fresh client per request prevents one visitor's Auth session replacing
    // the admin client's service credentials or another visitor's session.
    const auth = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {auth: {persistSession: false, autoRefreshToken: false}});
    return auth.auth.signInWithPassword({email, password});
  },
  async ipHash(request: Request) {
    const address = (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
    const bytes = await crypto.subtle.sign('HMAC', hashKey, new TextEncoder().encode(address));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }
}));
