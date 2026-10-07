import { createClient } from './vendor/supabase/supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './online-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { storageKey: 'dorra-online-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
export const siteURL = file => new URL(file, new URL('./', import.meta.url));
export function loginURL() {
  const url = siteURL('login.html');
  url.searchParams.set('next', location.pathname.split('/').pop() || 'index.html');
  return url;
}
export async function requireAccount() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    location.replace(loginURL());
    throw new Error('Sign in to Dorra House to continue.');
  }
  return data.session;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  sessionStorage.removeItem('dorra-online-lease');
  location.replace(siteURL('login.html'));
}
