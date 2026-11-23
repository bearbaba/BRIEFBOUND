"use client";
import {useMemo,useState} from "react";
import {SEED_BRIEF,SEED_MESSAGE,SEED_AMENDMENT,VAGUE_BRIEF,compare,type Preview,type Verdict} from "../lib/demo";
import {readOnChain,writeOnChain} from "../lib/genlayer";
type Tab="review"|"chain"|"guide";
const scopeAddress=process.env.NEXT_PUBLIC_SCOPE_ANCHOR_ADDRESS||"";
const changeAddress=process.env.NEXT_PUBLIC_CHANGE_DESK_ADDRESS||"";
function Status({status}:{status:Verdict}){
 return <span className={"status "+status.toLowerCase()}>{status.replaceAll("_"," ")}</span>;
}
function Decision({data,title}:{data:Preview;title:string}){
 return <section className="decision"><div className="decisionTop"><div><span className="eyebrow">SIGNED BRIEF / VERSION {data.version}</span><h3>{title}</h3></div><span>v{data.version}</span></div>
 <div>{data.items.map((item,i)=><div className="line" key={i}>
 <div className="lineTitle"><span className="step">{i+1}</span><strong>{item.task}</strong><Status status={item.verdict}/></div>
 <p>{item.explanation}</p><blockquote><small>EXACT BRIEF EVIDENCE</small><q>{item.evidence||"No explicit clause found."}</q></blockquote>
 </div>)}</div></section>;
}
export default function Home(){
 const [tab,setTab]=useState<Tab>("review");
 const [brief,setBrief]=useState(SEED_BRIEF);
 const [message,setMessage]=useState(SEED_MESSAGE);
 const [amendment,setAmendment]=useState(SEED_AMENDMENT);
 const [showV2,setShowV2]=useState(true);
 const [briefId,setBriefId]=useState("review-landing-01");
 const [client,setClient]=useState("");const [freelancer,setFreelancer]=useState("");
 const [decisionId,setDecisionId]=useState("decision-v1-001");
 const [roundId,setRoundId]=useState("round-001");
 const [v,setV]=useState(1);const [busy,setBusy]=useState("");
 const [feedback,setFeedback]=useState("");const [readback,setReadback]=useState("");
 const {first,second}=useMemo(()=>compare(brief,amendment,message),[brief,amendment,message]);
 const changes=first.items.filter((x,i)=>x.verdict!==second.items[i]?.verdict).length;
 const ready=!!scopeAddress&&!!changeAddress;
 async function write(target:"scope"|"change",method:string,args:(string|number)[]){
   setBusy(method);setFeedback("");
   try{const hash=await writeOnChain(target==="scope"?scopeAddress:changeAddress,method,args);setFeedback("FINALIZED / "+method+" / "+hash);}
   catch(e){setFeedback("NOT FINALIZED / "+(e instanceof Error?e.message:String(e)));}finally{setBusy("");}
 }
 async function read(target:"scope"|"change",method:string,args:(string|number)[]){
   setBusy(method);setFeedback("");
   try{setReadback(await readOnChain(target==="scope"?scopeAddress:changeAddress,method,args));setFeedback("Public readback completed.");}
   catch(e){setFeedback("READ FAILED / "+(e instanceof Error?e.message:String(e)));}finally{setBusy("");}
 }
 return <main><header className="header"><div className="brand"><b className="logo">B.</b><div>BRIEFBOUND<small>GENLAYER / SCOPE INTELLIGENCE</small></div></div><div className="headerMeta"><span>02 INTELLIGENT CONTRACTS</span><span className="deployment">{ready?"ADDRESSES CONFIGURED":"DEPLOYMENT UNVERIFIED"}</span></div></header>
 <div className="hero"><div><span className="eyebrow accent">EVIDENCE FIRST. ALWAYS.</span><h1>The brief says <em>what counts.</em><br/>The evidence shows <em>why.</em></h1><p>One client message can contain an included revision and an extra. Trace both to the exact clause the parties signed.</p></div><div className="seal">REVIEW CASE<strong>01</strong><small>One message.<br/>Two outcomes.</small></div></div>
 <nav className="tabs"><button className={tab==="review"?"active":""} onClick={()=>setTab("review")}>01 / Reviewer lab</button><button className={tab==="chain"?"active":""} onClick={()=>setTab("chain")}>02 / Live GenLayer</button><button className={tab==="guide"?"active":""} onClick={()=>setTab("guide")}>03 / Audit trail</button></nav>
 {tab==="review"&&<div className="workspace"><div className="notice"><strong>LOCAL PREVIEW</strong> Deterministic example rules only. These labels are not claimed as GenLayer consensus results.</div>
 <div className="columns"><div className="editor"><h2>01 <span>Signed brief v1</span></h2><label>Approved brief text</label><textarea rows={5} value={brief} onChange={e=>setBrief(e.target.value)}/>
 <h2>02 <span>Client request</span></h2><label>Unstructured incoming message</label><textarea rows={3} value={message} onChange={e=>setMessage(e.target.value)}/>
 <h2>03 <span>Proposed addendum v2</span></h2><label>Text requiring both signatures on-chain</label><textarea rows={3} value={amendment} onChange={e=>setAmendment(e.target.value)}/>
 <div className="actions"><button onClick={()=>setShowV2(!showV2)}>{showV2?"Hide v2":"Compare v1 / v2"}</button><button className="secondary" onClick={()=>{setBrief(SEED_BRIEF);setMessage(SEED_MESSAGE);setAmendment(SEED_AMENDMENT);setShowV2(true);}}>Restore seed</button><button className="secondary" onClick={()=>{setBrief(VAGUE_BRIEF);setShowV2(false);}}>Vague clause test</button></div></div>
 <aside><span className="eyebrow">WHY THIS MATTERS</span><h2>Two tasks.<br/>Two obligations.</h2><div className="metric"><strong>{first.items.length}</strong><span>independent tasks from one message</span></div><div className="metric"><strong>{changes}</strong><span>result differences after amendment</span></div><div className="diagram"><div><b>ScopeAnchor</b><small>Extract clauses + dual signatures + version lock</small></div><i>↓ READ SIGNED VERSION</i><div><b>ChangeDesk</b><small>Split message + source-backed classification</small></div></div><p>Signed chain records are immutable. Editing fields here only changes the illustration.</p></aside></div>
 <div className={"results "+(!showV2?"one":"")}><Decision data={first} title="Original brief"/>{showV2&&<Decision data={second} title="After Japanese addendum"/>}</div></div>}
 {tab==="chain"&&<div className="workspace"><div className="notice"><strong>{ready?"WALLET REQUIRED":"DEPLOYMENT REQUIRED"}</strong>{ready?"Wallet-signed testnet transactions are only valid after finalized execution.":" Deploy both GenLayer contracts, then set their public addresses in the Vercel environment. Nothing is deployed by this preview."}</div>
 <div className="columns"><div className="editor"><h2>Wallet-signed workflow</h2><div className="fieldGrid"><div><label>Brief ID</label><input value={briefId} onChange={e=>setBriefId(e.target.value)}/></div><div><label>Version</label><select value={v} onChange={e=>setV(Number(e.target.value))}><option value={1}>v1</option><option value={2}>v2</option></select></div><div><label>Client 0x wallet</label><input value={client} onChange={e=>setClient(e.target.value)} placeholder="0x..."/></div><div><label>Freelancer 0x wallet</label><input value={freelancer} onChange={e=>setFreelancer(e.target.value)} placeholder="0x..."/></div></div>
 <div className="chainGroup"><span className="eyebrow">SCOPEANCHOR</span><div className="actions"><button disabled={!ready||!!busy||!client||!freelancer} onClick={()=>write("scope","create_brief",[briefId,brief,client,freelancer])}>1. Create v1</button><button disabled={!ready||!!busy} onClick={()=>write("scope","approve_version",[briefId,v])}>2. Approve v{v}</button><button disabled={!ready||!!busy} onClick={()=>write("scope","propose_amendment",[briefId,amendment])}>3. Propose v2</button><button className="secondary" disabled={!ready||!!busy} onClick={()=>read("scope","get_version",[briefId,v])}>Read v{v}</button></div></div>
 <div className="chainGroup"><span className="eyebrow">CHANGEDESK</span><label>Unique decision ID</label><input value={decisionId} onChange={e=>setDecisionId(e.target.value)}/><div className="actions"><button disabled={!ready||!!busy} onClick={()=>write("change","adjudicate",[decisionId,briefId,v,message])}>4. Adjudicate</button><button className="secondary" disabled={!ready||!!busy} onClick={()=>read("change","get_decision",[decisionId])}>Read decision</button></div><label>Revision round ID</label><input value={roundId} onChange={e=>setRoundId(e.target.value)}/><div className="actions"><button disabled={!ready||!!busy} onClick={()=>write("change","propose_round",[roundId,briefId,v])}>Propose round</button><button disabled={!ready||!!busy} onClick={()=>write("change","confirm_round",[roundId])}>Other signer confirms</button><button disabled={!ready||!!busy} className="secondary" onClick={()=>read("change","get_round",[roundId])}>Read round</button></div></div></div>
 <aside><span className="eyebrow">LIVE RECEIPT CONSOLE</span><h2>Read it back.<br/>Don&apos;t assume.</h2><label>ScopeAnchor</label><code>{scopeAddress||"Not deployed / not configured"}</code><label>ChangeDesk</label><code>{changeAddress||"Not deployed / not configured"}</code><div className="feedback" role="status">{busy?"Executing "+busy:feedback||"No chain activity yet."}</div><pre>{readback||"On-chain readbacks appear here."}</pre></aside></div></div>}
 {tab==="guide"&&<div className="workspace guide"><div><span className="eyebrow accent">STEWARD REVIEW PATH</span><h2>Change one clause.<br/>Check one outcome.</h2><p>1. Start with desktop/mobile, two layout rounds, English-only handoff. 2. Read the incoming message: mobile spacing + Japanese version. 3. Inspect different source quotes for the two lines. 4. Add Japanese in v2, approve with both wallets, and adjudicate exactly the same original message with a new decision ID. 5. Compare immutable records from get_version and get_decision.</p><p>Alternative: replace the language clause with vague “supports multiple languages”. Japanese must be NEEDS_CLARIFICATION instead of automatically included.</p><p>The reviewer preview is deterministic and intentionally limited. Actual GenLayer AI decisions are made inside ChangeDesk with validator checking of quoted evidence.</p></div><div className="diagram"><div><b>01 ScopeAnchor</b><small>Source → interpreted clauses → client signature → freelancer signature → locked version</small></div><i>↓ CONTRACT-TO-CONTRACT VIEW</i><div><b>02 ChangeDesk</b><small>Unstructured message → evidence-linked verdicts → immutable decision record</small></div><i>↓ PUBLIC READBACK</i><div><b>Audit trail</b><small>brief_id · version · clause_id · source quote · decision_id</small></div></div></div>}
 <footer><span>BRIEFBOUND / GENLAYER / 2026</span><span>PREVIEW ≠ CONSENSUS · NO CUSTODIAL KEYS</span></footer></main>;
}
