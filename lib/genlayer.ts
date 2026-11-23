/** GenLayerJS stable v1.1.8: browser-wallet Studionet writes and public readbacks. */
import {createClient} from "genlayer-js";
import {ExecutionResult,TransactionStatus} from "genlayer-js/types";
import {studionet} from "genlayer-js/chains";
type Provider={request:(args:{method:string;params?:unknown[]})=>Promise<unknown>};
function validate(address:string){if(!/^0x[a-fA-F0-9]{40}$/.test(address))throw Error("A deployed contract 0x address is required.");return address;}
export async function connectedWallet(){
 if(typeof window==="undefined")throw Error("Open this page in a browser.");
 const provider=(window as Window & {ethereum?:Provider}).ethereum;
 if(!provider)throw Error("Enable an EIP-1193 wallet (e.g. MetaMask).");
 const addresses=await provider.request({method:"eth_requestAccounts"}) as string[];
 if(!addresses?.[0])throw Error("No wallet connected.");
 return{account:validate(addresses[0]),provider};
}
export async function writeOnChain(address:string,method:string,args:(string|number)[]){
 const {account,provider}=await connectedWallet();
 const client=createClient({chain:studionet,account:account as never,provider});
 await client.connect("studionet");
 const hash=await client.writeContract({address:validate(address) as never,functionName:method,args,value:BigInt(0)});
 const receipt=await client.waitForTransactionReceipt({hash,status:TransactionStatus.FINALIZED});
 if(receipt.txExecutionResultName!==ExecutionResult.FINISHED_WITH_RETURN)throw Error("Finalized but execution not successful: "+receipt.txExecutionResultName);
 return hash;
}
export async function readOnChain(address:string,method:string,args:(string|number)[]){
 const client=createClient({chain:studionet});
 const result=await client.readContract({address:validate(address) as never,functionName:method,args});
 return typeof result==="string"?result:JSON.stringify(result);
}
