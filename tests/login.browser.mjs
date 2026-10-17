import test from 'node:test';
import assert from 'node:assert/strict';
import {baseURL, supabaseHost, responseHeaders, launchBrowser, serveSource} from './browser-helpers.mjs';

test('real login ignores inactive signup fields and supports confirmation and recovery', {timeout: 120000}, async () => {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    const requests = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== supabaseHost) return serveSource(route);
      if (request.method() === 'OPTIONS') {
        await route.fulfill({status: 204, headers: responseHeaders, body: ''});
        return;
      }
      requests.push({path: url.pathname, body: request.postDataJSON()});
      const confirmedRequired = url.pathname === '/auth/v1/token';
      await route.fulfill({status: confirmedRequired ? 400 : 200, headers: responseHeaders, body: JSON.stringify(confirmedRequired ? {msg: 'Email not confirmed', error_code: 'email_not_confirmed'} : {})});
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + 'login.html');
    await page.waitForFunction(() => document.querySelector('#signUpTab').onclick !== null);
    await page.locator('#signUpTab').click();
    await page.locator('#username').fill('bad username');
    await page.locator('#repeatPassword').fill('1');
    await page.locator('#signInTab').click();
    await page.locator('#email').fill('account@example.test');
    await page.locator('#password').fill('password123');
    assert.equal(await page.evaluate(() => document.querySelector('#accountForm').checkValidity()), true, 'Hidden invalid signup fields must not prevent signing in');
    assert.equal(await page.locator('#username').isDisabled(), true);
    assert.equal(await page.locator('#repeatPassword').isDisabled(), true);
    await page.locator('#submitAccount').click();
    await page.waitForFunction(() => document.querySelector('#accountMessage').textContent.includes('Email not confirmed'));
    assert.equal(await page.locator('#resendConfirmation').isVisible(), true);
    assert.deepEqual(requests[0], {path: '/auth/v1/token', body: {email: 'account@example.test', password: 'password123', gotrue_meta_security: {}}});
    await page.locator('#resendConfirmation').click();
    await page.waitForFunction(() => document.querySelector('#accountMessage').textContent.includes('new confirmation email'));
    assert.equal(requests[1].path, '/auth/v1/resend');
    assert.equal(requests[1].body.email, 'account@example.test');
    await page.locator('#password').fill('1');
    await page.locator('#forgotPassword').click();
    assert.equal(await page.locator('#password').isDisabled(), true);
    assert.equal(await page.evaluate(() => document.querySelector('#accountForm').checkValidity()), true, 'Hidden invalid password must not prevent account recovery');
    await page.locator('#submitAccount').click();
    await page.waitForFunction(() => document.querySelector('#accountMessage').textContent.includes('reset link has been requested'));
    assert.equal(requests[2].path, '/auth/v1/recover');
    assert.equal(requests[2].body.email, 'account@example.test');
    await page.locator('#backToSignIn').click();
    assert.equal(await page.locator('#password').isDisabled(), false);
    assert.equal(await page.locator('#username').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
