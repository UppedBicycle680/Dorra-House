// Optional existing-account dialog. Credentials are sent directly to Dorra's
// login endpoint; passwords are never persisted.
export function createEstateAccount({cloud, onChange = () => {}}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'estate-account-dialog';
  dialog.setAttribute('aria-labelledby','estateAccountTitle');
  dialog.innerHTML = `<div class="estate-account-card">
    <button class="estate-account-close" type="button" aria-label="Close account window">×</button>
    <p class="estate-account-kicker">Dorra House account</p>
    <h2 id="estateAccountTitle">Your estate, wherever you play.</h2>
    <p class="estate-account-lead">Connect an existing Dorra account to play with its saved estate and account balance. Your local estate and casino balance stay separate.</p>
    <div class="estate-account-current" hidden><strong></strong><p>Estate decisions save securely to your Dorra account. Managers keep earning for up to eight hours away, or ten with a Level 3 hotel.</p><div class="estate-account-buttons"><button type="button" data-account-refresh>Refresh cloud save</button><button type="button" data-account-disconnect>Return to local estate</button></div></div>
    <form class="estate-account-form">
      <label for="estateAccountUsername">Dorra username</label>
      <input id="estateAccountUsername" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="24" pattern="[a-zA-Z0-9_]{3,24}" required>
      <label for="estateAccountPassword">Password</label>
      <input id="estateAccountPassword" name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" required>
      <button type="submit">Connect account</button>
      <button class="estate-account-resume" type="button" hidden>Reconnect this account</button>
      <p class="estate-account-note">Use the username and password for your existing Dorra account. You can keep playing locally without an account.</p>
    </form>
    <p class="estate-account-message" role="status" aria-live="polite"></p>
  </div>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form'), current = dialog.querySelector('.estate-account-current'), message = dialog.querySelector('.estate-account-message');
  let busy = false, destroyed = false;
  function render() {
    form.hidden = cloud.connected;
    current.hidden = !cloud.connected;
    current.querySelector('strong').textContent = cloud.connected ? 'Connected as ' + (cloud.username || 'House member') : '';
    dialog.querySelector('.estate-account-resume').hidden = !cloud.remembered;
    dialog.querySelectorAll('input,button:not(.estate-account-close)').forEach(node => {node.disabled = busy});
  }
  async function run(operation, success) {
    if (busy) return;
    busy = true; message.textContent = 'Connecting…'; message.classList.remove('error'); render();
    try {
      await operation();
      if (!destroyed) {message.textContent = success; onChange(); if (cloud.connected) dialog.close()}
    } catch(error) {
      if (!destroyed) {message.textContent = error.message; message.classList.add('error')}
    } finally {busy = false; if (!destroyed) {form.elements.password.value = ''; render()}}
  }
  form.addEventListener('submit',event => {
    event.preventDefault();
    const user = form.elements.username.value, password = form.elements.password.value;
    void run(() => cloud.login(user,password),'Your cloud estate is connected.');
  });
  dialog.querySelector('.estate-account-close').addEventListener('click',()=>dialog.close());
  dialog.querySelector('.estate-account-resume').addEventListener('click',()=>void run(()=>cloud.resume(),'Your cloud estate is connected.'));
  dialog.querySelector('[data-account-refresh]').addEventListener('click',()=>void run(()=>cloud.refresh(),'Cloud save refreshed.'));
  dialog.querySelector('[data-account-disconnect]').addEventListener('click',()=>void run(()=>cloud.disconnect(),'Your local estate is ready.'));
  dialog.addEventListener('click',event => {if(event.target === dialog) {const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close()}});
  dialog.addEventListener('close',()=>{form.elements.password.value = ''});
  return Object.freeze({
    show() {if(destroyed)return;message.textContent='';message.classList.remove('error');render();if(!dialog.open)dialog.showModal();if(!cloud.connected)form.elements.username.focus()},
    destroy() {destroyed=true;dialog.close();dialog.remove()}
  });
}
