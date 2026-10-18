export const pageRefreshRequired='Extension connection was reset. Refresh Papertrade to reconnect. Check native Positions and Status for pending actions.';
const refreshError=()=>Object.assign(Error(pageRefreshRequired),{code:'PAPERTRADE_REFRESH_REQUIRED'});
// An invalidated content-script context cannot reconnect until its page reloads.
// Never retry a message here: a missing response does not prove no action occurred.
export function createPageMessenger(getRuntime) {
  let invalidated=false;
  return async message=>{
    if(invalidated)throw refreshError();
    try{
      const runtime=getRuntime();
      if(!runtime?.id||typeof runtime.sendMessage!=='function'){invalidated=true;throw refreshError();}
      return await runtime.sendMessage(message);
    }catch(error){
      if(invalidated||/extension context (?:has been )?invalidated/i.test(error?.message??String(error))){invalidated=true;throw refreshError();}
      throw error;
    }
  };
}
