export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fail(message,code='INVALID_ACTION',status=400){throw Object.assign(new Error(message),{code,status});}
export function maxRequestBytes(body){return body.scope==='house'&&body.action==='profile-save'?420000:body.scope==='football'&&body.action==='startClub'?300000:32768;}
export async function readBoundedBody(req,limit=420000){
  if(!req.body)return '';
  const reader=req.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>limit){await reader.cancel();fail('The action payload is too large.','PAYLOAD_TOO_LARGE',413);}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}
  finally{reader.releaseLock();}
}
export function validateBody(body){
  if(!body||typeof body!=='object'||Array.isArray(body))fail('Use a gameplay command.');
  const acquire=body.scope==='session'&&body.action==='acquire';
  const fields=acquire?['scope','action','leaseId']:['scope','action','leaseId','requestId','expectedRevision','args'];
  if(Object.keys(body).some(k=>!fields.includes(k)))fail('Saved state, balances and outcomes cannot be uploaded.');
  if(!UUID.test(body.leaseId||''))fail('A valid gameplay session is required.');
  if(!acquire){
    if(!['house','airport','campaign','football','session'].includes(body.scope)||typeof body.action!=='string'||!body.action||body.action.length>64)fail('Unknown gameplay command.');
    if(!UUID.test(body.requestId||''))fail('A unique request identifier is required.');
    if(!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)fail('A current save revision is required.');
    if(!body.args||typeof body.args!=='object'||Array.isArray(body.args))fail('Use bounded action arguments.');
    function walk(value,depth=0,path=[]){if(depth>10)fail('Action arguments are too deeply nested.');if(Array.isArray(value)&&value.length>128)fail('Action argument list is too large.');if(value&&typeof value==='object'){for(const [key,item]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))fail('Unsupported argument key.');const imageLimit=body.scope==='house'&&body.action==='profile-save'&&path.length===0&&key==='picture'?350000:body.scope==='football'&&body.action==='startClub'&&path.length===3&&path[0]==='args'&&path[1]==='0'&&path[2]==='crest'&&['logoData','imageData'].includes(key)?140000:0;if(imageLimit&&typeof item==='string'&&item.length<=imageLimit&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(item))continue;walk(item,depth+1,[...path,key]);}}else if(typeof value==='string'&&value.length>1000)fail('Action text is too long.');}
    walk(body.args);
  }
  return body;
}
export async function commandDigest(body){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({scope:body.scope,action:body.action,args:body.args})));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
