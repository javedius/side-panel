import '../shared/messages.js';
import '../shared/i18n.js';
const t=(key,values)=>globalThis.SpaceI18n.t(key,values);
export function createDragAndDrop({closeSiteMenus,moveItem,notify,isBusy,onDragEnd}) {
  let draggedItem=null,dropTarget=null;
  const dragToken=crypto.randomUUID();
  function clearDrop() {if(dropTarget){delete dropTarget.dataset.dropPosition;dropTarget=null;}}
  function bindDrag(node,item) {
    node.draggable=true;node.setAttribute('draggable','true');
    node.addEventListener('dragstart',event=>{
      if(isBusy()||!event.dataTransfer){event.preventDefault();return;}
      closeSiteMenus();draggedItem=item;node.classList.add('dragging');
      event.dataTransfer.effectAllowed=item.kind==='tab'?'copy':'move';
      event.dataTransfer.setData('application/x-space-item',JSON.stringify({...item,token:dragToken}));
    });
    node.addEventListener('dragend',()=>{draggedItem=null;node.classList.remove('dragging');clearDrop();onDragEnd();});
  }
  function bindDrop(node,getDestination) {
    const destination=event=>{
      const value=getDestination();
      if(value.beforeId) {
        const bounds=node.getBoundingClientRect();
        value.after=node.classList.contains('tile-wrap')?event.clientX>bounds.left+bounds.width/2:event.clientY>bounds.top+bounds.height/2;
      }
      return value;
    };
    node.addEventListener('dragover',event=>{
      if(!draggedItem||isBusy()) return;
      event.preventDefault();event.stopPropagation();clearDrop();dropTarget=node;
      const target=destination(event);node.dataset.dropPosition=target.beforeId?(target.after?'after':'before'):'inside';
      if(event.dataTransfer)event.dataTransfer.dropEffect=draggedItem.kind==='tab'?'copy':'move';
    });
    node.addEventListener('dragleave',()=>{if(dropTarget===node)clearDrop();});
    node.addEventListener('drop',async event=>{
      if(!draggedItem||isBusy()) return;
      event.preventDefault();event.stopPropagation();clearDrop();
      let payload;try {payload=JSON.parse(event.dataTransfer.getData('application/x-space-item'));}catch{return;}
      if(payload.token!==dragToken||payload.kind!==draggedItem.kind||payload.id!==draggedItem.id) return;
      const source=draggedItem;draggedItem=null;
      try {await moveItem(source,destination(event));}
      catch(error){notify(t(error.message||'Could not move the site. Try again.'));}
    });
  }
  return {bindDrag,bindDrop,get isDragging(){return Boolean(draggedItem);}};
}
