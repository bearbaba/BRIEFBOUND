import test from "node:test";
import assert from "node:assert/strict";
import {SEED_BRIEF,SEED_MESSAGE,SEED_AMENDMENT,VAGUE_BRIEF,compare,preview} from "../lib/demo.ts";
test("one message yields included layout and change-order language",()=>{
 const x=preview(SEED_BRIEF,SEED_MESSAGE).items;
 assert.deepEqual(x.map(i=>i.verdict),["INCLUDED","CHANGE_ORDER"]);
 assert.match(x[1].evidence,/English only/);
});
test("amendment flips only Japanese request; v1 remains immutable",()=>{
 const {first,second}=compare(SEED_BRIEF,SEED_AMENDMENT,SEED_MESSAGE);
 assert.equal(first.items[1].verdict,"CHANGE_ORDER");
 assert.equal(second.items[1].verdict,"INCLUDED");
 assert.equal(first.source,SEED_BRIEF);
});
test("vague multilingual brief is clarification not inclusion",()=>{
 assert.equal(preview(VAGUE_BRIEF,SEED_MESSAGE).items[1].verdict,"NEEDS_CLARIFICATION");
});
test("unknown freeform change is not falsely included",()=>{
 assert.equal(preview(SEED_BRIEF,"Also add a video animation.").items[0].verdict,"NEEDS_CLARIFICATION");
});
