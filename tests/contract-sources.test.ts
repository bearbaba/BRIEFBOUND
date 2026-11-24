import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("bundled schema probe sources exactly match deployable contracts",()=>{
 const sources=JSON.parse(readFileSync("lib/contract-sources.json","utf8"));
 for(const name of ["ScopeAnchor","ChangeDesk"])assert.equal(sources[name],readFileSync("contracts/"+name+".py","utf8"));
});
