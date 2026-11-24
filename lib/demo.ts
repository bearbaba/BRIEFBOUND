/** Deterministic reviewer preview; it is NOT an AI or on-chain verdict. */
export const SEED_BRIEF = "Deliver one landing page in desktop + mobile layouts. Two rounds of layout revisions are included. Final delivery is in English only.";
export const SEED_MESSAGE = "Please tighten the spacing on mobile and add a Japanese version.";
export const SEED_AMENDMENT = "Japanese-language delivery is included alongside English for the same landing page. This replaces the previous English-only restriction.";
export const VAGUE_BRIEF = "Deliver a responsive landing page. Two layout revisions are included. We support multiple languages.";
export type Verdict = "INCLUDED" | "CHANGE_ORDER" | "NEEDS_CLARIFICATION";
export type Item = {task:string;verdict:Verdict;evidence:string;explanation:string};
export type Preview = {version:number;source:string;items:Item[]};
const sentence=(source:string,term:RegExp)=>source.split(/(?<=[.!?])\s+/).find(s=>term.test(s))||"";
const split=(message:string)=>message.replace(/[.!?]+$/g,"").split(/\s+and\s+|\s*;\s*/i).map(s=>s.trim()).filter(Boolean).slice(0,10);
export function preview(source:string,message:string,version=1):Preview {
 const japanese=/\bJapanese\b/i.test(source);
 const explicit=/(?:Japanese(?:-language)?.{0,90}(?:included|deliver|delivery|provide|version))|(?:(?:included|deliver|delivery|provide|version).{0,90}Japanese)/i.test(source);
 const englishOnly=/(?:English only|only English|in English only)/i.test(source);
 const multilingual=/multilingual|multiple languages|multi.languages/i.test(source);
 const layout=sentence(source,/mobile|layout|responsive/i);
 const language=sentence(source,/language|English|Japanese/i);
 const items:Item[]=split(message).map(task=>{
  if(/\bJapanese\b/i.test(task)){
   if(japanese&&explicit)return{task,verdict:"INCLUDED",evidence:sentence(source,/Japanese/i),explanation:"Signed amendment explicitly includes Japanese."};
   if(multilingual&&!englishOnly)return{task,verdict:"NEEDS_CLARIFICATION",evidence:language,explanation:"Multilingual is vague: Japanese was not specified."};
   if(englishOnly)return{task,verdict:"CHANGE_ORDER",evidence:language,explanation:"The signed brief limits handoff to English."};
   return{task,verdict:"NEEDS_CLARIFICATION",evidence:language,explanation:"No explicit language entitlement was found."};
  }
  if(/mobile|spacing|layout/i.test(task)&&layout)return{task,verdict:"INCLUDED",evidence:layout,explanation:"Within layout scope, subject to an available mutually-started revision round."};
  return{task,verdict:"NEEDS_CLARIFICATION",evidence:"",explanation:"No explicit matching clause in this limited local preview."};
 });
 return{version,source,items};
}
export function compare(source:string,amendment:string,message:string){
 return{first:preview(source,message,1),second:preview(source+"\n"+amendment,message,2)};
}
