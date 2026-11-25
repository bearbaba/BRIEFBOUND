import {NextResponse} from "next/server";
import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
import {createHash} from "node:crypto";
import sources from "../../../lib/contract-sources.json";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const anchor=process.env.NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS||"";
const desk=process.env.NEXT_PUBLIC_CHANGE_DESK_ADDRESS||"";
const rpc="https://studio.genlayer.com/api";
const valid=(s:string)=>/^0x[0-9a-fA-F]{40}$/.test(s);
async function call(method:string,params:unknown[]){
 const response=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("HTTP "+response.status);
 const data=await response.json() as {result?:unknown;error?:{message?:string}};
 if(data.error||data.result==null)throw Error(data.error?.message||"Missing RPC result");
 return data.result;
}
async function inspect(name:keyof typeof sources,address:string){
 try{
  const [code,schema]=await Promise.all([call("gen_getContractCode",[address]),call("gen_getContractSchema",[address])]);
  const raw=typeof code==="string"?code:"";
  const candidates=[raw];
  if(/^0x[0-9a-fA-F]+$/.test(raw))candidates.push(Buffer.from(raw.slice(2),"hex").toString("utf8"));
  if(/^[A-Za-z0-9+/=]+$/.test(raw))candidates.push(Buffer.from(raw,"base64").toString("utf8"));
  const exact=candidates.find(s=>s===sources[name]);
  const normalized=candidates.find(s=>s.replace(/\r\n/g,"\n").trimEnd()===sources[name].replace(/\r\n/g,"\n").trimEnd());
  const expected=name==="ScopeAnchor"?["create_brief","approve_version","get_version","get_active_version","get_protocol_version","cancel_amendment"]:["adjudicate","get_decision","get_anchor_address"];
  const abi=typeof schema==="string"?schema:JSON.stringify(schema);
  const schemaOk=expected.every(m=>abi.includes('"'+m+'"'));
  return {name,address,codeReadable:!!raw&&raw!=="0x",sourceMatch:!!exact,normalizedSourceMatch:!!normalized,schemaOk,expectedSha256:createHash("sha256").update(sources[name]).digest("hex"),observedRunner:candidates.find(s=>s.includes("py-genlayer:"))?.match(/py-genlayer:[a-z0-9]+/)?.[0]||null};
 }catch(e){return {name,address,codeReadable:false,sourceMatch:false,normalizedSourceMatch:false,schemaOk:false,error:String(e).slice(0,500)};}
}
export async function GET(){
 if(!valid(anchor)||!valid(desk)||anchor.toLowerCase()===desk.toLowerCase())return NextResponse.json({ok:false,error:"Invalid or missing deployment addresses."},{status:503});
 const contracts=await Promise.all([inspect("ScopeAnchor",anchor),inspect("ChangeDesk",desk)]);
 let linkedAnchor="",pairError="";
 try{
  const client=createClient({chain:studionet});
  const value=await client.readContract({address:desk as `0x${string}`,functionName:"get_anchor_address",args:[]});
  linkedAnchor=String(value);
 }catch(e){pairError=String(e).slice(0,500);}
 const pairMatches=linkedAnchor.toLowerCase()===anchor.toLowerCase();
 const ok=pairMatches&&contracts.every(c=>c.codeReadable&&c.schemaOk&&c.normalizedSourceMatch);
 return NextResponse.json({ok,network:"Studionet",anchor,desk,linkedAnchor,pairMatches,pairError,contracts,checkedAt:new Date().toISOString(),kind:"read-only verification; not a signed workflow test"},{headers:{"Cache-Control":"no-store, max-age=0"}});
}
