export const DEMO={brief:"brief-mwvm2cli",v1:"decision-mwvm2cli-v1",v2:"brief-mwvm2cli-decision-v2",round:"round-mwvm2cli"} as const;
export const validId=(x:string)=>x.length>=1&&x.length<=64&&x.trim()===x&&!x.includes(":")&&!/[\x00-\x1f\x7f]/.test(x);
export const validWallet=(x:string)=>/^0x[0-9a-fA-F]{40}$/.test(x)&&!/^0x0{40}$/.test(x);
export const same=(a:unknown,b:unknown)=>typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===b.toLowerCase();
export const newId=(prefix:string)=>prefix+"-"+crypto.randomUUID().replaceAll("-","").slice(0,20);
export function workspaceLink(origin:string,brief:string,version:number,decision:string,round:string){
 const url=new URL("/",origin);url.searchParams.set("brief",brief);url.searchParams.set("v",String(version));if(validId(decision))url.searchParams.set("decision",decision);if(validId(round))url.searchParams.set("round",round);return url.toString();
}
export function parseWorkspace(search:string){
 const q=new URLSearchParams(search),brief=q.get("brief")||"",v=Number(q.get("v")||1),decision=q.get("decision")||"",round=q.get("round")||"";
 if(!validId(brief))return null;return {brief,version:Number.isInteger(v)&&v>0&&v<=100000?v:1,decision:validId(decision)?decision:"",round:validId(round)?round:""};
}
export type ReadResult={found:boolean;value?:unknown};
export type StateReader=(method:string,id:string,version?:number)=>Promise<ReadResult>;
export const fetchState:StateReader=async(method,id,version)=>{
 if(!validId(id))throw Error("Enter a valid ID (1–64 characters, no colon).");
 const q=new URLSearchParams({method,id});if(version!==undefined)q.set("version",String(version));
 const res=await fetch("/api/read-state?"+q,{cache:"no-store",signal:AbortSignal.timeout(25000)});
 const data=await res.json() as ReadResult&{error?:string};if(!res.ok||typeof data.found!=="boolean")throw Error(data.error||"Unable to read contract state.");return data;
};
export function requireRecord(result:ReadResult):Record<string,unknown>{
 if(!result.found||!result.value||typeof result.value!=="object"||Array.isArray(result.value))throw Error("Record not found. Check the ID and version.");
 return result.value as Record<string,unknown>;
}
function numberResult(x:ReadResult){if(!x.found||typeof x.value!=="number"||!Number.isInteger(x.value))throw Error("Unable to verify version or allowance.");return x.value;}
export async function loadWorkspace(id:string,reader:StateReader=fetchState){
 const [latest,active]=await Promise.all([reader("get_latest_version",id),reader("get_active_version",id)]);
 const version=numberResult(latest),activeVersion=numberResult(active);if(version<1)throw Error("No brief found with this ID. Ask the client to create it first.");
 const record=requireRecord(await reader("get_version",id,version));if(record.brief_id!==id||record.version!==version||!validWallet(String(record.client))||!validWallet(String(record.freelancer))||typeof record.source!=="string")throw Error("Unexpected brief record.");
 return {record,version,activeVersion};
}
export async function preflight(method:string,args:(string|number)[],signer:string,selectedBrief:string,reader:StateReader=fetchState){
 const id=String(args[0]??"");if(!validId(id)||!validWallet(signer))throw Error("Invalid ID or signer.");
 if(method==="create_brief"){
  const [_,source,client,freelancer]=args.map(String);
  if(!validWallet(client)||!validWallet(freelancer)||same(client,freelancer)||!same(client,signer))throw Error("Use the client wallet and a distinct valid freelancer wallet.");
  if(!source.trim()||source.length>6000)throw Error("Scope must contain 1–6000 characters.");
  if(numberResult(await reader("get_latest_version",id))!==0)throw Error("Brief already exists. Load it instead.");return;
 }
 let brief=id,version=Number(args[1]),round:Record<string,unknown>|undefined;
 if(method==="adjudicate"||method==="propose_round"){brief=String(args[1]);version=Number(args[2]);}
 if(method==="confirm_round"){
  round=requireRecord(await reader("get_round",id));brief=String(round.brief_id);version=Number(round.version);
  if(brief!==selectedBrief)throw Error("This round belongs to a different brief. Load that workspace first.");
 }
 if(!validId(brief))throw Error("Invalid brief ID.");
 if(method==="propose_amendment"){
  const {record,version:latest,activeVersion}=await loadWorkspace(brief,reader);
  if(!activeVersion)throw Error("Both parties must approve the initial scope first.");
  if(latest!==activeVersion&&!record.cancelled)throw Error("Approve or cancel the pending amendment first.");
  if(!same(signer,record.client)&&!same(signer,record.freelancer))throw Error("Only the two signatories can amend the scope.");
  const source=String(args[1]??"");if(!source.trim()||source.length>6000)throw Error("Replacement must contain 1–6000 characters.");
  return;
 }
 if(!Number.isInteger(version)||version<1||version>100000)throw Error("Choose a valid version.");
 const r=requireRecord(await reader("get_version",brief,version));
 if(!same(signer,r.client)&&!same(signer,r.freelancer))throw Error("This wallet is not a signatory. Switch to the client or freelancer wallet.");
 if(method==="approve_version"||method==="cancel_amendment"){
  if(numberResult(await reader("get_latest_version",brief))!==version||r.locked||r.cancelled)throw Error("Only the latest unsigned draft can be approved or cancelled.");
  if(method==="approve_version"&&(same(signer,r.client)?r.client_approved:r.freelancer_approved))throw Error("Your approval is already recorded. Share the workspace with the other signer.");
  if(method==="cancel_amendment"&&version===1)throw Error("Only pending amendments can be cancelled.");return;
 }
 if(r.locked!==true||r.cancelled)throw Error("Both parties must approve this version before proceeding.");
 if(method==="adjudicate"){
  const message=String(args[3]??"");if(!message.trim()||message.length>2500)throw Error("Change request must contain 1–2500 characters.");
  if((await reader("get_decision",id)).found)throw Error("Decision ID already exists. Generate a new ID to request a new decision.");return;
 }
 if(method==="propose_round"||method==="confirm_round"){
  if(numberResult(await reader("get_active_version",brief))!==version)throw Error("Revision rounds require the active locked version.");
  if(numberResult(await reader("get_remaining_rounds",brief,version))<=0)throw Error("No revision round remains.");
  if(method==="confirm_round"&&(round?.started||same(signer,round?.proposed_by)))throw Error("The other signer must confirm an unstarted round.");
  if(method==="propose_round"&&(await reader("get_round",id)).found)throw Error("Round ID already exists. Generate a new ID.");return;
 }
 throw Error("Unsupported action.");
}
