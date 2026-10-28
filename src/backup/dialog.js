import '../shared/messages.js';
import '../shared/i18n.js';
import './model.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
export function installBackup({readData,applyData,notify}) {
  const $=id=>document.getElementById(id),dialog=$('backup-dialog');
  let staged=null,previous=null,opener=null,busy=false,revision=0,operationId=null;
  const error=message=>{$('backup-error').textContent=t(message);};
  function preview(data,name) {
    staged=SpaceBackup.validateData(data);
    operationId=crypto.randomUUID();
    $('backup-filename').textContent=name;
    SpaceI18n.text($('backup-summary'),'Favorites: {favorites} · Spaces: {spaces} · Sites: {sites}',{favorites:staged.sites.filter(site=>site.section==='favorites').length,spaces:staged.spaceConfig.spaces.length,sites:staged.sites.length});
    $('backup-preview').hidden=false;error('');$('backup-preview-cancel').focus();
  }
  function reset() {staged=null;operationId=null;$('backup-preview').hidden=true;$('backup-file').value='';}
  function close() {if(busy) return;++revision;dialog.close();reset();if(opener?.isConnected)opener.focus();else $('panel-menu-trigger').focus();}
  async function open() {
    opener=document.activeElement;reset();error('');previous=null;++revision;
    const request=revision;$('backup-restore').hidden=true;dialog.showModal();$('backup-export').focus();
    try {
      const saved=await readData();
      if(request!==revision) return;
      if(saved.backupBeforeImport) {
        previous=SpaceBackup.parse(JSON.stringify(saved.backupBeforeImport));$('backup-restore').hidden=false;
      }
    } catch { /* A malformed previous snapshot never blocks export/import of a file. */ }
  }
  $('backup-open').addEventListener('click',open);
  $('backup-close').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  $('backup-choose').addEventListener('click',()=>{if(!busy){$('backup-file').value='';$('backup-file').click();}});
  $('backup-file').addEventListener('change',async()=>{
    const file=$('backup-file').files?.[0];if(!file||busy) return;
    const request=++revision;reset();error('');
    if(file.size>SpaceBackup.MAX_BYTES){error(t('The file must be no larger than 2 MB.'));return;}
    try {
      const text=await file.text().catch(()=>{throw Error(t('Could not read the file. Choose it again.'));});if(request!==revision||!dialog.open) return;
      preview(SpaceBackup.parse(text),file.name);
    } catch(e) {if(request===revision&&dialog.open)error(e.message||t('Could not read the file. Choose it again.'));}
  });
  $('backup-preview-cancel').addEventListener('click',()=>{if(!busy){++revision;reset();$('backup-choose').focus();}});
  $('backup-restore').addEventListener('click',()=>{if(previous&&!busy){++revision;preview(previous,t('Data before the last import'));}});
  $('backup-export').addEventListener('click',async()=>{
    if(busy) return;$('backup-export').disabled=true;error('');
    let url;
    try {
      const data=await readData();const copy=SpaceBackup.create(data);
      const blob=new Blob([JSON.stringify(copy,null,2)],{type:'application/json'});
      if(blob.size>SpaceBackup.MAX_BYTES) throw Error('The backup exceeds 2 MB. Remove some sites before exporting.');
      url=URL.createObjectURL(blob);
      const link=document.createElement('a');link.href=url;link.download='space-backup-'+copy.exportedAt.slice(0,10)+'.json';link.click();
      notify(t('Backup downloaded'));
    } catch(e) {error(e.message?.startsWith('The backup')?e.message:t('Could not create a backup. Try again.'));}
    finally {if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);$('backup-export').disabled=false;}
  });
  $('backup-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!staged||busy) return;
    busy=true;++revision;error('');
    for(const id of ['backup-confirm','backup-close','backup-preview-cancel','backup-choose','backup-restore','backup-export'])$(id).disabled=true;
    try {
      // applyData must start synchronously to retain the confirmation's native-panel activation.
      const result=await applyData(staged,operationId);
      if(result?.error) throw Error(result.error);
      previous=null;busy=false;close();notify(t(result?.warning||'Backup restored'));
    } catch(e) {error(e.message||t('Could not restore the backup. Try again.'));}
    finally {
      busy=false;for(const id of ['backup-confirm','backup-close','backup-preview-cancel','backup-choose','backup-restore','backup-export'])$(id).disabled=false;
    }
  });
  return {open};
}
