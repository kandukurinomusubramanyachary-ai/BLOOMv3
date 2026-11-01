const MEG_SERVICE_CONTRACT=Object.freeze({name:'bloom-meg-v2',version:1,memoryControls:true,accountData:true,persistentFeedback:true});
function compatibleMegService(body){const contract=body?.contract;return body?.provider==='meg-v2'&&contract?.name===MEG_SERVICE_CONTRACT.name&&contract.version===1&&contract.memoryControls===true&&contract.accountData===true&&contract.persistentFeedback===true;}
async function assertMegServiceContract(baseUrl,{signal,fetchImpl=fetch}={}){
  const response=await fetchImpl(baseUrl+'/health',{method:'GET',cache:'no-store',signal});
  let body;try{body=await response.json();}catch{}
  if(![200,503].includes(response.status)||!compatibleMegService(body))throw Object.assign(new Error('Meg needs a service update before it can safely handle your data.'),{code:'meg_backend_upgrade_required'});
  return body;
}
module.exports={MEG_SERVICE_CONTRACT,compatibleMegService,assertMegServiceContract};
