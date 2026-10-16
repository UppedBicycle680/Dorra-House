import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createWarHandler} from './handler.mjs';
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}
});
Deno.serve(createWarHandler({
  async getUser(token:string){const {data,error}=await admin.auth.getUser(token);return error?null:data.user;},
  rpc:(name:string,args:Record<string,unknown>)=>admin.rpc(name,args),
  async project(userId:string,matchId:string,baseRevision:number|null,view:unknown){
    const {data,error}=await admin.rpc('dorra_war_projection',{p_user_id:userId,p_match_id:matchId,p_base_revision:baseRevision,p_view:view});
    if(error)throw new Error('Projection unavailable');return data;
  }
}));
