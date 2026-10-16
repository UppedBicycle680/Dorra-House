// Transport validation only. Match rules, clocks, visibility, resources and
// rewards are implemented once, by dorra_war_command in PostgreSQL.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = new Set(['list','create','join','start','view','order','research','build','produce','diplomacy','pause','resume','retire','reward']);
const origins = new Set(['https://uppedbicycle680.github.io','http://localhost:4173','http://127.0.0.1:4173','http://localhost:4180','http://127.0.0.1:4180']);
const publicErrors = {
  AUTH_SESSION_ENDED:'Your sign-in session ended. Sign in again.', ACCOUNT_DISABLED:'This account is unavailable.',
  SAVE_REQUIRED:'Open a Dorra House gameplay session first.', SESSION_REPLACED:'Another tab or device started a session. Continue here to take over.',
  RATE_LIMIT:'Too many commands. Wait a minute and retry.', REQUEST_REUSED:'This request ID belongs to a different command.',
  MATCH_FORBIDDEN:'You are not a player in this match.', MATCH_NOT_FOUND:'This match could not be found.',
  MATCH_NOT_RUNNING:'The match is not running.', MATCH_STATUS:'This command is unavailable in the current match status.',
  MATCH_NOT_JOINABLE:'This match is not open for joining.', MATCH_FULL:'This match has reached its player limit.',
  WORLD_CAPACITY:'All four running worlds are occupied. Retry when a world finishes or a solo world pauses.',
  STORAGE_CAPACITY:'Campaign storage is full. Try again after completed worlds have been archived.',
  HOST_MATCH_LIMIT:'You already host two unfinished matches.', OPPONENT_REQUIRED:'Wait for another player before starting.',
  SOLO_MATCH_LIMIT:'You already have a saved solo campaign. Resume or retire it before creating another.',
  HOST_REQUIRED:'Only the host can perform this command.', SOLO_PAUSE_ONLY:'Only a solo match can be paused.',
  INVITE_REQUIRED:'Use the invite code supplied by the match host.', NATION_UNAVAILABLE:'That nation has already been selected.',
  ALREADY_JOINED:'You already belong to this match.', CATALOG_NOT_READY:'The world catalogue is not ready. Try again later.',
  INVALID_OPPONENT:'Choose a different opposing nation.', NATION_HAS_NO_PROVINCES:'This nation has no map provinces.',
  INSUFFICIENT_RESOURCES:'Your nation does not have the required resources.', UNIT_NOT_OWNED:'Select only your own formations.',
  UNIT_UNAVAILABLE:'This formation is no longer available.', UNIT_BUSY:'This formation already has an active order. Retreat to redirect it.',
  TARGET_NOT_VISIBLE:'That formation is outside your current intelligence picture.', DESTINATION_REQUIRED:'Choose a destination province.',
  NO_ROUTE:'No permitted route connects these provinces.', INVALID_DESTINATION:'That destination is not part of this match.',
  ALREADY_THERE:'The formation is already there.', OUT_OF_RANGE:'The target is beyond this platform’s range.',
  AIR_BASE_REQUIRED:'Aircraft require a friendly operational airfield or carrier with free deck capacity.',
  DECLARE_WAR_FIRST:'Declare war before attacking this nation.', BORDER_CLOSED:'Request alliance access or declare war before crossing this border.',
  RETREAT_TO_FRIENDLY:'Choose one of your own provinces for the retreat.', PORT_REQUIRED:'This action requires a mapped port.',
  PLATFORM_UNAVAILABLE:'This platform is not available to your nation.', RESEARCH_REQUIRED:'Complete this platform’s research first.',
  ALREADY_RESEARCHED:'This programme is already researched.', ALREADY_QUEUED:'This programme is already in the research queue.',
  RESEARCH_SLOTS_FULL:'Both research slots are occupied.', RESEARCH_PREREQUISITE:'Complete the prerequisite research first.',
  RESEARCH_LAB_REQUIRED:'Build an intelligence centre before starting research.', FACILITY_REQUIRED:'Upgrade the required production facility first.',
  PROVINCE_NOT_OWNED:'Select one of your own provinces.', PROVINCE_CONTAMINATED:'This province is contaminated and cannot build yet.',
  PRODUCTION_SLOT_FULL:'This province already has a production order.', BUILD_SLOT_FULL:'This province is already constructing a facility.',
  FACILITY_MAX_LEVEL:'This facility has reached its maximum level.', FORMATION_CAP:'Your nation has reached the formation limit.',
  CANNOT_SPLIT:'An idle formation needs at least two groups to split.', INCOMPATIBLE_FORMATIONS:'Merge idle formations of the same platform in one province.',
  SELECT_ONE_FORMATION:'Select exactly one formation.', SELECT_MULTIPLE_FORMATIONS:'Select at least two formations.', STACK_CAP:'A merged formation may contain at most 20 groups.',
  ALLIANCE_REQUIRED:'Resource transfers require an alliance.', NO_DIPLOMATIC_OFFER:'There is no offer from that nation to answer.',
  MATCH_NOT_FINISHED:'Finish the match before claiming a reward.', REWARD_ALREADY_CLAIMED:'This match reward has already been claimed.',
  REWARD_INELIGIBLE:'This match is not eligible for a completion reward.', MATCH_CATCHING_UP:'The match is catching up. Retry this command shortly.',
  RESEARCH_ONLY:'This programme unlocks capabilities and cannot be mobilised as a formation.',
  NUCLEAR_UNAVAILABLE:'This nation cannot research or produce nuclear weapons.', INVALID_WAYPOINTS:'Choose up to eight valid waypoint provinces.'
};
function fail(message, code='INVALID_COMMAND', status=400) { throw Object.assign(new Error(message), {code,status}); }
export function validateWarBody(body) {
  if (!body || typeof body!=='object' || Array.isArray(body)) fail('Use a command object.');
  if (Object.keys(body).some(k=>!['protocolVersion','action','matchId','args','leaseId','requestId','baseRevision'].includes(k))) fail('Unknown command fields.');
  if (body.protocolVersion!=null&&body.protocolVersion!==1) fail('This war client needs an update.','PROTOCOL_VERSION',409);
  if (body.baseRevision!=null&&(!Number.isSafeInteger(body.baseRevision)||body.baseRevision<0)) fail('Invalid projection version.');
  if (!actions.has(body.action)) fail('Unknown war command.');
  if (!UUID.test(body.leaseId||'')) fail('A valid House gameplay lease is required.');
  if (!['list','create'].includes(body.action) && !UUID.test(body.matchId||'')) fail('Choose a valid match.');
  if (body.matchId!=null && !UUID.test(body.matchId)) fail('Invalid match identifier.');
  if (!['list','view'].includes(body.action) && !UUID.test(body.requestId||'')) fail('A unique request ID is required.');
  if (body.requestId!=null && !UUID.test(body.requestId)) fail('Invalid request identifier.');
  const args=body.args??{};
  if (!args || typeof args!=='object' || Array.isArray(args)) fail('Use an argument object.');
  if (JSON.stringify(args).length>16000) fail('The command is too large.','PAYLOAD_TOO_LARGE',413);
  const fields={list:['inviteCode','matchId'],view:[],create:['nationId','opponentNationId','template','opponent','pace','visibility','name'],join:['nationId','inviteCode'],start:[],pause:[],resume:[],retire:[],reward:[],research:['platformId'],produce:['provinceId','platformId'],build:['provinceId','facility'],diplomacy:['nationId','type','resources','platformId'],order:['unitIds','type','targetProvinceId','targetUnitId','waypoints']};
  if(Object.keys(args).some(key=>!fields[body.action].includes(key)))fail('Only command intentions are accepted.');
  if(args.inviteCode!=null&&!UUID.test(args.inviteCode))fail('Use a valid operation invite code.');
  if(args.matchId!=null&&!UUID.test(args.matchId))fail('Choose a valid operation.');
  if (body.action==='create') {
    if (!['duel','world'].includes(args.template) || !['ai','human'].includes(args.opponent) || !['fast','persistent'].includes(args.pace) || !['public','invite'].includes(args.visibility)) fail('Choose a valid match setup.');
    if (typeof args.nationId!=='string' || args.nationId.length>20 || (args.template==='duel' && (typeof args.opponentNationId!=='string' || args.opponentNationId===args.nationId))) fail('Choose two different nations.');
    if (args.name!=null && (typeof args.name!=='string'||args.name.length>60)) fail('Match names may have up to 60 characters.');
  }
  if (body.action==='order') {
    if (!Array.isArray(args.unitIds)||!args.unitIds.length||args.unitIds.length>20||args.unitIds.some(id=>!UUID.test(id))) fail('Select up to 20 valid formations.');
    if (!['move','attack','patrol','bombard','retreat','intercept','embark','split','merge'].includes(args.type)) fail('Choose a valid formation order.');
    if (args.targetUnitId!=null&&!UUID.test(args.targetUnitId)) fail('Choose a valid target.');
    if (args.waypoints!=null&&(!Array.isArray(args.waypoints)||args.waypoints.length>8||args.waypoints.some(v=>typeof v!=='string'||v.length>80))) fail('Choose up to eight waypoint provinces.');
  }
  return {...body,args};
}
async function boundedJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('Use application/json.','CONTENT_TYPE',415);
  const reader=request.body?.getReader(); let raw='',size=0;const decoder=new TextDecoder();
  if (reader) try { while(true) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20000){await reader.cancel();fail('The command is too large.','PAYLOAD_TOO_LARGE',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();} finally {reader.releaseLock();}
  try {return validateWarBody(JSON.parse(raw));} catch(error) {if(error instanceof SyntaxError) fail('Invalid JSON.');throw error;}
}
export function createWarHandler({getUser,rpc,project}) {
  return async request=>{
    const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.has(origin))return reply({error:'This origin is not allowed.',code:'ORIGIN_DENIED'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'Use POST.',code:'METHOD_NOT_ALLOWED'},405);
    try {
      const bearer=request.headers.get('Authorization')||'';if(!bearer.startsWith('Bearer '))fail('Sign in to command a nation.','UNAUTHORIZED',401);
      const token=bearer.slice(7),user=await getUser(token);
      if(!user||user.is_anonymous)fail('Sign in with a registered account.','UNAUTHORIZED',401);
      let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{fail('Invalid sign-in token.','UNAUTHORIZED',401);}
      if(!UUID.test(claims.session_id||''))fail('Your sign-in session ended.','AUTH_SESSION_ENDED',401);
      const input=await boundedJson(request);
      const response=await rpc('dorra_war_command',{p_user_id:user.id,p_auth_session_id:claims.session_id,p_lease_id:input.leaseId,p_action:input.action,p_match_id:input.matchId??null,p_args:input.args,p_request_id:['list','view'].includes(input.action)?null:input.requestId??null});
      if(response.error) {
        const code=Object.keys(publicErrors).find(key=>response.error.message?.includes(key));
        if(code)fail(publicErrors[code],code,code==='RATE_LIMIT'?429:code==='AUTH_SESSION_ENDED'?401:['ACCOUNT_DISABLED','MATCH_FORBIDDEN'].includes(code)?403:409);
        // SQL details, constraints and hidden identifiers never cross this boundary.
        if(response.error.code==='P0001')fail('This command is unavailable. Refresh the match and try again.','ACTION_REJECTED',409);
        fail('The war service could not complete this command. Retry shortly.','SERVICE_UNAVAILABLE',503);
      }
      let result=response.data;
      if(project&&result?.view){const projected=await project(user.id,result.view.match.id,input.baseRevision??null,result.view);const {view,...rest}=result;result={...rest,...projected};}
      return reply({protocolVersion:1,...result});
    } catch(error) {return reply({error:error.code?error.message:'The war service is temporarily unavailable.',code:error.code||'SERVICE_UNAVAILABLE'},error.status||503);}
  };
}
