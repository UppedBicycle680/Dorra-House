import { supabase, siteURL } from './auth-client.js';

const $ = selector => document.querySelector(selector);
const actionLabels = {signin: 'Sign in', signup: 'Create a profile', recovery: 'Send reset link', reset: 'Save password'};
const busyLabels = {signin: 'Signing in…', signup: 'Creating profile…', recovery: 'Sending reset link…', reset: 'Saving password…'};
let mode = 'signin', busy = false, redirecting = false;

function destination() {
  const next = new URLSearchParams(location.search).get('next');
  return siteURL(['index.html', 'football-manager.html', 'war-simulation.html', 'idle-airport.html'].includes(next) ? next : 'index.html');
}
function message(text, error = false) {
  const element = $('#accountMessage');
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle('error', error);
}
function actionState(label = actionLabels[mode], icon = 'arrow') {
  $('#submitLabel').textContent = label;
  $('#submitIcon').src = `assets/login/${icon}.svg`;
}
function setBusy(value) {
  busy = value;
  $('#accountForm').setAttribute('aria-busy', String(value));
  for (const button of document.querySelectorAll('button')) button.disabled = value;
  actionState(value ? busyLabels[mode] : actionLabels[mode], value ? 'loading' : 'arrow');
}
function enterHouse() {
  redirecting = true;
  actionState("You're in", 'success');
  setTimeout(() => location.replace(destination()), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
}
function setMode(next) {
  if (busy) return;
  mode = next;
  message('');
  const signup = next === 'signup', recovery = next === 'recovery', reset = next === 'reset';
  $('.entrance').dataset.mode = next;
  $('#usernameField').hidden = !signup;
  $('#username').required = signup;
  $('#username').disabled = !signup;
  $('#repeatField').hidden = !(signup || reset);
  $('#repeatPassword').required = signup || reset;
  $('#repeatPassword').disabled = !(signup || reset);
  $('#emailField').hidden = reset;
  $('#email').required = !reset;
  $('#email').disabled = reset;
  $('#email').type = 'email';
  $('#email').autocomplete = 'email';
  $('#email').placeholder = 'Enter your email';
  $('#identityLabel').textContent = 'Email';
  $('#passwordField').hidden = recovery;
  $('#password').required = !recovery;
  $('#password').disabled = recovery;
  $('#password').autocomplete = signup || reset ? 'new-password' : 'current-password';
  $('#password').minLength = signup || reset ? 8 : 1;
  $('#password').type = 'password';
  $('#showPassword').setAttribute('aria-label', 'Show password');
  $('#showPassword').setAttribute('aria-pressed', 'false');
  $('#password').value = '';
  $('#repeatPassword').value = '';
  $('#signInTab').setAttribute('aria-pressed', String(next === 'signin'));
  $('#signUpTab').setAttribute('aria-pressed', String(signup));
  $('#signInTab').hidden = !signup;
  $('#signUpTab').hidden = signup;
  $('#accountPrompt').textContent = signup ? 'Already a member?' : 'New here?';
  $('.account-tabs').hidden = recovery || reset;
  $('#forgotPassword').hidden = next !== 'signin';
  $('#backToSignIn').hidden = !(recovery || reset);
  $('#resendConfirmation').hidden = true;
  $('#formTitle').replaceChildren();
  if (next === 'signin') $('#formTitle').append('Sign in to', document.createElement('br'), 'Dorra House');
  else $('#formTitle').textContent = signup ? 'Make yourself at home.' : recovery ? 'Reset your password.' : 'Choose a new password.';
  $('#formCopy').textContent = signup ? 'Create your profile. Begin your story.' : recovery ? 'We’ll send you a link if this email has an account.' : reset ? 'Enter a new password for your Dorra House account.' : 'Welcome back. Continue your story.';
  actionState();
}
$('#signInTab').onclick = () => setMode('signin');
$('#signUpTab').onclick = () => setMode('signup');
$('#forgotPassword').onclick = () => setMode('recovery');
$('#backToSignIn').onclick = () => setMode('signin');
$('#showPassword').onclick = () => {
  const show = $('#password').type === 'password';
  $('#password').type = show ? 'text' : 'password';
  $('#showPassword').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('#showPassword').setAttribute('aria-pressed', String(show));
};

$('#accountForm').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  if ((mode === 'signup' || mode === 'reset') && $('#password').value !== $('#repeatPassword').value) {
    message('The passwords don’t match.', true);
    return;
  }
  const requestedMode = mode, identity = $('#email').value.trim(), password = $('#password').value;
  setBusy(true);
  message('');
  try {
    let response;
    if (requestedMode === 'signup') {
      response = await supabase.auth.signUp({email: identity, password, options: {data: {username: $('#username').value.trim()}, emailRedirectTo: siteURL('login.html').href}});
      if (response.error) throw response.error;
      if (response.data.session) { enterHouse(); return; }
      message('Your profile was created. Confirm your email to sign in.');
      $('#resendConfirmation').hidden = false;
    } else if (requestedMode === 'recovery') {
      response = await supabase.auth.resetPasswordForEmail(identity, {redirectTo: siteURL('login.html?recovery=1').href});
      if (response.error) throw response.error;
      message('If an account exists, a password reset link has been requested.');
    } else if (requestedMode === 'reset') {
      response = await supabase.auth.updateUser({password});
      if (response.error) throw response.error;
      const {error} = await supabase.auth.signOut();
      if (error) throw error;
      setBusy(false);
      setMode('signin');
      message('Password updated. Sign in with your new password.');
    } else {
      response = await supabase.auth.signInWithPassword({email: identity, password});
      if (response.error) throw response.error;
      enterHouse();
    }
  } catch (error) {
    let text = error.message || 'We couldn’t complete that request. Try again.';
    if (/database error saving new user/i.test(text)) text = 'That username may already be taken. Choose another username and try again.';
    if (/email not confirmed/i.test(text) && identity.includes('@')) $('#resendConfirmation').hidden = false;
    if (/email.*rate|smtp|sending confirmation|email address.*authorized/i.test(text)) text = 'Email delivery is unavailable. Please contact the House owner.';
    message(text, true);
  } finally {
    if (!redirecting) setBusy(false);
  }
};
$('#resendConfirmation').onclick = async () => {
  if (busy) return;
  setBusy(true);
  try {
    const {error} = await supabase.auth.resend({type: 'signup', email: $('#email').value.trim(), options: {emailRedirectTo: siteURL('login.html').href}});
    if (error) throw error;
    message('A new confirmation email has been requested.');
  } catch (error) { message(error.message, true); }
  finally { setBusy(false); }
};

supabase.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') {
    setBusy(false);
    setMode('reset');
  }
});
const query = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
const recovery = query.get('recovery') === '1' || hash.get('type') === 'recovery';
setMode(recovery ? 'reset' : 'signin');
try {
  const {data: {session}, error} = await supabase.auth.getSession();
  if (error) throw error;
  if (hash.get('error_description') || (recovery && !session)) {
    setMode('recovery');
    message('That reset link is invalid or expired. Request a new one.', true);
  } else if (!recovery && session) location.replace(destination());
} catch (error) {
  message(error.message || 'We couldn’t restore your session. Please sign in again.', true);
}
