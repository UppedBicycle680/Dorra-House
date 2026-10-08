import test from 'node:test';
import assert from 'node:assert/strict';
import {baseURL,supabaseHost,responseHeaders,launchBrowser,serveSource} from './browser-helpers.mjs';

const userId='11111111-1111-4111-8111-111111111111';
const user={id:userId,email:'member@example.test',aud:'authenticated',role:'authenticated',user_metadata:{username:'Dorra_Player'}};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=()=>`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:userId,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.fixture`;

test('profile signup sends the signup-only username and expired recovery links stay usable', {timeout:120000}, async()=>{
  const browser=await launchBrowser();
  try{
    const context=await browser.newContext({reducedMotion:'reduce'}), requests=[];
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname!==supabaseHost)return serveSource(route);
      requests.push({path:url.pathname,body:request.postDataJSON()});
      return route.fulfill({status:200,headers:responseHeaders,body:JSON.stringify({user})});
    });
    const page=await context.newPage();
    await page.goto(baseURL+'login.html');
    await page.waitForFunction(()=>typeof document.querySelector('#accountForm').onsubmit==='function');
    assert.equal(await page.locator('#username').isDisabled(),true);
    await page.locator('#signUpTab').click();
    await page.locator('#username').fill('Dorra_Player');
    await page.locator('#email').fill('member@example.test');
    await page.locator('#password').fill('password123');
    await page.locator('#repeatPassword').fill('password123');
    await page.locator('#submitAccount').click();
    await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent.includes('Confirm your email'));
    assert.equal(requests[0].path,'/auth/v1/signup');
    assert.equal(requests[0].body.email,'member@example.test');
    assert.deepEqual(requests[0].body.data,{username:'Dorra_Player'});
    await page.goto(baseURL+'login.html?recovery=1');
    await page.waitForFunction(()=>document.querySelector('#accountMessage').textContent.includes('expired'));
    assert.equal(await page.locator('#email').isVisible(),true);
    assert.equal(await page.locator('#password').isDisabled(),true);
    assert.equal(await page.locator('#submitLabel').textContent(),'Send reset link');
  }finally{await browser.close();}
});

test('email login shows real pending state, persists a Supabase session and respects safe destinations', {timeout:120000}, async()=>{
  const browser=await launchBrowser();
  try {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const requests=[],errors=[];
    let release;
    const pending=new Promise(resolve=>release=resolve);
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname!==supabaseHost){
        if(url.pathname.endsWith('/war-simulation.html')||url.pathname.endsWith('/index.html'))return route.fulfill({contentType:'text/html',body:'<title>House destination</title><main>Signed in</main>'});
        return serveSource(route);
      }
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:responseHeaders,body:''});
      if(url.pathname==='/auth/v1/token'){
        requests.push(route.request().postDataJSON());
        await pending;
        return route.fulfill({status:200,headers:responseHeaders,body:JSON.stringify({access_token:token(),refresh_token:'refresh-fixture',token_type:'bearer',expires_in:3600,user})});
      }
      assert.equal(url.pathname,'/auth/v1/user');
      return route.fulfill({status:200,headers:responseHeaders,body:JSON.stringify(user)});
    });
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(baseURL+'login.html?next=war-simulation.html');
    await page.waitForFunction(()=>typeof document.querySelector('#accountForm').onsubmit==='function');
    await page.locator('#email').fill('member@example.test');
    await page.locator('#password').fill('password123');
    await page.locator('#showPassword').click();
    assert.equal(await page.locator('#password').getAttribute('type'),'text');
    assert.equal(await page.locator('#showPassword').getAttribute('aria-label'),'Hide password');
    await page.locator('#showPassword').click();
    await page.locator('#submitAccount').click();
    await page.waitForFunction(()=>document.querySelector('#submitLabel').textContent==='Signing in…');
    assert.equal(await page.locator('#submitAccount').isDisabled(),true);
    assert.equal(await page.locator('#signUpTab').isDisabled(),true);
    assert.equal(await page.locator('#accountForm').getAttribute('aria-busy'),'true');
    assert.match(await page.locator('#submitIcon').getAttribute('src'),/loading\.svg$/);
    assert.deepEqual(requests,[{email:'member@example.test',password:'password123',gotrue_meta_security:{}}]);
    release();
    await page.waitForURL(baseURL+'war-simulation.html');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dorra-online-auth')));
    assert.equal(saved.user.id,userId);
    assert.equal(saved.refresh_token,'refresh-fixture');
    assert.deepEqual(errors,[]);
    // A later visit uses the same SDK session and the allowlisted fallback.
    await page.goto(baseURL+'login.html?next=https://other.test');
    await page.waitForURL(baseURL+'index.html');
  } finally {await browser.close();}
});

test('email failure restores controls and recovery keeps the entered email', {timeout:120000}, async()=>{
  const browser=await launchBrowser();
  try{
    const context=await browser.newContext({reducedMotion:'reduce'});
    await context.route('**/*',route=>new URL(route.request().url()).hostname!==supabaseHost?serveSource(route):route.fulfill({status:400,headers:responseHeaders,body:JSON.stringify({msg:'Invalid login credentials',error_code:'invalid_credentials'})}));
    const page=await context.newPage();
    await page.goto(baseURL+'login.html');
    await page.waitForFunction(()=>typeof document.querySelector('#accountForm').onsubmit==='function');
    await page.locator('#email').fill('member@example.test');
    await page.locator('#password').fill('password123');
    await page.locator('#submitAccount').click();
    await page.waitForFunction(()=>!document.querySelector('#accountMessage').hidden);
    assert.equal(await page.locator('#accountMessage').textContent(),'Invalid login credentials');
    assert.equal(await page.locator('#submitAccount').isEnabled(),true);
    assert.equal(await page.locator('#email').inputValue(),'member@example.test');
    assert.equal(await page.locator('#submitLabel').textContent(),'Sign in');
    await page.locator('#forgotPassword').click();
    assert.equal(await page.locator('#email').getAttribute('type'),'email');
    assert.equal(await page.locator('#email').inputValue(),'member@example.test');
    assert.equal(await page.locator('#password').isDisabled(),true);
  }finally{await browser.close();}
});

test('the Figma assets and layout render on desktop and mobile, with one-time and reduced motion', {timeout:120000}, async()=>{
  const browser=await launchBrowser();
  try{
    for(const viewport of [{width:1440,height:1024},{width:390,height:844},{width:320,height:568}]){
      const context=await browser.newContext({viewport,reducedMotion:'reduce'});
      await context.route('**/*',serveSource);
      const page=await context.newPage();
      await page.goto(baseURL+'login.html');
      await page.evaluate(()=>document.fonts.ready);
      assert.equal(await page.title(),'Sign in — Dorra House');
      assert.equal(await page.locator('#formTitle').innerText(),'Sign in to\nDorra House');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.brand')).animationName),'none');
      assert.equal(await page.evaluate(()=>document.fonts.check('500 40px Manrope')),true);
      for(const image of await page.locator('img').evaluateAll(images=>images.map(i=>({loaded:i.complete&&i.naturalWidth>0,width:i.width,height:i.height})))){
        assert.deepEqual(image,{loaded:true,width:20,height:20});
      }
      if(viewport.width===1440){
        assert.deepEqual(await page.locator('#email').boundingBox(),{x:520,y:414,width:400,height:56});
        assert.deepEqual(await page.locator('#submitAccount').boundingBox(),{x:520,y:638,width:400,height:56});
      }
      await context.close();
    }
    const context=await browser.newContext();
    await context.route('**/*',serveSource);
    const page=await context.newPage();
    await page.goto(baseURL+'login.html');
    const timelines=await page.locator('[data-node-id]').evaluateAll(nodes=>nodes.flatMap(node=>node.getAnimations().map(animation=>({duration:animation.effect.getTiming().duration,iterations:animation.effect.getTiming().iterations}))));
    assert.equal(timelines.length,13);
    assert(timelines.every(timeline=>timeline.duration===2000&&timeline.iterations===1));
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.brand')).opacity),'1');
    assert.equal(await page.evaluate(()=>document.getAnimations().some(animation=>animation.playState==='running')),false);
  }finally{await browser.close();}
});
