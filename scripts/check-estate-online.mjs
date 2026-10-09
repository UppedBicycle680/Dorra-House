import {randomBytes,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,API_URL} from '../online-config.js';

const ORIGIN='https://uppedbicycle680.github.io';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ensure=(condition,label)=>{if(!condition)throw new Error(label)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/** Uses a disposable account and only published configuration. Never prints
 * passwords, email addresses, session tokens, response bodies, or player saves.
 * The returned account UUID/username must be removed after the test. */
export async function checkEstateOnline(fetchImpl=fetch) {
  const report={ok:false,checks:[],account:null,cleanup:[]};
  const tokens=new Set();
  let email,password,current,stage='Auth configuration';
  async function http(url,{body,token,method='POST'}={}) {
    const response=await fetchImpl(url,{method,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Origin:ORIGIN,
      ...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
    let value={};if(response.status!==204){try{value=await response.json()}catch{throw new Error('The live service returned an unreadable response.')}}
    return {ok:response.ok,status:response.status,value};
  }
  const success=(response,label)=>{ensure(response.ok,label+' was rejected (HTTP '+response.status+').');return response.value};
  const authSession=(value,label)=>{ensure(typeof value.access_token==='string'&&typeof value.refresh_token==='string',label+' returned no session.');tokens.add(value.access_token);return {token:value.access_token,refresh:value.refresh_token}};
  const passed=label=>report.checks.push(label);
  async function acquire(auth) {
    current={...auth,leaseId:randomUUID(),revision:0};
    const value=success(await http(API_URL,{token:current.token,body:{scope:'session',action:'acquire',leaseId:current.leaseId}}),'Session acquire');
    ensure(value.snapshot&&Number.isSafeInteger(value.revision),'Session acquire returned no save.');
    current.snapshot=value.snapshot;current.revision=value.revision;
    return value;
  }
  const body=(action,args={})=>({scope:'house',action,args,leaseId:current.leaseId,requestId:randomUUID(),expectedRevision:current.revision});
  async function run(action,args={}) {
    const command=body(action,args),before=current.revision;
    const value=success(await http(API_URL,{token:current.token,body:command}),action);
    ensure(value.snapshot&&value.revision===before+1,action+' did not save exactly once.');
    current.snapshot=value.snapshot;current.revision=value.revision;
    return {command,value};
  }
  async function reject(action,args,label) {
    const response=await http(API_URL,{token:current.token,body:body(action,args)});
    ensure([400,401,403,409].includes(response.status),label+' was unexpectedly accepted.');
  }
  async function replay(command,value) {
    const restored=success(await http(API_URL,{token:current.token,body:command}),'Request replay');
    ensure(restored.replayed===true&&restored.revision===value.revision,'Request replay changed the revision.');
    ensure(JSON.stringify(restored.snapshot)===JSON.stringify(value.snapshot),'Request replay changed the saved estate.');
  }
  try {
    const settings=success(await http(SUPABASE_URL+'/auth/v1/settings',{method:'GET'}),'Auth settings');
    ensure(settings.mailer_autoconfirm===true,'Email confirmation is enabled or unavailable. No signup or email was attempted.');
    passed('Auto-confirm verified before creating a disposable account');
    stage='Disposable account signup';
    const suffix=randomBytes(6).toString('hex'),username='EstateQA_'+suffix;
    email='estate.qa.'+suffix+'@example.com';password='Aa1!'+randomBytes(30).toString('base64url');
    const signed=success(await http(SUPABASE_URL+'/auth/v1/signup',{body:{email,password,data:{username}}}),'Signup');
    ensure(UUID.test(signed.user?.id||''),'Signup returned no disposable account UUID.');
    report.account={id:signed.user.id,username};
    if(typeof signed.access_token==='string')tokens.add(signed.access_token);
    const logged=success(await http(SUPABASE_URL+'/auth/v1/token?grant_type=password',{body:{email,password}}),'Password login');
    ensure(logged.user?.id===report.account.id,'Password login returned a different account.');
    await acquire(authSession(logged,'Password login'));
    passed('Authenticated cloud session acquired');
    stage='Estate migration and opening';
    await run('view');
    ensure(current.snapshot.progress?.empire?.clicker?.schemaVersion===1,'The account did not migrate to the clicker estate.');
    const initial=current.snapshot.balance,opening=await run('estate-clicker-open',{venueId:'terrace'});
    ensure(initial-current.snapshot.balance===250,'Terrace opening used the wrong server price.');
    await replay(opening.command,opening.value);
    passed('Terrace opening persists with the server price and idempotent replay');
    stage='Manual service and milestone';
    const served=await run('estate-clicker-serve',{venueId:'terrace'});
    ensure(served.value.result?.amount===12&&current.snapshot.progress.empire.clicker.served===1,'Manual coffee service did not save.');
    await replay(served.command,served.value);
    const goal=await run('estate-clicker-goal',{goalId:'first-service'});
    ensure(goal.value.result?.amount===75,'The first-service milestone used the wrong reward.');
    await reject('estate-clicker-goal',{goalId:'first-service'},'Repeated milestone');
    passed('Manual service and milestone reward save once');
    stage='Tamper and legacy action rejection';
    const beforeTamper=JSON.stringify(current.snapshot),revisionBeforeTamper=current.revision;
    await reject('estate-clicker-serve',{venueId:'terrace',amount:1000000,now:9999999999999},'Forged tap reward');
    await reject('estate-clicker-open',{venueId:'valet',cost:0},'Forged venue price');
    await reject('estate-week',{},'Legacy instant weekly reward');
    const refresh=success(await http(API_URL,{token:current.token,body:{...body('refresh'),scope:'session'}}),'Save refresh');
    ensure(refresh.revision===revisionBeforeTamper&&JSON.stringify(refresh.snapshot)===beforeTamper,'Rejected actions changed the save.');
    passed('Client prices, rewards, clocks and legacy instant-week rewards are rejected');
    stage='Upgrade and manager automation';
    await reject('estate-clicker-manager',{venueId:'terrace'},'Level 1 manager purchase');
    await run('daily-reward');
    await run('estate-clicker-upgrade',{venueId:'terrace'});
    ensure(current.snapshot.progress.empire.venues.terrace.level===2,'Terrace upgrade did not save.');
    await run('arrival',{path:'owner'});
    for(let count=0;current.snapshot.balance<1200&&count<30;count++) {
      await sleep(450);
      await run('estate-clicker-serve',{venueId:'terrace'});
    }
    ensure(current.snapshot.balance>=1200,'Manual service did not earn enough to hire the manager.');
    const beforeManager=current.snapshot.balance;
    await run('estate-clicker-manager',{venueId:'terrace'});
    ensure(current.snapshot.progress.empire.venues.terrace.manager===true&&beforeManager-current.snapshot.balance===1200,'Manager purchase did not use the saved eligibility and server price.');
    await sleep(1600);
    const income=await run('estate-clicker-claim');
    ensure(income.value.result?.amount>=5,'Managed service did not generate collectible income.');
    await replay(income.command,income.value);
    passed('Upgrades, manager purchase, automatic earnings and collection persist');
    stage='Second-session restoration';
    const savedSnapshot=JSON.stringify(current.snapshot),savedRevision=current.revision;
    const second=success(await http(SUPABASE_URL+'/auth/v1/token?grant_type=password',{body:{email,password}}),'Second password login');
    ensure(second.user?.id===report.account.id,'Second login returned a different account.');
    const restored=await acquire(authSession(second,'Second password login'));
    ensure(restored.revision===savedRevision+1&&JSON.stringify(restored.snapshot)===savedSnapshot,'The estate failed to restore in a fresh account session.');
    passed('A fresh sign-in restores venue levels, manager, earnings, milestones and balance');
    report.ok=true;
  } catch(error) {
    report.failure={stage,message:typeof error.message==='string'?error.message:'The live estate check failed.'};
  } finally {
    for(const token of tokens) {
      try{const result=await http(SUPABASE_URL+'/auth/v1/logout?scope=local',{token});report.cleanup.push({signedOut:result.ok||[401,403].includes(result.status)})}
      catch{report.cleanup.push({signedOut:false})}
    }
    tokens.clear();email=password=current=null;
  }
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=await checkEstateOnline();
  console.log(JSON.stringify(report));
  if(!report.ok)process.exitCode=1;
}
