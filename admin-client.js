import {supabase} from './auth-client.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './online-config.js';
export async function adminRequest(operation,args={},extra={}) {
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)throw Object.assign(new Error('Sign in to continue.'),{code:'UNAUTHORIZED'});
  let response;
  try {response=await fetch(`${SUPABASE_URL}/functions/v1/dorra-admin`,{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({operation,args,...extra}),signal:AbortSignal.timeout(25000)});}catch{throw Object.assign(new Error('The panel could not reach the server. Check your connection and retry.'),{code:'NETWORK_ERROR'});}
  let result;try{result=await response.json();}catch{throw Object.assign(new Error('The server returned an unexpected response. Retry shortly.'),{code:'SERVICE_UNAVAILABLE'});}
  if(!response.ok)throw Object.assign(new Error(result.error||'The action could not be completed.'),{code:result.code||'SAVE_FAILED'});
  return result;
}
