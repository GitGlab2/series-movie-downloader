const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const startUrl = process.argv[2];
if (!startUrl) { console.error('Usage: node laroza_downloader.js "<laroza play url>"'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE = 'C:\\Users\\Islam\\Desktop\\New folder';

function sleep(ms){ const s=Date.now(); while(Date.now()-s<ms){} }
function curlText(url){ return execFileSync('curl.exe',['-s','-L','-g','-A',UA,url],{encoding:'utf8',maxBuffer:10*1024*1024}); }

const pageHtml = curlText(startUrl);

// series title from h1 "مسلسل X الحلقة"
let seriesTitle = 'Series';
const m = pageHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
if (m) {
  const t = m[1].trim();
  const m2 = t.match(/مسلسل\s+(.+?)\s+الحلقة/);
  if (m2) seriesTitle = m2[1].trim();
}
const safeSeries = seriesTitle.replace(/[\\/:*?"<>|]/g,'_');

// episode list: only relative ./video.php links (current series), not related videos
const epMap = new Map();
const re = /\.\/video\.php\?vid=([a-z0-9]+)/g;
let mm;
while ((mm = re.exec(pageHtml)) !== null) {
  if (!epMap.has(mm[1])) epMap.set(mm[1], mm[1]);
}
const labels = {};
const re2 = /\.\/video\.php\?vid=([a-z0-9]+)"[^>]*title="([^"]*)"/g;
while ((mm = re2.exec(pageHtml)) !== null) {
  labels[mm[1]] = mm[2];
}
const episodes = Array.from(epMap.keys()).map(vid => ({vid, label: labels[vid] || vid}));
console.log(`Series: ${seriesTitle} | Episodes: ${episodes.length}`);

const outDir = path.join(BASE, 'downloads', safeSeries);
fs.mkdirSync(outDir, {recursive:true});

function epNum(label) {
  const mm = (label||'').match(/الحلقة\s*(\d+)/);
  return mm ? parseInt(mm[1]) : 9999;
}
episodes.sort((a,b) => epNum(a.label) - epNum(b.label));

function acquireLink(ep) {
  console.log(`[${ep.label}] fetching download page`);
  const dlHtml = curlText(`https://laroza1.lat/download.php?vid=${ep.vid}`);
  const m = dlHtml.match(/https?:\/\/[^\s"'<>]*okprimeone[^\s"'<>]*/i);
  if (!m) throw new Error('no cdn link for ' + ep.vid);
  const link = m[0].replace(/&amp;/g, '&');
  console.log(`[${ep.label}] link ready`);
  return {vid: ep.vid, label: ep.label, link};
}

const links = [];
for (const ep of episodes) {
  try { links.push(acquireLink(ep)); }
  catch (e) { console.error(`[${ep.label}] ERROR:`, e.message); }
}
console.log(`\nAcquired ${links.length}/${episodes.length} links`);

async function downloadOne(l, idx) {
  const num = idx + 1;
  const numStr = String(num).padStart(2,'0');
  const dest = path.join(outDir, `${safeSeries} - S01E${numStr}.mkv`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) {
    console.log(`[E${numStr}] already downloaded, skip`);
    return dest;
  }
  console.log(`[E${numStr}] downloading`);
  execFileSync('curl.exe', ['-s','-L','-g','-A',UA,'-o',dest,l.link], {stdio:'inherit'});
  const size = fs.statSync(dest).size;
  console.log(`[E${numStr}] DONE (${(size/1048576).toFixed(1)} MB)`);
  return dest;
}

let i = 0;
const results = new Array(links.length);
const workers = Array.from({length: 4}, async () => {
  while (i < links.length) {
    const idx = i++;
    try { results[idx] = await downloadOne(links[idx], idx); }
    catch (e) { results[idx] = {error: e.message}; console.error(`[E${String(idx+1).padStart(2,'0')}] DL ERROR:`, e.message); }
  }
});
Promise.all(workers).then(() => {
  console.log('\n=== SUMMARY ===');
  results.forEach((x,i) => console.log(i+1, x));
  console.log('\nOutput folder:', outDir);
});
