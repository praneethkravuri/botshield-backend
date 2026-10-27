/* eslint-env node */
// Local fictional preview rendering only; never imports email delivery or credentials.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {default:AxeBuilder}=await import(process.env.AXE_MODULE || '@axe-core/playwright');
import {renderWeeklyReportEmail,renderSecurityAlertEmail} from '../app/lib/merchant-email-templates.js';
const root=fileURLToPath(new URL('../docs/email-previews',import.meta.url));
const logo=await readFile(new URL('../public/botshield-official-logo-transparent.png',import.meta.url));
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(!/^\/(weekly|alert|test)\.html$/.test(path)){res.writeHead(404);res.end();return;}
  const html=await readFile(`${root}${path}`);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);
 } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
const results=[];
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 for(const name of ['weekly','alert','test']) {
  for(const [variant,width,colorScheme] of [['desktop',680,'light'],['mobile',320,'light'],['dark',680,'dark'],['mobile-dark',320,'dark']]) {
   const context=await browser.newContext({viewport:{width,height:1000},colorScheme});
   const page=await context.newPage();
   await page.route('https://botshield-backend.onrender.com/botshield-official-logo-transparent.png',r=>r.fulfill({contentType:'image/png',body:logo}));
   await page.goto(`${base}/${name}.html`);
   await page.locator('img').evaluate(img=>img.decode());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}/${variant}: no horizontal overflow`);
   assert.equal(await page.locator('img').evaluate(img=>img.naturalWidth),208);
   const axe=await new AxeBuilder({page}).disableRules(['region','landmark-one-main']).analyze();
   assert.deepEqual(axe.violations,[],`${name}/${variant}: email-appropriate accessibility checks`);
   await page.screenshot({path:`${root}/${name}-${variant}.png`,fullPage:true});
   results.push({template:name,variant,width,colorScheme,horizontalOverflow:false,axeViolations:axe.violations});
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:320,height:1000},colorScheme:'dark'});
   const page=await context.newPage();
  await page.route('**/*.png',r=>r.abort());
  await page.goto(`${base}/${name}.html`);
  assert.ok(await page.locator('body').innerText().then(t=>t.includes('BotShield')));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`${root}/${name}-images-blocked.png`,fullPage:true});
  results.push({template:name,variant:'images-blocked',width:320,visibleBrandFallback:true,horizontalOverflow:false});
  await context.close();
 }
 // Simulate a client retaining inline styles but discarding optional enhancements.
 for (const name of ['weekly','alert','test']) {
  const context=await browser.newContext({viewport:{width:320,height:1000}});
  const page=await context.newPage();
  await page.route('**/*.png',r=>r.fulfill({contentType:'image/png',body:logo}));
  await page.goto(`${base}/${name}.html`);
  await page.evaluate(()=>{
   document.querySelectorAll('style').forEach(el=>el.remove());
   document.querySelectorAll('[style]').forEach(el=>{
    el.style.removeProperty('background-image');
    el.style.removeProperty('box-shadow');
    el.style.removeProperty('border-radius');
   });
  });
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const axe=await new AxeBuilder({page}).disableRules(['region','landmark-one-main']).analyze();
  assert.deepEqual(axe.violations,[],`${name}: inline-only solid-color fallback`);
  results.push({template:name,variant:'inline-only-no-effects',width:320,horizontalOverflow:false,axeViolations:axe.violations});
  await context.close();
 }
 for(const [name,email] of [
  ['weekly-long',renderWeeklyReportEmail({shop:'Cedar & Wick — '+ 'VeryLongShopName'.repeat(18),report:{requestsAnalyzed:1234567890123,blocked:3456789012,challenged:9876543210,allowed:999999999999,topReasonCodes:[{label:'VERY_LONG_RECORDED_REASON_'.repeat(12),count:1234567890123}],protectionActive:false}})],
  ['alert-long',renderSecurityAlertEmail({shop:'LongShop'.repeat(22),decision:'challenge',threatLevel:'medium',pathVisited:'/'+ 'a'.repeat(300),eventId:'event-'.repeat(60),reasonCodes:['REASON_CODE_'.repeat(30)]})],
  ['weekly-zero',renderWeeklyReportEmail({shop:'preview.myshopify.com',report:{requestsAnalyzed:0,blocked:0,challenged:0,allowed:0,topReasonCodes:[]}})],
  ['weekly-missing',renderWeeklyReportEmail({shop:'preview.myshopify.com'})]
 ]) {
  for(const width of [320,680]) {
   const context=await browser.newContext({viewport:{width,height:1000}});
   const page=await context.newPage();
   await page.route('**/*.png',r=>r.fulfill({contentType:'image/png',body:logo}));
   await page.setContent(email.html);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name} stress layout ${width}`);
   results.push({template:name,width,horizontalOverflow:false});
   await context.close();
  }
 }
 for(const level of ['high','low','unknown']) {
  for(const colorScheme of ['light','dark']) {
   const context=await browser.newContext({viewport:{width:320,height:1000},colorScheme});
   const page=await context.newPage();
   await page.route('**/*.png',r=>r.fulfill({contentType:'image/png',body:logo}));
   await page.goto(`${base}/alert.html`);
   await page.setContent(renderSecurityAlertEmail({shop:'preview.myshopify.com',decision:level==='high'?'block':'allow',threatLevel:level,riskScore:level==='high'?90:10}).html);
   const axe=await new AxeBuilder({page}).disableRules(['region','landmark-one-main']).analyze();
   assert.deepEqual(axe.violations,[],`${level}/${colorScheme} severity contrast`);
   results.push({template:'alert-'+level,width:320,colorScheme,axeViolations:axe.violations});
   await context.close();
  }
 }
 await writeFile(`${root}/browser-checks.json`,JSON.stringify({renderer:'Chromium (not an actual email client)',emailClientVerification:'Gmail, Outlook, and Apple Mail not run',axeExcludedRules:['region','landmark-one-main'],checks:results},null,2)+'\n');
 console.log(`PASS ${results.length} light/dark/mobile/image-blocked/stress checks. Zero email-appropriate axe violations.`);
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
