const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const os = require('node:os');
const originalCwd=process.cwd();
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'hotprompter-cpu-'));
process.chdir(scratch);
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,filename);
const originalResolve=Module._resolveFilename;
Module._resolveFilename=function(name,...args){return originalResolve.call(this,name.startsWith('@/')?path.resolve(__dirname,'..',name.slice(2)):name,...args)};
const {selectEncoder}=require('../lib/comfy-encoder.ts');
const {freezeJob}=require('../lib/snapshot.ts');
const {buildQwenWorkflow}=require('../lib/comfyui.ts');
const fallback='qwen3vl_8b_int8_convrot.safetensors';
const q4='fixture-qwen3vl-Q4.gguf';
const info={CLIPLoader:{input:{required:{clip_name:[[fallback]],type:[['qwen_image']]}}},CLIPLoaderGGUF:{input:{required:{clip_name:[[q4]],type:[['qwen_image']]}}}};
assert.equal(selectEncoder(info,q4,fallback).loader,'CLIPLoaderGGUF');
const missing={...info,CLIPLoaderGGUF:{input:{required:{clip_name:[[]],type:[['qwen_image']]}}}};
assert.equal(selectEncoder(missing,q4,fallback).filename,fallback);
assert(selectEncoder(missing,q4,fallback).warning);
assert.throws(()=>selectEncoder({},q4,fallback));
const input={id:'test',prompt:'adult 30-year-old studio portrait',negativePrompt:'blur',seed:42,steps:20,cfg:3,width:512,height:512,sampler:'euler',scheduler:'simple',denoise:1};
const job=freezeJob({...input,models:{unet:'image.gguf',clip:q4,clipLoader:'CLIPLoaderGGUF',vae:'vae.safetensors'}});
const graph=buildQwenWorkflow(job);
assert.equal(graph['2'].class_type,'CLIPLoaderGGUF');
assert.equal(graph['2'].inputs.device,undefined);
assert.equal(graph['4'].inputs.negative_prompt,'blur');
assert(Object.isFrozen(job.models));
assert.notEqual(job.hash,freezeJob({...input,models:{...job.models,clip:fallback,clipLoader:'CLIPLoader'}}).hash);
(async()=>{
 const originalFetch=global.fetch;let tags=0;let sent;
 global.fetch=async(url,options)=>{
   if(String(url).endsWith('/api/tags')) {tags++;await new Promise(r=>setTimeout(r,10));return Response.json({models:[{name:'test-model'}]})}
   if(String(url).endsWith('/object_info')) return Response.json(info);
   assert(String(url).endsWith('/prompt'));sent=JSON.parse(options.body);return Response.json({prompt_id:'mock-hardening-job'});
 };
 try{
  const {listOllamaModels}=require('../lib/ollama.ts');
  await Promise.all([listOllamaModels(),listOllamaModels(),listOllamaModels()]);
  assert.equal(tags,1);await listOllamaModels();assert.equal(tags,1);
  global.hotprompterOllamaModels.expiresAt=0;await listOllamaModels();assert.equal(tags,2);
  const {POST}=require('../app/api/generate-image/route.ts');
  const response=await POST(new Request('http://127.0.0.1/api/generate-image',{method:'POST',body:JSON.stringify({...input,cfg:1,width:1024,height:768})}));
  assert.equal(response.status,202);const result=await response.json();
  assert.equal(result.width,512);assert.equal(result.height,512);assert.equal(result.cfg,3);
  assert.equal(result.models.clip,fallback);
  assert.equal(sent.extra_data.extra_pnginfo.hotprompter.seed,42);
  assert.equal(sent.extra_data.extra_pnginfo.hotprompter.hash,result.hash);
  console.log('PASS: GGUF selection, missing-file fallback, missing-model failure, correct loader inputs, model-aware frozen hashes, shared/concurrent/expired model cache, 512 cap, CFG coercion and metadata. No real submissions.');
 }finally{global.fetch=originalFetch;process.chdir(originalCwd)}
})().catch(error=>{console.error(error);process.exitCode=1});
