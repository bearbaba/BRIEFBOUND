import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import sources from "../../../lib/contract-sources.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const RPC="https://studio.genlayer.com/api";
const headers={"Cache-Control":"no-store, max-age=0"};
async function schema(name:keyof typeof sources,methods:string[]){
 const code=Buffer.from(sources[name],"utf8");
 const sha256=createHash("sha256").update(code).digest("hex");
 try{
  const res=await fetch(RPC,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"gen_getContractSchemaForCode",params:["0x"+code.toString("hex")]}),cache:"no-store",signal:AbortSignal.timeout(25000)});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json() as {result?:unknown;error?:{message?:string}};
  if(data.error||!data.result)throw Error(data.error?.message||"Missing schema");
  const parsed=typeof data.result==="string"?JSON.parse(data.result):data.result;
  if(!parsed||typeof parsed!=="object")throw Error("Invalid schema");
  const encoded=JSON.stringify(parsed);
  const missing=methods.filter(method=>!encoded.includes('"'+method+'"'));
  if(missing.length)throw Error("Schema missing "+missing.join(", "));
  return {name,sha256,ok:true,methods};
 }catch(e){return {name,sha256,ok:false,error:String(e).slice(0,1500)};}
}
export async function GET(){
 const contracts=await Promise.all([schema("ScopeAnchor",["create_brief","approve_version","get_version","get_active_version","get_protocol_version","cancel_amendment"]),schema("ChangeDesk",["adjudicate","get_decision","get_anchor_address"])]);
 return NextResponse.json({ok:contracts.every(c=>c.ok),network:"Studionet",kind:"read-only schema load; no constructor or signed writes",contracts,checkedAt:new Date().toISOString()},{headers});
}
