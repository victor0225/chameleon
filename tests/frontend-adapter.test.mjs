import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../lib/api.js', import.meta.url);
const source = readFileSync(file, 'utf8');
const stubs = `
const JOB={office:{name:'사무·행정'}, marketing:{name:'마케팅'}};
const LESSONS=[];
const XP_PER_LESSON=20;
const analyze=(t)=>({found:[],segments:[]});
const ITEM={};
const ITEMS=[];
let sent=[];
const aiGenerate=async payload=>{sent.push(['generate',payload]); return {prompt:'생성된 텍스트',segments:[{key:'goal',label:'목표',item:'goal',text:'회의록 정리',why:'목적'}]};};
const aiRevise=async payload=>{sent.push(['revise',payload]); return {prompt:'수정된 텍스트',segments:[{key:'goal',label:'목표',item:'goal',text:'회의록 표로 정리',why:'목적'}]};};
export const calls=sent;
`;
const adapted = source.replace(/^import .*;\n/gm, '');
const mod = await import(`data:text/javascript;base64,${Buffer.from(stubs+adapted).toString('base64')}`);

test('프론트 한국어 숙련도·직무를 서버 API 형식으로 변환', async()=>{
 const result=await mod.generatePrompt({job:'office',level:'중급',purpose:'회의록 정리',reader:'팀장님',shape:'table'});
 assert.equal(mod.calls[0][1].level,'intermediate');
 assert.equal(mod.calls[0][1].job,'사무·행정');
 assert.match(mod.calls[0][1].userInput,/읽는 대상: 팀장님/);
 assert.match(mod.calls[0][1].userInput,/원하는 출력 형식: 표/);
 assert.equal(result.version,1);
 assert.equal(result.segments[0].label,'목표');
 assert.equal(result.segments[0].isNew,false);
});

test('추가 수정은 원문·이전 맥락을 유지하고 변경 표시', async()=>{
 const base=await mod.generatePrompt({job:'marketing',level:'고급',purpose:'광고 문구',reader:'',shape:'auto'});
 const result=await mod.refinePrompt(base,'더 짧게');
 assert.equal(mod.calls.at(-1)[1].level,'advanced');
 assert.equal(mod.calls.at(-1)[1].previousPrompt,'생성된 텍스트');
 assert.equal(mod.calls.at(-1)[1].revisionRequest,'더 짧게');
 assert.equal(result.version,2);
 assert.equal(result.segments[0].isNew,true);
});
