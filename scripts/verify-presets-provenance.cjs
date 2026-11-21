const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');const ts=require('typescript');const Module=require('node:module');
const project=path.resolve(__dirname,'..');const originalCwd=process.cwd();const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'hotprompter-provenance-'));
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const resolve=Module._resolveFilename;Module._resolveFilename=function(name,...args){return resolve.call(this,name.startsWith('@/')?path.join(project,name.slice(2)):name,...args)};
process.chdir(scratch);
(async()=>{
 const p=require(path.join(project,'lib/preset-library.ts'));const store=require(path.join(project,'lib/preset-library-store.ts'));const jobs=require(path.join(project,'lib/job-records.ts'));const {freezeJob}=require(path.join(project,'lib/snapshot.ts'));
 const fields=require(path.join(project,'lib/options.ts')).FIELD_DEFS;
 const scene=fields.find(f=>f.key==='scene').options[0];const background=fields.find(f=>f.key==='background').options[0];
 const base={id:'scene-test-0001',name:'Scene fixture',schema:2,kind:'scene',version:1,...p.capturePreset({scene,background},'scene'),chips:[],notes:'',source:'authored',createdAt:new Date().toISOString(),quarantined:false};
 p.validateLibraryPreset(base);
 assert.throws(()=>p.validateLibraryPreset({...base,owns:['age'],rotaries:{age:p.optionId('age','30')}}));
 const envelope=store.exportLibrary([base]);assert.equal(store.verifyLibraryImport(envelope).length,1);
 assert.throws(()=>store.verifyLibraryImport({...envelope,body:{...envelope.body,presets:[{...base,name:'tampered'}]}}));
 assert.throws(()=>store.verifyLibraryImport(store.exportLibrary([{...base,rotaries:{scene:'unknown-id'}}])));
 const merge=p.mergePresetStack([base],{scene:'manual room'},['background'],{background:'pinned garden'});
 assert.equal(merge.draft.scene,'manual room');assert.equal(merge.draft.background,'pinned garden');
 const reconciled=p.reconcilePreset({...base,rotaries:{...base.rotaries,scene:'retired-option'}});assert.equal(reconciled.skipped,1);
 await store.mutateLibrary(l=>{l.presets.push(base)});
 const api=require(path.join(project,'app/api/preset-library/route.ts'));
 const post=body=>api.POST(new Request('http://127.0.0.1/api/preset-library',{method:'POST',body:JSON.stringify(body)}));
 const fork=await (await post({action:'fork',id:base.id})).json();assert.equal(fork.presets[0].parentId,base.id);assert.equal(fork.presets[0].version,2);
 assert.equal((await store.readLibrary()).presets.find(x=>x.id===base.id).version,1);
 const invalid=await post({action:'import',envelope:{...envelope,sha256:'0'.repeat(64)}});assert.equal(invalid.status,400);
 const beforeCount=(await store.readLibrary()).presets.length;assert.equal(beforeCount,2);
 const {captureProvenance}=require(path.join(project,'lib/provenance-server.ts'));
 const prompt=`adult 30-year-old woman, ${scene}, professional photograph`;
 const provenance=await captureProvenance(prompt,[base.id],{});
 assert.equal(provenance.presetContrib[scene],base.id);
 const input={id:'testjob',prompt,negativePrompt:'blur',seed:42,width:512,height:512,steps:12,cfg:3,sampler:'euler',scheduler:'simple',denoise:1,provenance,draft:{scene}};
 let originalBytes;
 for(let i=0;i<5;i++){
   const snapshot=freezeJob({...input,seed:i});assert(Object.isFrozen(snapshot.provenance.presetContrib));await jobs.saveFrozenRecord(snapshot);
   const filename=path.join(scratch,'.data','jobs',snapshot.hash+'.snapshot.json');const before=fs.readFileSync(filename,'utf8');
   await Promise.all([jobs.updateMarks(snapshot.hash,{marks:'keep'}),jobs.updateMarks(snapshot.hash,{notes:'fixture note'})]);
   assert.equal(fs.readFileSync(filename,'utf8'),before);assert.equal((await jobs.readMarks(snapshot.hash)).notes,'fixture note');
   if(i===3){const rating=(await jobs.readPresetRatings())[base.id];assert.equal(rating.n,4);assert.equal(rating.rate,null)}
   if(i===4){originalBytes=before;const rating=(await jobs.readPresetRatings())[base.id];assert.equal(rating.n,5);assert.equal(rating.rate,1)}
 }
 const snapshot=freezeJob(input);const bytes=JSON.stringify(snapshot);base.rotaries.scene='changed';assert.equal(JSON.stringify(snapshot),bytes);
 assert(originalBytes);
 console.log('PASS: zone ownership, canonical checksums, atomic rejection, sticky manual/pinned values, counted drift, immutable forks, frozen attribution, concurrent sidecars, byte-identical snapshots, n>=5 ranking.');
 console.log('Fixture data isolated at '+scratch);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>process.chdir(originalCwd));
