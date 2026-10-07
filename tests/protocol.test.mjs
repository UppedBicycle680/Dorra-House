import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {validateBody,commandDigest,maxRequestBytes,readBoundedBody} from '../supabase/functions/dorra-api/protocol.mjs';
const leaseId=crypto.randomUUID(),requestId=crypto.randomUUID();
const action={scope:'house',action:'casino',leaseId,requestId,expectedRevision:1,args:{game:'bj',move:'start',bet:25}};
test('commands require a current lease, request id and revision',()=>{assert.equal(validateBody(action),action);for(const field of ['leaseId','requestId','expectedRevision'])assert.throws(()=>validateBody({...action,[field]:undefined}));assert.throws(()=>validateBody({...action,args:[]}));});
test('snapshot uploads, arbitrary scopes and prototype payloads are rejected',()=>{assert.throws(()=>validateBody({...action,snapshot:{balance:1e9}}));assert.throws(()=>validateBody({...action,scope:'admin'}));assert.throws(()=>validateBody({...action,args:JSON.parse('{"__proto__":{"balance":100000}}')}));assert.throws(()=>validateBody({...action,args:{text:'x'.repeat(1001)}}));});
test('request hashes bind intent and ignore transport revision retries',async()=>{assert.equal(await commandDigest(action),await commandDigest({...action,expectedRevision:2}));assert.notEqual(await commandDigest(action),await commandDigest({...action,args:{...action.args,bet:50}}));});

const crestCommand = crest => ({...action, scope:'football', action:'startClub', args:{args:[{name:'Cloud Crest Club', crest}]}});
const dataPrefix = 'data:image/jpeg;base64,';

test('a real uploaded football crest passes the protocol with both original UI image fields', async () => {
  // Reproduce the UI's 256-square JPEG at quality .82 with enough detail to
  // exceed both the usual text bound and the ordinary 32 KB command budget.
  const pixels = Buffer.from(Array.from({length:256*256*3}, (_,i) => (i*71+Math.floor(i/768)*53)%256));
  const jpeg = await sharp(pixels, {raw:{width:256,height:256,channels:3}}).jpeg({quality:82}).toBuffer();
  const image = dataPrefix + jpeg.toString('base64');
  assert(image.length > 50_000 && image.length <= 140_000);
  const body = crestCommand({kind:'upload', logoData:image, imageData:image});
  assert(Buffer.byteLength(JSON.stringify(body)) > 32768);
  assert(Buffer.byteLength(JSON.stringify(body)) <= maxRequestBytes(body));
  assert.equal(validateBody(body), body);
});

test('football crest image exceptions stay on the two exact creation paths', () => {
  const image = dataPrefix + 'A'.repeat(2000);
  for (const crest of [{logoData:image}, {imageData:image}, {logoData:image,imageData:image}]) {
    assert.doesNotThrow(() => validateBody(crestCommand(crest)));
  }
  const wrongPaths = [
    {...crestCommand({}), args:{logoData:image}},
    {...crestCommand({}), args:{'args.0.crest.logoData':image}},
    {...crestCommand({}), args:{args:[{name:'Cloud Crest Club',logoData:image}]}},
    crestCommand({dataUrl:image}),
    crestCommand({extra:{logoData:image}}),
    {...crestCommand({}), args:{args:[{name:'Cloud Crest Club'},{crest:{logoData:image}}]}},
    {...crestCommand({}), args:{args:[{name:'x'.repeat(1001),crest:{logoData:image}}]}},
    {...crestCommand({logoData:image}), action:'setClubIdentity'},
    {...crestCommand({logoData:image}), scope:'campaign'},
    {...crestCommand({}), args:{picture:image}}
  ];
  for (const body of wrongPaths) assert.throws(() => validateBody(body), /Action text is too long/);
});

test('football crest exceptions enforce their size bound and raster data-URI format', () => {
  const atLimit = dataPrefix + 'A'.repeat(140000-dataPrefix.length);
  assert.doesNotThrow(() => validateBody(crestCommand({logoData:atLimit,imageData:atLimit})));
  for (const field of ['logoData','imageData']) {
    assert.throws(() => validateBody(crestCommand({[field]:atLimit+'A'})), /Action text is too long/);
    for (const image of [
      'data:image/svg+xml;base64,'+'A'.repeat(2000),
      'data:image/gif;base64,'+'A'.repeat(2000),
      'data:text/html;base64,'+'A'.repeat(2000),
      'https://example.com/'+'A'.repeat(2000),
      dataPrefix+'A'.repeat(2000)+'<script>',
      'data:image/jpeg,'+'A'.repeat(2000)
    ]) assert.throws(() => validateBody(crestCommand({[field]:image})), /Action text is too long/);
  }
});

test('request byte budgets increase only for the two bounded image upload actions', () => {
  assert.equal(maxRequestBytes(crestCommand({})),300000);
  assert.equal(maxRequestBytes({...action,scope:'house',action:'profile-save'}),420000);
  for (const body of [action,
    {...action,scope:'football',action:'setClubIdentity'},
    {...action,scope:'house',action:'startClub'},
    {...action,scope:'football',action:'profile-save'},
    {...action,scope:'campaign',action:'create'},
    {...action,scope:'airport',action:'load'}
  ]) assert.equal(maxRequestBytes(body),32768);
});

test('bounded body reading preserves UTF-8 gameplay text at the exact byte limit', async () => {
  const text = JSON.stringify({name:'Dorra 🌙 日本',message:'Clubs save across devices.'});
  const request = new Request('https://example.test', {method:'POST',body:text});
  assert.equal(await readBoundedBody(request,Buffer.byteLength(text,'utf8')),text);
});

test('bounded body reading rejects actual bytes over its cap with HTTP 413', async () => {
  const text = '✨'.repeat(8);
  assert(text.length < 16 && Buffer.byteLength(text,'utf8') > 16);
  await assert.rejects(readBoundedBody(new Request('https://example.test',{method:'POST',body:text}),16),
    error => error.code === 'PAYLOAD_TOO_LARGE' && error.status === 413);
});
