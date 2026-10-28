import '../shared/messages.js';
import '../shared/i18n.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
export function createMenus({ notify }) {
  const $ = id => document.getElementById(id);
  let openSiteMenu = null;
  function actionButton(label, text, action) {
    const button=document.createElement('button');
    button.type='button'; button.className='tab-action'; button.textContent=text;
    button.title=label; button.setAttribute('aria-label',label);
    button.addEventListener('click',async()=>{
      button.disabled=true;
      try { await action(); } catch { notify(t('Could not complete the action. Try again.')); }
      finally { button.disabled=false; }
    });
    return button;
  }
  function closeSiteMenus(restoreFocus=false) {
    openSiteMenu=null;
    for(const menu of document.querySelectorAll('.site-menu[open]')) {
      menu.open=false;
      try {menu.querySelector('[popover]')?.hidePopover();} catch {}
      if(restoreFocus) menu.querySelector('summary')?.focus();
    }
  }
  // One native disclosure owner for panel, group, saved-site and tab actions.
  function configureMenu(menu,key,summary,actions,scrollOwner='spaces-scroll') {
    menu.dataset.menuKey=key;
    const floating=typeof actions.showPopover==='function';
    if(floating) actions.setAttribute('popover','manual');
    menu.showActions=()=>{
      if(!menu.open) return;
      if(floating) {
        try {actions.showPopover();} catch {}
        const anchor=summary.getBoundingClientRect(),popup=actions.getBoundingClientRect();
        const width=globalThis.innerWidth||320,height=globalThis.innerHeight||600;
        const left=Math.max(8,Math.min(anchor.right-popup.width,width-popup.width-8));
        const top=anchor.bottom+5+popup.height<=height-8?anchor.bottom+5:Math.max(8,anchor.top-popup.height-5);
        actions.style.setProperty('--menu-left',left+'px');actions.style.setProperty('--menu-top',top+'px');
      } else {
        const rect=actions.getBoundingClientRect(),bounds=$(scrollOwner).getBoundingClientRect();
        menu.classList.toggle('opens-up',rect.bottom>Math.min(globalThis.innerHeight||600,bounds.bottom));
      }
    };
    menu.addEventListener('toggle',()=>{
      if(!menu.isConnected) return;
      if(menu.open) {
        for(const other of document.querySelectorAll('.site-menu[open]')) if(other!==menu) {
          other.open=false;try {other.querySelector('[popover]')?.hidePopover();} catch {}
        }
        openSiteMenu=key;menu.showActions();
      } else {
        if(openSiteMenu===key) openSiteMenu=null;
        if(floating) {try {actions.hidePopover();} catch {}}
      }
    });
    return menu;
  }
  function actionMenu(key,label,commands,scrollOwner='spaces-scroll') {
    const menu=document.createElement('details');menu.className='site-menu';menu.open=openSiteMenu===key;
    const summary=document.createElement('summary');summary.textContent='⋯';summary.title=label;
    summary.setAttribute('aria-label',label);summary.dataset.focusKey='menu-'+key;
    const actions=document.createElement('div');actions.className='site-menu-actions';
    const error=document.createElement('p');error.className='error';error.hidden=true;error.setAttribute('role','alert');
    for(const command of commands) {
      const button=actionButton(command.label,command.label,async()=>{
        error.hidden=true;
        if(command.dialog) {closeSiteMenus(true);summary.focus({preventScroll:true});}
        try {await command.run();if(!command.dialog) closeSiteMenus();}
        catch(cause) {error.textContent=t(command.error||cause.message||'Could not complete the action. Try again.');error.hidden=false;}
      });
      button.dataset.focusKey=command.key;
      if(command.danger) button.classList.add('remove-saved-site');
      actions.append(button);
    }
    actions.append(error);menu.append(summary,actions);
    return configureMenu(menu,key,summary,actions,scrollOwner);
  }
  return {actionMenu,closeSiteMenus,configureMenu,get openKey(){return openSiteMenu;},set openKey(value){openSiteMenu=value;}};
}
