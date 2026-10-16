export async function prepareOffline(onProgress){
  if(!('serviceWorker' in navigator))throw Error('Offline installation is unavailable in this browser. Use localhost or HTTPS.');
  onProgress('Saving app and English OCR assets… Keep this tab open.');
  const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
  await registration.update();
  const worker=registration.installing||registration.waiting||registration.active;
  if(!worker)throw Error('Offline setup could not start.');
  if(worker.state==='installing')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offline setup took too long. Try again when online.')),180000);worker.addEventListener('statechange',()=>{if(worker.state==='installed'||worker.state==='activated'){clearTimeout(timer);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Offline setup failed. Check storage space and your connection.'));}});});
  onProgress(registration.waiting?'Update downloaded. Close all app tabs, then reopen to use the new version.':'Offline assets are ready. You can reopen this app at the same address without a network connection.');
}
