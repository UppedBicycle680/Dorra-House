import {adminRequest} from './admin-client.js';

export function startPlayerPulse({leaseId,onEnded}) {
 const dialog=document.createElement('dialog');dialog.className='online-announcement';dialog.setAttribute('aria-labelledby','announcementTitle');
 const title=document.createElement('h2');title.id='announcementTitle';const text=document.createElement('p'),expiry=document.createElement('small'),dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent='Dismiss';
 dialog.append(title,text,expiry,dismiss);document.body.append(dialog);
 let closed=false,inFlight=false,message=null,expiryTimer,timer;
 const locallyDismissed=new Set();
 const hide=()=>{clearTimeout(expiryTimer);dialog.close();message=null;};
 dismiss.onclick=()=>{if(!message)return;const id=message.id;locallyDismissed.add(id);hide();void adminRequest('dismiss',{messageId:id}).catch(()=>{});};
 dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss.click();});
 async function pulse(){
  if(closed||inFlight)return;inFlight=true;
  try{
   const data=await adminRequest('pulse',{leaseId,visible:!document.hidden});if(closed)return;
   if(document.hidden){hide();return;}
   const next=(data.messages||[]).find(m=>!locallyDismissed.has(m.id));
   if(!next){hide();return;}
   if(message?.id===next.id)return;
   if(document.querySelector('dialog[open]')&& !dialog.open)return;
   const remaining=new Date(next.expiresAt)-new Date(data.serverNow);if(remaining<=0)return;
   hide();message=next;title.textContent=next.title;text.textContent=next.message;expiry.textContent='Temporary message from the House owner';dialog.showModal();
   expiryTimer=setTimeout(()=>{locallyDismissed.add(next.id);hide();},remaining);
  }catch(error){if(['AUTH_SESSION_ENDED','UNAUTHORIZED','ACCOUNT_DISABLED','SESSION_REPLACED'].includes(error.code)){stop();onEnded?.(error);}}
  finally{inFlight=false;}
 }
 const visibility=()=>{void pulse();};document.addEventListener('visibilitychange',visibility);
 timer=setInterval(pulse,10000);void pulse();
 function stop(){closed=true;clearInterval(timer);hide();document.removeEventListener('visibilitychange',visibility);dialog.remove();}
 return stop;
}
