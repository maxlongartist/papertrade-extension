import {build} from 'esbuild';import {mkdir,copyFile,rm,readFile,cp} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));
if(manifest.version!==pkg.version)throw Error('Manifest and package versions differ.');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
const shared={bundle:true,outdir:'dist',target:'chrome116',define:{__PAPERTRADE_VERSION__:JSON.stringify(manifest.version)},banner:{js:'// Papertrade extension build: '+manifest.version}};
// Content scripts may be reinjected into the same isolated world. Keep each
// instance's callbacks bound to its own variables instead of shared globals.
await build({...shared,entryPoints:['extension/content.js'],format:'iife'});
await build({...shared,entryPoints:['extension/worker.js','extension/popup.js'],format:'esm'});
for(const name of ['manifest.json','popup.html'])await copyFile('extension/'+name,'dist/'+name);
await cp('extension/icons','dist/icons',{recursive:true});
console.log('Unpacked extension ready in dist/');
