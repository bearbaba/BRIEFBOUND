import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("migration pins the announced stable SDK and both v0.4 runners",()=>{
 const pkg=JSON.parse(readFileSync("package.json","utf8"));
 assert.equal(pkg.dependencies["genlayer-js"],"2.0.0");
 assert.equal(pkg.dependencies["genlayer-js-v2"],undefined);
 for(const file of ["ScopeAnchor.py","ChangeDesk.py"]){
  assert.match(readFileSync("contracts/"+file,"utf8").split("\n")[0],/py-genlayer:kzybg95x1gn21dw72m7hyg0maaap04n4nx55j9yt6fkdqxtz6bz0/);
 }
 assert.match(readFileSync(".github/workflows/ci.yml","utf8"),/genlayer-test==0\.30\.0/);
});
test("all browser writes use a fee estimate and pass fees, no legacy fallback",()=>{
 const s=readFileSync("lib/genlayer.ts","utf8");
 assert.equal((s.match(/\.writeContract\(/g)||[]).length,1);
 assert.match(s,/estimateTransactionFeesForWrite\(call\)/);
 assert.match(s,/writeContract\(\{\.\.\.call,fees\}\)/);
});
