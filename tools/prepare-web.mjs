import {readFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=new URL('../build/web/',import.meta.url);
await cp(new URL('../client/assets/resources/mir/webui/',import.meta.url),new URL('webui/',dir),{recursive:true});
await cp(new URL('../assets/auth-web/',import.meta.url),new URL('webui/auth/',dir),{recursive:true});
const settingsPath=new URL('src/settings.json',dir);
const settings=JSON.parse(await readFile(settingsPath,'utf8'));
// Paired with NEAREST textures: MSAA otherwise exposes black clear color at
// adjoining legacy cutouts when the 800x600 game is scaled fractionally.
settings.engine.macros ??= {};
settings.engine.macros.ENABLE_WEBGL_ANTIALIAS=false;
await writeFile(settingsPath,JSON.stringify(settings));
const path=new URL('index.html',dir);
let html=await readFile(path,'utf8');
// Preserve native game colors: official Dark Reader opt-out for already themed sites.
if(!html.includes('name="darkreader-lock"'))html=html.replace('<head>','<head>\n<meta name="darkreader-lock">');
html=html.replace(/<title>.*?<\/title>/,'<title>玛法 · Mir2</title>')
  .replace(/<h1 class="header">.*?<\/h1>/s,'').replace(/<p class="footer">[\s\S]*?<\/p>/,'')
  .replace('cc_exact_fit_screen="false"','cc_exact_fit_screen="true"')
  .replace('style="width: 1280px; height: 960px;"','')
  .replace('width="1280" height="960"','width="800" height="600"')
  .replace('content="portrait"','content="landscape"');
html=html.replace('</body>',`<button id="display-scale" style="position:fixed;right:8px;top:8px;z-index:30;background:#171714;color:#d2c59d;border:1px solid #585442;padding:5px 8px" type="button">原始尺寸</button><script>
(()=>{const button=document.getElementById('display-scale');button.addEventListener('click',()=>{const fit=document.body.classList.toggle('fit-window');button.textContent=fit?'适应窗口':'原始尺寸';window.dispatchEvent(new Event('resize'));document.getElementById('GameCanvas')?.focus();});})();
</script></body>`);
await writeFile(path,html);
await writeFile(new URL('style.css',dir),`html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#0d100e;}body{display:flex;align-items:center;justify-content:center;}*{box-sizing:border-box;}#GameDiv{position:relative;width:min(800px,100vw,133.333333vh)!important;height:min(600px,75vw,100vh)!important;overflow:hidden;margin:0;}#Cocos3dGameContainer,#GameCanvas{width:100%;height:100%;outline:none;touch-action:none;}canvas{display:block;}body.fit-window #GameDiv{width:min(100vw,133.333333vh)!important;height:min(75vw,100vh)!important;}\n`);
console.log(`Prepared ${fileURLToPath(path)}`);
