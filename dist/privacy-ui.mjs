import {VaultSession,VaultStore,decryptBundle,inspectEnvelope} from './vault.mjs';
import {escapeHTML as e} from './core.mjs';
const $=s=>document.querySelector(s);
export class PrivacyUI{
  constructor({snapshot,open,close,validate,empty,notify,download}){
    Object.assign(this,{snapshot,open,close,validate,empty,notify,download});this.active=false;this.exists=false;this.busy=false;this.pendingBackup=null;
    this.vault=new VaultSession(new VaultStore(),text=>{$('#save-status').textContent=text;});
    document.addEventListener('click',ev=>{const action=ev.target.closest('[data-private]')?.dataset.private;if(action)this.action(action);});
    $('#privacy-form').addEventListener('submit',ev=>{ev.preventDefault();this.submit();});
    $('#privacy-dialog').addEventListener('cancel',event=>{if(this.busy)event.preventDefault();});
    $('#privacy-dialog').addEventListener('close',()=>{this.pendingBackup=null;$('#privacy-fields').replaceChildren();});
    window.addEventListener('beforeunload',ev=>{if(this.active&&(this.vault.pending||this.vault.error||(this.vault.mode==='session'&&Object.values(this.snapshot().analyses).some(x=>x.transactions.length)))){ev.preventDefault();ev.returnValue='';}});
  }
  async init(){try{this.exists=!!await this.vault.store.read();}catch{this.storageError=true;}this.gate();}
  gate(){
    $('#privacy-gate').hidden=false;$('.shell').hidden=true;
    $('#privacy-gate').innerHTML=`<div class="gate-brand"><span class="brand-icon">s<span>i</span></span> Spend Insights</div><div class="gate-copy"><div class="eyebrow">YOUR MONEY. YOUR DEVICE.</div><h1>Clarity without<br>giving your data away.</h1><p>Read a statement, follow your spending and explore its connections. Processing happens here, on your device.</p></div><div class="gate-options">${this.exists?`<section class="panel"><span class="privacy-number">01</span><h2>Your vault is locked.</h2><p>Unlock the encrypted analyses saved in this browser.</p><button class="button primary" data-private="unlock">Unlock my vault</button></section>`:`<section class="panel"><span class="privacy-number">01</span><h2>Keep a private vault.</h2><p>Save encrypted on this device with a passphrase you control. You’ll need it whenever you reopen the app.</p><button class="button primary" data-private="create" ${this.storageError?'disabled':''}>Create encrypted vault</button></section>`}<section class="panel"><span class="privacy-number">02</span><h2>Just explore for now.</h2><p>Use a temporary session. Your analysis disappears when you close or reload this tab unless you download an encrypted backup.</p><button class="button" data-private="session">Use without saving</button></section></div><div class="gate-foot"><p>${this.storageError?'Device storage is unavailable. Temporary sessions and encrypted file backups still work.':'No account. No statement uploads. No analytics.'} Optional semantic search downloads model files when you enable it.</p><p>A web app served by a host still makes requests for app files. Offline mode removes that need after setup; the host may see ordinary access logs while online.</p></div>`;
  }
  start(bundle){if(!bundle.analyses[bundle.workspaces.active].transactions.length)location.hash='overview';this.active=true;$('#privacy-gate').hidden=true;$('.shell').hidden=false;this.open(bundle);$('#lock-label').textContent=this.vault.mode==='vault'?'Lock vault':'End session';$('#save-status').textContent=this.vault.mode==='vault'?'Saved encrypted on this device':'Temporary session · not saved';}
  save(){this.vault.save(this.snapshot()).catch(error=>this.notify(error.message));}
  dialog(mode,envelope){
    this.mode=mode;this.pendingBackup=envelope||null;const creating=['create','backup'].includes(mode);
    $('#privacy-title').textContent={create:'Create your encrypted vault',unlock:'Unlock your vault',backup:'Protect your backup',restore:'Unlock this backup'}[mode];
    $('#privacy-fields').innerHTML=`<p>${creating?'Choose a long, unique passphrase. There is no password reset; losing it means losing access to this vault or backup.':'Your passphrase is used on this device and is never stored.'}</p><label class="field">Passphrase<input id="vault-passphrase" type="password" required ${creating?'minlength="12"':''} maxlength="1024" autocomplete="off"></label>${creating?'<label class="field">Confirm passphrase<input id="vault-confirm" type="password" required maxlength="1024" autocomplete="off"></label>':''}<div id="privacy-error" class="error-box" hidden role="alert"></div><div class="dialog-actions"><button type="button" class="button" data-private="cancel">Cancel</button><button class="button primary" type="submit">${mode==='restore'?'Decrypt backup':mode==='unlock'?'Unlock':mode==='backup'?'Download encrypted backup':'Create vault'}</button></div>`;
    $('#privacy-dialog').showModal();$('#vault-passphrase').focus();
  }
  async submit(){
    if(this.busy)return;const passphrase=$('#vault-passphrase').value,confirmation=$('#vault-confirm')?.value;
    if(confirmation!==undefined&&confirmation!==passphrase){$('#privacy-error').hidden=false;$('#privacy-error').textContent='The passphrases do not match.';return;}
    this.busy=true;$('#privacy-form [type=submit]').disabled=true;$('#privacy-error').hidden=true;
    try{
      if(this.mode==='create'){const bundle=this.active?this.snapshot():this.empty();await this.vault.create(bundle,passphrase);this.exists=true;this.start(bundle);navigator.storage?.persist?.().catch(()=>{});}
      else if(this.mode==='unlock'){const bundle=this.validate(await this.vault.unlock(passphrase));this.start(bundle);}
      else if(this.mode==='backup'){await this.backup(passphrase);}
      else if(this.mode==='restore'){
        const {bundle}=await decryptBundle(this.pendingBackup,passphrase),valid=this.validate(bundle);
        const count=Object.values(valid.analyses).reduce((n,a)=>n+a.transactions.length,0);
        if(!confirm(`Restore ${count} transactions across ${valid.workspaces.items.length} analyses? This replaces all analyses in your current session. Download a backup first if you need them.`))return;
        this.close();this.start(valid);this.save();this.notify('Backup restored locally.');
      }
      $('#vault-passphrase').value='';if($('#vault-confirm'))$('#vault-confirm').value='';$('#privacy-dialog').close();
    }catch(error){if(!this.active&&this.vault.credentials)this.vault.clear();$('#privacy-error').hidden=false;$('#privacy-error').textContent=error.message;}
    finally{this.busy=false;const button=$('#privacy-form [type=submit]');if(button)button.disabled=false;}
  }
  async backup(passphrase){const envelope=await this.vault.backup(this.snapshot(),passphrase);this.download('spend-insights-backup.sivault',JSON.stringify(envelope),'application/json');this.notify('Encrypted backup downloaded. Keep its passphrase separately.');}
  async restore(file){if(file.size>70*1024*1024)throw Error('This backup is too large.');const envelope=JSON.parse(await file.text());inspectEnvelope(envelope);this.dialog('restore',envelope);}
  async lock(){
    if(this.busy)return;
    if(this.vault.mode==='session'&&Object.values(this.snapshot().analyses).some(a=>a.transactions.length)&&!confirm('End this temporary session and discard its data? Download an encrypted backup first to keep it.'))return;
    this.busy=true;try{await this.vault.lock();this.active=false;this.close();await this.init();}catch(error){this.notify(error.message+' The app remains open so you can save a backup.');}finally{this.busy=false;}
  }
  async action(action){
    if(this.busy)return;
    try{
      if(action==='session'){this.vault.clear();this.start(this.empty());}
      else if(['create','unlock'].includes(action))this.dialog(action);
      else if(action==='cancel')$('#privacy-dialog').close();
      else if(action==='lock')await this.lock();
      else if(action==='backup'){if(this.vault.credentials)await this.backup();else this.dialog('backup');}
      else if(action==='erase'){
        if(!confirm('Delete the encrypted vault stored in this browser and end this session? This cannot be undone without your own backup.'))return;
        await this.vault.erase();this.active=false;this.close();this.exists=false;this.gate();this.notify('The saved vault was deleted from this browser. Downloaded backups are separate.');
      }
      else if(action==='offline'){const {prepareOffline}=await import('./offline.mjs');await prepareOffline(message=>{const el=$('#offline-status');if(el)el.textContent=message;});}
      else if(action==='model-clear'){this.stopModel?.();for(const name of await caches.keys())if(name==='transformers-cache')await caches.delete(name);this.notify('Semantic search stopped and its downloaded model cache removed.');}
    }catch(error){this.notify(error.message);}
  }
  page(){return `<div class="page-heading"><div><div class="eyebrow">PRIVATE BY CHOICE</div><h1>Your data, under your control.</h1><p>Choose what stays on this device and what leaves as a file.</p></div></div><div class="two-col equal"><section class="panel"><h2>${this.vault.mode==='vault'?'Encrypted on this device':'Temporary session'}</h2><p>${this.vault.mode==='vault'?'All analyses, statement rows, labels and category rules are saved together in an encrypted vault. Unlocking keeps the key in memory until you lock or close this tab.':'Your analyses exist in this tab’s memory. Closing or reloading loses them. No transactions, questions or embeddings are written to device storage.'}</p><div class="data-actions"><button class="button primary" data-private="backup">Encrypted backup</button>${this.vault.mode==='vault'?'<button class="button" data-private="lock">Lock this tab</button>':!this.exists?'<button class="button" data-private="create">Save as encrypted vault</button>':''}</div><p class="panel-note">Questions and derived embeddings are memory only. CSV and graph JSON exports are unencrypted. A backup preserves all analyses and category rules. Browser storage can be cleared or evicted; keep a backup.</p></section><section class="panel"><h2>Make it available offline.</h2><p>Save the app, PDF reader and English OCR assets on this device (about 47 MB). Once ready, the core app works without a network connection.</p><button class="button" data-private="offline">Prepare offline access</button><p class="panel-note" id="offline-status" role="status">Offline readiness is checked when you press the button.</p><p class="panel-note">Use your browser’s Install app or Add to Home Screen option if available. This is an installable web app. Semantic search requires a separate optional model download (~207 MB) and WebGPU; enable it online once before using it offline.</p></section></div><section class="panel"><h2>What privacy means here</h2><p>Statements, PDF passwords, queries and embeddings are processed on your device. There is no data API, analytics or cloud chat. The app starts empty. App downloads and optional model downloads still involve network requests; hosting providers may keep access logs.</p><p>Encryption protects the saved vault while it is locked. While unlocked, browser extensions or malicious code with access to this page could read it. Use a trusted browser and device. This edition has functional privacy tests, not an independent security audit.</p><div class="data-actions"><button class="button" data-private="model-clear">Remove downloaded model</button>${this.exists?'<button class="button danger" data-private="erase">Delete device vault</button>':''}</div><p class="panel-note">Deleting the vault removes its browser record; downloaded backups and exports must be deleted separately. It does not promise forensic erasure from your device.</p></section>`;}
}
