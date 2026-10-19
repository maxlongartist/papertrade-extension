// Build, test and publish only the explicit extension payload. Never reads bot or
// wallet data, updates Chrome profiles, or replaces an unpacked installed folder.
import {readFile,writeFile,readdir,mkdtemp,rm,mkdir,cp,copyFile,rename,access} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {homedir} from 'node:os';import {spawnSync,execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const project=fileURLToPath(new URL('..',import.meta.url)),outputs=resolve(project,'..'),downloads=join(homedir(),'Downloads');
const manifest=JSON.parse(await readFile(join(project,'extension/manifest.json'),'utf8')),pkg=JSON.parse(await readFile(join(project,'package.json'),'utf8'));
assert.equal(manifest.version,pkg.version,'manifest/package version mismatch');assert.match(manifest.version,/^\d+(\.\d+){0,3}$/);assert.ok(manifest.version.split('.').every(v=>Number(v)<=65535));
const version=manifest.version,name='papertrade-manual-pair-v'+version;
const run=args=>{const r=spawnSync(process.execPath,args,{cwd:project,encoding:'utf8',maxBuffer:16777216,timeout:120000});if(args[0]==='--test')writeFileSync(join(outputs,'papertrade-v'+version+'-tests.txt'),r.stdout??'');if(r.status!==0)throw Error(r.error?.message??(r.stderr||r.stdout.slice(-4000)||'Build/test failed'));return r.stdout;};
run(['build.mjs']);
const testFiles=(await readdir(join(project,'tests'))).filter(f=>f.endsWith('.test.js')).sort().map(f=>'tests/'+f);
const testLog=run(['--test',...testFiles]);await writeFile(join(outputs,'papertrade-v'+version+'-tests.txt'),testLog);
const testsPassed=Number(/^# pass (\d+)$/m.exec(testLog)?.[1]);assert.ok(testsPassed>0);assert.match(testLog,/^# fail 0$/m);
const files=['chart-bridge.js','content.js','manifest.json','popup.html','popup.js','worker.js','README.md','icons/icon-16.png','icons/icon-32.png','icons/icon-48.png','icons/icon-128.png'];
const staging=await mkdtemp(join(outputs,'.papertrade-release-'));const payload=join(staging,'payload');await mkdir(payload);await mkdir(downloads,{recursive:true});
const latest=join(downloads,'papertrade-manual-pair-latest.zip'),latestStage=latest+'.tmp-'+process.pid;
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
try{
 for(const f of files){const source=f==='README.md'?join(project,f):join(project,'dist',f);const bytes=await readFile(source);if(f.endsWith('.js'))assert.ok(bytes.toString().startsWith('// Papertrade extension build: '+version+'\n'),'stale bundle '+f);await mkdir(dirname(join(payload,f)),{recursive:true});await writeFile(join(payload,f),bytes);}
 assert.equal(JSON.parse(await readFile(join(payload,'manifest.json'),'utf8')).version,version);
 const verifyZip=async zip=>{const names=execFileSync('/usr/bin/unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(names,[...files].sort(),'ZIP must contain only the declared extension payload');for(const f of files)assert.deepEqual(execFileSync('/usr/bin/unzip',['-p',zip,f]),await readFile(join(payload,f)),'ZIP payload mismatch: '+f);};
 const fileNames=async(folder,prefix='')=>{const names=[];for(const entry of await readdir(folder,{withFileTypes:true})){const relative=prefix+entry.name;if(entry.isDirectory())names.push(...await fileNames(join(folder,entry.name),relative+'/'));else names.push(relative);}return names.sort();};
 const verifyFolder=async folder=>{assert.deepEqual(await fileNames(folder),[...files].sort(),'existing folder has unexpected contents');for(const f of files)assert.deepEqual(await readFile(join(folder,f)),await readFile(join(payload,f)),'Version already exists with different payload: '+f);};
 const zip=join(staging,name+'.zip');execFileSync('/usr/bin/zip',['-q',zip,...files],{cwd:payload});await verifyZip(zip);
 // Immutable versioned destinations: a rerun verifies existing bytes instead of
 // silently replacing a release that might already be loaded in Chrome.
 for(const parent of [outputs,downloads]){const folder=join(parent,name),archive=join(parent,name+'.zip');if(await exists(folder))await verifyFolder(folder);if(await exists(archive))await verifyZip(archive);}
 for(const parent of [outputs,downloads]){const folder=join(parent,name),archive=join(parent,name+'.zip');if(!await exists(folder))await cp(payload,folder,{recursive:true,errorOnExist:true,force:false});if(!await exists(archive))await copyFile(zip,archive);}
 const archive=join(downloads,name+'.zip');await copyFile(archive,latestStage);await rename(latestStage,latest);
 const bytes=await readFile(archive);const report={version,testsPassed,productionBuildPassed:true,zipRootManifest:true,payloadFiles:files,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,downloadZip:archive,latestZip:latest,unpackedFolder:join(downloads,name),fundedExecutionVerified:false};
 await writeFile(join(outputs,'papertrade-v'+version+'-release.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await rm(staging,{recursive:true,force:true});await rm(latestStage,{force:true});}
