const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// Usage: node vidspeed_download.js <vidspeed /d/ url> <output_file>
const dUrl = process.argv[2];
const outFile = process.argv[3];
if (!dUrl || !outFile) { console.error('Usage: node vidspeed_download.js <vidspeed /d/ url> <output>'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const jar = path.join(os.tmpdir(), 'vidspeed_cookies.txt');
function sleep(ms){ const s=Date.now(); while(Date.now()-s<ms){} }
function curlText(url, extra=[]) {
  return execFileSync('curl.exe',['-s','-L','-g','-A',UA,'-b',jar,'-c',jar,...extra,url],{encoding:'utf8',maxBuffer:10*1024*1024});
}

let base = dUrl.replace(/\.html$/,'');
const m = base.match(/\/d\/([a-z0-9]+)_([onl])$/i);
if (!m) { console.error('Could not parse code/mode from', dUrl); process.exit(1); }
const code = m[1], mode = m[2];

function getHash() {
  const html = curlText(base, ['-e', `https://vidspeed.org/${code}`]);
  const mm = html.match(/name="hash"\s*value="([^"]+)"/);
  if (!mm) throw new Error('no hash (page may be rate-limited)');
  return mm[1];
}

function postOnce(hash) {
  const data = `op=download_orig&id=${code}&mode=${mode}&hash=${encodeURIComponent(hash)}`;
  const html = execFileSync('curl.exe',['-s','-L','-g','-X','POST','-A',UA,'-b',jar,'-c',jar,'-e',base,'-H','Content-Type: application/x-www-form-urlencoded','-d',data,base],{encoding:'utf8',maxBuffer:10*1024*1024});
  if (html.includes('Security error')) return null;
  const mm = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
  return mm ? mm[1].replace(/\s+/g,'') : null;
}

function getDirectLink() {
  let wait = 5000;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const hash = getHash();
      const link = postOnce(hash);
      if (link) return link;
    } catch (e) { /* fall through to wait */ }
    console.log(`security error / rate limit, waiting ${wait/1000}s (attempt ${attempt+1})`);
    sleep(wait);
    wait = Math.min(wait + 5000, 60000);
  }
  throw new Error('could not acquire direct link');
}

const link = getDirectLink();
console.log('direct link ready');
console.log(link);

// get expected size
let expected = 0;
try {
  const head = execFileSync('curl.exe',['-s','-L','-g','-I','-A',UA,link],{encoding:'utf8',maxBuffer:1024*1024});
  const cm = head.match(/content-length:\s*(\d+)/i);
  if (cm) expected = parseInt(cm[1]);
} catch (e) { /* ignore */ }

fs.mkdirSync(path.dirname(outFile), {recursive:true});
const existing = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
if (expected && existing === expected) {
  console.log('already complete:', outFile, `(${(existing/1048576).toFixed(1)} MB)`);
  process.exit(0);
}
if (existing > 0) console.log(`resuming from ${(existing/1048576).toFixed(1)} MB`);

execFileSync('curl.exe',
  ['-L','-g','-C','-','--retry','8','--retry-delay','5','--retry-all-errors','-A',UA,'-o',outFile,link],
  {stdio:'inherit'});

const size = fs.statSync(outFile).size;
console.log('DONE', outFile, (size/1048576).toFixed(1), 'MB',
  expected ? `(expected ${(expected/1048576).toFixed(1)} MB)` : '');
if (expected && size !== expected) {
  console.error('WARNING: size mismatch, re-run to resume');
  process.exit(2);
}
