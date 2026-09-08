import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('../build/web/',import.meta.url);
const settingsPath=new URL('src/settings.json',dir);
const settings=JSON.parse(await readFile(settingsPath,'utf8'));
// Paired with NEAREST textures: MSAA otherwise exposes black clear color at
// adjoining legacy cutouts when the 800x600 game is scaled fractionally.
settings.engine.macros ??= {};
settings.engine.macros.ENABLE_WEBGL_ANTIALIAS=false;
await writeFile(settingsPath,JSON.stringify(settings));
const path=new URL('index.html',dir);
let html=await readFile(path,'utf8');
html=html.replace(/<title>.*?<\/title>/,'<title>玛法 · Mir2</title>')
  .replace(/<h1 class="header">.*?<\/h1>/s,'').replace(/<p class="footer">[\s\S]*?<\/p>/,'')
  .replace('cc_exact_fit_screen="false"','cc_exact_fit_screen="true"')
  .replace('style="width: 1280px; height: 960px;"','')
  .replace('width="1280" height="960"','width="800" height="600"')
  .replace('content="portrait"','content="landscape"');
await writeFile(path,html);
await writeFile(new URL('style.css',dir),`html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0d100e;}body{display:flex;align-items:center;justify-content:center;}*{box-sizing:border-box;}#GameDiv{position:relative;width:min(100vw,133.333333vh)!important;height:min(75vw,100vh)!important;overflow:hidden;margin:0;}#Cocos3dGameContainer,#GameCanvas{width:100%;height:100%;outline:none;touch-action:none;}canvas{display:block;}\n`);
console.log(`Prepared ${fileURLToPath(path)}`);
