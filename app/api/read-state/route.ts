import {NextRequest,NextResponse} from "next/server";
import {createClient} from "genlayer-js";
import {studionet} from "genlayer-js/chains";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, max-age=0"};
const methods={get_decision:"change",get_round:"change",get_remaining_rounds:"change",get_version:"scope",get_active_version:"scope"} as const;
export async function GET(req:NextRequest){
 const method=req.nextUrl.searchParams.get("method")||"",id=req.nextUrl.searchParams.get("id")||"",v=Number(req.nextUrl.searchParams.get("version"));
 if(!Object.prototype.hasOwnProperty.call(methods,method)||!id||id.length>128)return NextResponse.json({error:"Unsupported read or missing ID."},{status:400,headers});
 const key=method as keyof typeof methods;
 const versioned=key==="get_version"||key==="get_remaining_rounds";
 if(versioned&&(!Number.isInteger(v)||v<1||v>100000))return NextResponse.json({error:"Invalid version."},{status:400,headers});
 const addr=methods[key]==="scope"?process.env.NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS:process.env.NEXT_PUBLIC_CHANGE_DESK_ADDRESS;
 if(!addr||!/^0x[0-9a-fA-F]{40}$/.test(addr))return NextResponse.json({error:"Contract not configured."},{status:503,headers});
 try{
  const reader=createClient({chain:studionet});
  const result=await reader.readContract({address:addr as never,functionName:key,args:versioned?[id,v]:[id]});
  let value:unknown=result;if(typeof value==="string"){try{value=JSON.parse(value);}catch{}}
  if(value===null||value===undefined||value==="")return NextResponse.json({found:false,method:key,id},{headers});
  if(key==="get_decision"||key==="get_round"||key==="get_version"){
   if(!value||typeof value!=="object"||Array.isArray(value))return NextResponse.json({error:"Unexpected contract record format."},{status:502,headers});
   const record=value as Record<string,unknown>;const actual=key==="get_decision"?record.decision_id:key==="get_round"?record.round_id:record.brief_id;
   if(actual!==id||(key==="get_version"&&record.version!==v))return NextResponse.json({error:"Returned record does not match requested ID."},{status:502,headers});
  }
  return NextResponse.json({found:true,method:key,id,value},{headers});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Contract read failed."},{status:502,headers});}
}