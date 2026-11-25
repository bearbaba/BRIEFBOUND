"use client";
import {useEffect,useMemo,useState,useRef} from "react";
import {SEED_BRIEF,SEED_MESSAGE,SEED_AMENDMENT,VAGUE_BRIEF,compare,type Verdict} from "../lib/demo";
import {connectWallet,getInjectedProvider,getWalletSession,isStudionetChain,submitWrite,publicRead} from "../lib/genlayer";
import {isTransactionHash,type ChainSnapshot} from "../lib/tx-status";
type Tab="review"|"chain"|"guide";
const scopeAddress=process.env.NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS||"";
const changeAddress=process.env.NEXT_PUBLIC_CHANGE_DESK_ADDRESS||"";
function parseRecord(raw:string):Record<string,unknown>|null{try{let x:unknown=JSON.parse(raw);if(typeof x==="string")x=JSON.parse(x);return x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:null;}catch{return null;}}
function matchReadback(raw:string,method:string,args:(string|number)[],signer?:string):boolean{
 const r=parseRecord(raw);if(!r)return false;
 const same=(a:unknown,b:unknown)=>typeof a==="string"&&typeof b==="string"&&a.toLowerCase()===b.toLowerCase();
 switch(method){
 case "create_brief":return r.brief_id===args[0]&&r.version===1&&r.source===args[1]&&same(r.client,args[2])&&same(r.freelancer,args[3]);
 case "approve_version":return r.brief_id===args[0]&&r.version===args[1]&&!!signer&&((same(r.client,signer)&&r.client_approved===true)||(same(r.freelancer,signer)&&r.freelancer_approved===true));
 case "propose_amendment":return r.brief_id===args[0]&&Number(r.version)>1&&r.source===args[1];
 case "cancel_amendment":return r.brief_id===args[0]&&r.version===args[1]&&r.cancelled===true;
 case "adjudicate":return r.decision_id===args[0]&&r.brief_id===args[1]&&r.version===args[2]&&r.message===args[3]&&Array.isArray(r.items)&&r.items.length>0;
 case "propose_round":return r.round_id===args[0]&&r.brief_id===args[1]&&r.version===args[2]&&!!signer&&same(r.proposed_by,signer);
 case "confirm_round":return r.round_id===args[0]&&r.started===true&&!!signer&&same(r.confirmed_by,signer);
 default:return false;
 }
}
function Status({status}:{status:Verdict}){
 return <span className={"status "+status.toLowerCase()}>{status.replaceAll("_"," ")}</span>;
}
export default function Home(){
 const [tab,setTab]=useState<Tab>("review");
 const [brief,setBrief]=useState(SEED_BRIEF);
 const [message,setMessage]=useState(SEED_MESSAGE);
 const [amendment,setAmendment]=useState(SEED_AMENDMENT);
 const [replacement,setReplacement]=useState("Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English and Japanese.");
 const [showV2,setShowV2]=useState(true);
 const [briefId,setBriefId]=useState("review-landing-01");
 const [client,setClient]=useState("");const [freelancer,setFreelancer]=useState("");
 const [decisionId,setDecisionId]=useState("decision-v1-001");
 const [roundId,setRoundId]=useState("round-001");
 const [v,setV]=useState(1);const [busy,setBusy]=useState("");
 const [feedback,setFeedback]=useState("");const [readback,setReadback]=useState("");
 const [account,setAccount]=useState("");const [chain,setChain]=useState("");const enabled=useRef(false);
 const [pending,setPending]=useState<{hash:string;target:"scope"|"change";method:string;args:(string|number)[];signer?:string}|null>(null);
 const [lastHash,setLastHash]=useState("");const [walletError,setWalletError]=useState("");
 const [snapshot,setSnapshot]=useState<ChainSnapshot|null>(null);
 const [txAction,setTxAction]=useState("");
 const [phase,setPhase]=useState<"idle"|"preparing"|"wallet"|"submitted"|"rejected"|"error">("idle");
 const [stateCheck,setStateCheck]=useState<"idle"|"checking"|"matched"|"unconfirmed">("idle");
 const [showRaw,setShowRaw]=useState(false);
 const [readNotice,setReadNotice]=useState<{kind:"loading"|"found"|"missing"|"error";label:string;detail:string}|null>(null);
 const [elapsed,setElapsed]=useState(0);
 const walletReady=!!account&&isStudionetChain(chain);
 useEffect(()=>{
  const provider=getInjectedProvider();if(!provider)return;
  let active=true;let ticket=0;let timer:ReturnType<typeof setTimeout>|undefined;
  const refresh=()=>{if(!enabled.current)return;const id=++ticket;getWalletSession().then(s=>{if(active&&enabled.current&&ticket===id&&s){setAccount(s.account);setChain(s.chainId);}}).catch(()=>{});};
  const changed=(value:unknown)=>{if(timer)clearTimeout(timer);if(Array.isArray(value)&&!value.length){const id=++ticket;timer=setTimeout(()=>{getWalletSession().then(s=>{if(active&&enabled.current&&id===ticket){if(!s){enabled.current=false;setAccount("");setChain("");}else refresh();}}).catch(()=>{});},1500);}else refresh();};
  const lost=()=>changed([]);
  provider.on?.("accountsChanged",changed);provider.on?.("chainChanged",refresh);provider.on?.("disconnect",lost);
  return()=>{active=false;if(timer)clearTimeout(timer);provider.removeListener?.("accountsChanged",changed);provider.removeListener?.("chainChanged",refresh);provider.removeListener?.("disconnect",lost);};
 },[]);
 useEffect(()=>{
  const suffix=Date.now().toString(36);setBriefId("brief-"+suffix);setDecisionId("decision-"+suffix+"-v1");setRoundId("round-"+suffix);
 },[]);
 async function connectUI(){setBusy("wallet");setWalletError("");try{const s=await connectWallet();enabled.current=true;setAccount(s.account);setChain(s.chainId);setClient(old=>old||s.account);}catch(e){setWalletError(e instanceof Error?e.message:String(e));}finally{setBusy("");}}
 function disconnectUI(){enabled.current=false;setAccount("");setChain("");setWalletError("");}
 function savePending(tx:NonNullable<typeof pending>){setPending(tx);setLastHash(tx.hash);setTxAction(tx.method);setPhase("submitted");setSnapshot(null);setStateCheck("idle");try{localStorage.setItem("briefbound:pending",JSON.stringify(tx));}catch{setWalletError("Cannot save hash locally. Keep this page open.");}}
 function resumePending(){try{const raw=localStorage.getItem("briefbound:pending");if(!raw){setFeedback("No saved pending transaction.");return;}const tx=JSON.parse(raw) as NonNullable<typeof pending>;if(!isTransactionHash(tx.hash)||!["scope","change"].includes(tx.target)||!Array.isArray(tx.args))throw Error("Invalid saved transaction");savePending(tx);setFeedback("Resuming saved transaction without signing.");}catch(e){setFeedback(String(e));}}
 useEffect(()=>{
  if(!pending)return;const tx=pending;let stopped=false;let timer:ReturnType<typeof setTimeout>|undefined;
  async function poll(){try{
   const res=await fetch("/api/tx-status?hash="+encodeURIComponent(tx.hash),{cache:"no-store"});const snap=await res.json() as ChainSnapshot&{receiptUnsupported?:boolean;error?:string};if(!res.ok)throw Error(snap.error||"Status unavailable");if(stopped)return;
   setSnapshot(snap);setFeedback(snap.message);
   if(snap.terminalFailure||snap.finalized){
    if(!snap.terminalFailure){
     setStateCheck("checking");
     const readMethod=tx.method==="adjudicate"?"get_decision":tx.method==="propose_round"||tx.method==="confirm_round"?"get_round":"get_version";
     const readArgs=readMethod==="get_version"?[tx.args[0],tx.method==="create_brief"?1:(tx.method==="approve_version"||tx.method==="cancel_amendment")?tx.args[1]:await publicRead(scopeAddress,"get_latest_version",[tx.args[0]]).then(Number)]:[tx.args[0]];
     try{const raw=await publicRead(tx.target==="scope"?scopeAddress:changeAddress,readMethod,readArgs);if(stopped)return;setReadback(formatRead(raw));const matched=matchReadback(raw,tx.method,tx.args,tx.signer);setStateCheck(matched?"matched":"unconfirmed");setFeedback(matched?(snap.verified?"Transaction completed. Expected contract state confirmed.":"Expected contract state confirmed on-chain. Detailed execution receipt unavailable."):"Expected state not confirmed. Do not resubmit blindly.");}catch(e){if(stopped)return;setStateCheck("unconfirmed");setFeedback("Finalized; state read unavailable: "+String(e));}
    }
    if(stopped)return;try{localStorage.removeItem("briefbound:pending");}catch{}setPending(null);return;
   }
  }catch(e){if(!stopped)setFeedback("Checking network · "+String(e));}
  if(!stopped)timer=setTimeout(poll,7000);}
  void poll();return()=>{stopped=true;if(timer)clearTimeout(timer);};
 },[pending]);
 useEffect(()=>{if(!pending&&phase!=="preparing"&&phase!=="wallet")return;const start=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[pending,phase]);
 function formatRead(raw:string){try{let x=JSON.parse(raw);if(typeof x==="string")x=JSON.parse(x);return JSON.stringify(x,null,2);}catch{return raw;}}
 const {first,second}=useMemo(()=>compare(brief,amendment,message),[brief,amendment,message]);
 const changes=first.items.filter((x,i)=>x.verdict!==second.items[i]?.verdict).length;
 const ready=!!scopeAddress&&!!changeAddress;
 async function write(target:"scope"|"change",method:string,args:(string|number)[]){
   if(!walletReady||pending||busy)return;
   try{if(localStorage.getItem("briefbound:pending")){setFeedback("Resume the saved transaction before signing again.");return;}}catch{}
   setBusy(method);setFeedback("");setReadback("");setReadNotice(null);setSnapshot(null);setLastHash("");setTxAction(method);setStateCheck("idle");setElapsed(0);setPhase("preparing");
   try{const verified=await fetch("/api/deployment-check",{cache:"no-store",signal:AbortSignal.timeout(25000)});const check=await verified.json() as {ok?:boolean};if(!verified.ok||check.ok!==true)throw Error("Configured contract pair does not match the audited release. Signing blocked.");const hash=await submitWrite(target==="scope"?scopeAddress:changeAddress,method,args,account,fee=>{setPhase("wallet");setFeedback("Review and approve in your wallet · estimated "+fee+" test GEN");});
    if(!isTransactionHash(hash))throw Error("No valid hash returned");savePending({hash,target,method,args,signer:account});setFeedback("Submitted · automatically tracking GenLayer.");
   }catch(e){const msg=e instanceof Error?e.message:String(e);const hash=msg.match(/0x[0-9a-fA-F]{64}/)?.[0];if(hash){savePending({hash,target,method,args,signer:account});setFeedback("Transaction hash received. Checking network status.");}else{const rejected=/reject|denied|4001/i.test(msg);setPhase(rejected?"rejected":"error");setFeedback(rejected?"Signature declined in wallet. No transaction hash received.":"Submission not confirmed: "+msg);}}finally{setBusy("");}
 }
 async function read(target:"scope"|"change",method:string,args:(string|number)[]){
   const id=String(args[0]??"").trim(),label=method.replaceAll("_"," ").toUpperCase();
   setBusy(method);setReadback("");setReadNotice({kind:"loading",label,detail:id});
   try{
    const query=new URLSearchParams({method,id});if(args.length>1)query.set("version",String(args[1]));
    const res=await fetch("/api/read-state?"+query.toString(),{cache:"no-store",signal:AbortSignal.timeout(25000)});
    const data=await res.json() as {found?:boolean;value?:unknown;error?:string};if(!res.ok)throw Error(data.error||"Read failed");
    if(!data.found){setReadNotice({kind:"missing",label,detail:"No matching record: "+id});return;}
    setReadback(typeof data.value==="string"?data.value:JSON.stringify(data.value,null,2));setReadNotice({kind:"found",label,detail:"On-chain record found · "+id});
   }catch(e){setReadNotice({kind:"error",label,detail:e instanceof Error?e.message:String(e)});}finally{setBusy("");}
 }
 const record=parseRecord(readback);
 const outcome=snapshot?.terminalFailure?"Transaction unsuccessful":snapshot?.finalized?(stateCheck==="checking"?"Finalized · reading state":stateCheck==="matched"?(snapshot.verified?"Completed · verified":"Finalized · state confirmed"):snapshot.verified?"Execution verified · state unconfirmed":"Finalized · checking evidence"):phase==="wallet"?"Awaiting wallet signature":phase==="preparing"?"Preparing transaction":phase==="submitted"?"Tracking transaction":phase==="rejected"?"Signature declined":phase==="error"?"Submission unconfirmed":"Ready for an action";
 const outcomeClass=snapshot?.terminalFailure||phase==="rejected"||phase==="error"?"bad":snapshot?.finalized&&stateCheck==="matched"?(snapshot.verified?"good":"partial"):phase!=="idle"?"working":"";
 const tracking=!!pending||phase==="preparing"||phase==="wallet";
 const lifecycle=[{name:"Wallet request",detail:phase==="wallet"?"Awaiting approval":lastHash?"Hash received":phase==="preparing"?"Checking network":phase==="rejected"?"Declined":"—",done:!!lastHash},{name:"Submitted",detail:lastHash?"Transaction hash received":"—",done:!!lastHash},{name:"Consensus",detail:snapshot?.consensus||((snapshot?.statusCode??0)>=2&&!snapshot?.finalized?snapshot?.status||"In progress":snapshot?.finalized?"Receipt unavailable":"—"),done:!!snapshot?.verified},{name:"Finalization",detail:snapshot?.status||"—",done:!!snapshot?.finalized},{name:"Contract state",detail:stateCheck==="matched"?"Expected state matched":stateCheck==="checking"?"Reading on-chain":stateCheck==="unconfirmed"?"Not confirmed":"—",done:stateCheck==="matched"}];
 return <main className="bbShell"><header className="header"><div className="brand"><b className="logo">⌑</b><div>briefbound<small>AGREEMENT WORKSPACE</small></div></div><div className="headerMeta"><span>STUDIONET / GENLAYER</span><span className="deployment">{ready?"CONTRACTS CONFIGURED":"NOT CONFIGURED"}</span></div><div className="walletGroup"><div className="walletLine"><button disabled={!!busy} onClick={connectUI}>{busy==="wallet"?"Connecting…":walletReady?account.slice(0,6)+"…"+account.slice(-4):account?"Switch network":"Connect wallet"}</button>{walletReady&&<button className="secondary" disabled={!!busy} onClick={disconnectUI}>Disconnect</button>}</div>{walletReady&&<small>● Studionet · Connected</small>}</div></header>
 <nav className="tabs" aria-label="Workspace navigation"><div className="navLabel">WORKSPACE</div><button className={tab==="review"?"active":""} onClick={()=>setTab("review")}><span>◫</span> Scope comparison</button><button className={tab==="chain"?"active":""} onClick={()=>setTab("chain")}><span>◇</span> Sign & adjudicate</button><button className={tab==="guide"?"active":""} onClick={()=>setTab("guide")}><span>↗</span> Audit trail</button><div className="navFoot"><strong>Two contracts</strong><small>ScopeAnchor<br/>ChangeDesk</small><a href="https://github.com/bearbaba/BRIEFBOUND/blob/main/docs/studionet-v3-evidence.md" target="_blank" rel="noreferrer">Studionet evidence ↗</a></div></nav>
 <div className="bbContent">
 <div className="pageHeading"><div><span className="eyebrow">BRIEFBOUND / {tab==="review"?"COMPARE":tab==="chain"?"LIVE WORKSPACE":"AUDIT"}</span><h1>{tab==="review"?"Scope changes, explained.":tab==="chain"?"Sign a scope. Resolve a change.":"Trace every decision."}</h1><p>{tab==="review"?"Compare the same request against two versions of an agreement.":tab==="chain"?"Wallet-signed actions and exact on-chain readbacks, in one workspace.":"Inspect the contract relationship and versioned source evidence."}</p></div>{tab==="review"&&<button onClick={()=>setTab("chain")}>Open live workspace ↗</button>}</div>
 {tab==="review"&&<div className="workspace reviewWorkspace"><div className="notice"><strong>LOCAL PREVIEW</strong> Deterministic illustration · not a live validator verdict.</div>
 <div className="comparison"><div className="comparisonHead"><div><span className="eyebrow">REQUEST / VERSION DIFF</span><h2>What changed?</h2></div><div className="comparisonCount"><b>{changes}</b> changed outcome{changes===1?"":"s"}</div></div>
 <div className="matrixScroll"><table className="matrix"><thead><tr><th>Requested work</th><th>Original scope · v1</th>{showV2&&<th>Revised scope · v2</th>}</tr></thead><tbody>{first.items.map((item,i)=><tr key={i}><th scope="row">{item.task}</th><td><Status status={item.verdict}/><q>{item.evidence||"No explicit clause found."}</q></td>{showV2&&<td className={item.verdict!==second.items[i]?.verdict?"changed":""}>{second.items[i]&&<><Status status={second.items[i].verdict}/><q>{second.items[i].evidence||"No explicit clause found."}</q></>}</td>}</tr>)}</tbody></table></div></div>
 <div className="sourceEditor"><div className="sourceTitle"><h2>Agreement inputs</h2><span>Editable local example</span></div><div className="sourceGrid"><div><label>Original brief · v1</label><textarea rows={5} value={brief} onChange={e=>setBrief(e.target.value)}/></div><div><label>Proposed addendum · local v2 example</label><textarea rows={5} value={amendment} onChange={e=>setAmendment(e.target.value)}/></div></div><label>Incoming client request</label><textarea rows={2} value={message} onChange={e=>setMessage(e.target.value)}/><div className="actions"><button onClick={()=>setShowV2(!showV2)}>{showV2?"Hide revised scope":"Compare revised scope"}</button><button className="secondary" onClick={()=>{setBrief(SEED_BRIEF);setMessage(SEED_MESSAGE);setAmendment(SEED_AMENDMENT);setShowV2(true);}}>Reset example</button><button className="secondary" onClick={()=>{setBrief(VAGUE_BRIEF);setShowV2(false);}}>Ambiguous clause test</button></div></div>
 <div className="evidenceBar"><div><strong>Verified Studionet case</strong><p>10 finalized calls · two AI adjudications · one confirmed revision round</p></div><button className="secondary" disabled={!!busy||!!pending} onClick={()=>{setTab("chain");setBriefId("briefbound-v3-01");setV(2);setDecisionId("briefbound-v3-01-v2");setRoundId("briefbound-v3-01-r1");void read("change","get_decision",["briefbound-v3-01-v2"]);}}>Read actual v2 decision ↗</button></div></div>}
 {tab==="chain"&&<div className="workspace"><div className="notice"><strong>{ready?"WALLET REQUIRED":"DEPLOYMENT REQUIRED"}</strong>{ready?"Wallet-signed testnet transactions are only valid after finalized execution.":" Deploy both GenLayer contracts, then set their public addresses in the Vercel environment. Nothing is deployed by this preview."}</div>
 <div className="columns"><div className="editor"><h2>Wallet-signed workflow</h2><div className="fieldGrid"><div><label>Brief ID</label><input value={briefId} disabled={!!pending||!!busy} onChange={e=>{setBriefId(e.target.value);setDecisionId(e.target.value+"-decision-v"+v);setReadback("");}}/></div><div><label>Version</label><select value={v} disabled={!!pending||!!busy} onChange={e=>{const next=Number(e.target.value);setV(next);setDecisionId(briefId+"-decision-v"+next);setReadback("");}}><option value={1}>v1</option><option value={2}>v2</option></select></div><div><label>Client 0x wallet</label><input value={client} onChange={e=>setClient(e.target.value)} placeholder="0x..."/></div><div><label>Freelancer 0x wallet</label><input value={freelancer} onChange={e=>setFreelancer(e.target.value)} placeholder="0x..."/></div></div>
 <div className="chainGroup"><span className="eyebrow">SCOPEANCHOR</span><label>Brief source</label><textarea rows={3} value={brief} onChange={e=>setBrief(e.target.value)}/><label>Complete replacement scope for v2 (include every retained term)</label><textarea rows={3} value={replacement} onChange={e=>setReplacement(e.target.value)}/><div className="actions"><button disabled={!ready||!!busy||!!pending||!walletReady||!client||!freelancer||client.toLowerCase()===freelancer.toLowerCase()||client.toLowerCase()!==account.toLowerCase()} onClick={()=>write("scope","create_brief",[briefId,brief,client,freelancer])}>1. Create v1</button><button disabled={!ready||!!busy||!!pending||!walletReady||![client.toLowerCase(),freelancer.toLowerCase()].includes(account.toLowerCase())} onClick={()=>write("scope","approve_version",[briefId,v])}>2. Approve v{v}</button><button disabled={!ready||!!busy||!!pending||!walletReady||![client.toLowerCase(),freelancer.toLowerCase()].includes(account.toLowerCase())} onClick={()=>write("scope","propose_amendment",[briefId,replacement])}>3. Propose replacement</button><button className="secondary" disabled={!ready||!!busy||!!pending||!walletReady||v<=1||![client.toLowerCase(),freelancer.toLowerCase()].includes(account.toLowerCase())} onClick={()=>write("scope","cancel_amendment",[briefId,v])}>Cancel pending v{v}</button><button className="secondary" disabled={!ready||!!busy||!!pending} onClick={()=>read("scope","get_version",[briefId,v])}>Read v{v}</button><button className="secondary" disabled={!ready||!!busy||!!pending} onClick={()=>read("scope","get_active_version",[briefId])}>Read active version</button></div></div>
 <div className="chainGroup"><span className="eyebrow">CHANGEDESK</span><label>Change request</label><textarea rows={2} value={message} onChange={e=>setMessage(e.target.value)}/><label>Unique decision ID</label><input value={decisionId} onChange={e=>setDecisionId(e.target.value)}/><div className="actions"><button disabled={!ready||!!busy||!!pending||!walletReady} onClick={()=>write("change","adjudicate",[decisionId,briefId,v,message])}>4. Adjudicate</button><button className="secondary" disabled={!ready||!!busy||!!pending} onClick={()=>read("change","get_decision",[decisionId])}>Read decision</button></div><label>Revision round ID</label><input value={roundId} onChange={e=>setRoundId(e.target.value)}/><div className="actions"><button disabled={!ready||!!busy||!!pending||!walletReady} onClick={()=>write("change","propose_round",[roundId,briefId,v])}>Propose round</button><button disabled={!ready||!!busy||!!pending||!walletReady} onClick={()=>write("change","confirm_round",[roundId])}>Other signer confirms</button><button disabled={!ready||!!busy||!!pending} className="secondary" onClick={()=>read("change","get_round",[roundId])}>Read round</button><button className="secondary" disabled={!ready||!!busy||!!pending} onClick={()=>read("change","get_remaining_rounds",[briefId,v])}>Read remaining rounds</button></div></div></div>
 <aside><span className="eyebrow">LIVE TRANSACTION MONITOR</span><h2>Transaction &amp; evidence</h2>{walletError&&<p role="alert">{walletError}</p>}
 <div className={"txOutcome "+outcomeClass} role="status" aria-live="polite"><small>{txAction?txAction.replaceAll("_"," ").toUpperCase():"STUDIONET"}</small><div className="txOutcomeHeadline">{tracking&&<span className="txSpinner" aria-hidden="true"/>}<strong>{outcome}</strong></div>{tracking&&<div className="txTrackingLive"><span>● LIVE TRACKING</span><span>{Math.floor(elapsed/60)}:{String(elapsed%60).padStart(2,"0")}</span></div>}<p>{feedback||"Sign a transaction to follow its lifecycle here."}</p>{tracking&&<p className="txTrackingHint">Automatic tracking · keep this page open. No additional signature is required while this request is pending.</p>}</div>
 <div className="txLifecycle" aria-label="Transaction lifecycle">{lifecycle.map((step,i)=><div key={step.name} className={step.done?"done":""}><span>{step.done?"✓":i+1}</span><div><b>{step.name}</b><small>{step.detail}</small></div></div>)}</div>
 {lastHash&&<div className="txHash"><label>TRANSACTION HASH</label><code>{lastHash}</code><button className="secondary" onClick={()=>{void navigator.clipboard.writeText(lastHash).catch(()=>setFeedback("Copy the displayed hash manually."));}}>Copy hash</button> <a href="https://explorer-studio.genlayer.com/" target="_blank" rel="noreferrer">Explorer ↗</a></div>}
 {snapshot?.finalized&&<div className="txReceipt"><div><span>Finality</span><b>FINALIZED</b></div><div><span>Consensus</span><b>{snapshot.consensus||"Not returned"}</b></div><div><span>Execution</span><b>{snapshot.execution||"Not returned"}</b></div></div>}
 {!pending&&<button className="secondary" disabled={!!busy} onClick={resumePending}>Resume saved transaction</button>}
 <div className="recordPanel"><h3>On-chain readback</h3>{readNotice&&<div className={"readNotice "+readNotice.kind} role="status"><b>{readNotice.label} · {readNotice.kind==="found"?"VERIFIED READ":readNotice.kind==="missing"?"NOT FOUND":readNotice.kind==="error"?"READ FAILED":"READING"}</b><p>{readNotice.detail}</p></div>}{record?<><div className="recordFacts">{["brief_id","version","decision_id","round_id","client_approved","freelancer_approved","locked","started","remaining_rounds_at_decision"].filter(k=>record[k]!==undefined).map(k=><div key={k}><span>{k.replaceAll("_"," ")}</span><b>{String(record[k])}</b></div>)}</div>{Array.isArray(record.items)&&record.items.map((item:Record<string,unknown>,i:number)=><div className="recordItem" key={i}><b>{String(item.request_quote||"")}</b><span className={"status "+String(item.label).toLowerCase()}>{String(item.label||"")}</span><q>{String(item.source_quote||"")}</q></div>)}</>:<p>{readback||"No state readback yet."}</p>}{readback&&<><button className="secondary" onClick={()=>setShowRaw(!showRaw)}>{showRaw?"Hide raw data":"Show raw data"}</button>{showRaw&&<pre>{readback}</pre>}</>}</div>
 <details className="contractDetails"><summary>Contract addresses</summary><label>ScopeAnchor</label><code>{scopeAddress||"Not configured"}</code><label>ChangeDesk</label><code>{changeAddress||"Not configured"}</code></details></aside></div></div>}
 {tab==="guide"&&<div className="workspace guide"><div><span className="eyebrow accent">STEWARD REVIEW PATH</span><h2>Change one clause.<br/>Check one outcome.</h2><p>1. Start with desktop/mobile, two layout rounds, English-only handoff. 2. Read the incoming message: mobile spacing + Japanese version. 3. Inspect different source quotes for the two lines. 4. Submit a complete v2 scope including Japanese, retain all other terms, approve with both wallets, and adjudicate exactly the same original message with a new decision ID. 5. Compare immutable records from get_version and get_decision.</p><p>Alternative: replace the language clause with vague “supports multiple languages”. Japanese must be NEEDS_CLARIFICATION instead of automatically included.</p><p>The reviewer preview is deterministic and intentionally limited. Actual GenLayer AI decisions are made inside ChangeDesk with validator checking of quoted evidence.</p></div><div className="diagram"><div><b>01 ScopeAnchor</b><small>Source → exact clause spans → client signature → freelancer signature → locked version</small></div><i>↓ CONTRACT-TO-CONTRACT VIEW</i><div><b>02 ChangeDesk</b><small>Unstructured message → evidence-linked verdicts → immutable decision record</small></div><i>↓ PUBLIC READBACK</i><div><b>Audit trail</b><small>brief_id · version · clause_id · source quote · decision_id</small></div></div></div>}
 <footer><span>BRIEFBOUND · GENLAYER</span><span>PREVIEW ≠ CONSENSUS · NO CUSTODIAL KEYS</span></footer></div></main>;
}
