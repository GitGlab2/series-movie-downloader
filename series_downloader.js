const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const startUrl = process.argv[2];
if (!startUrl) { console.error('Usage: node series_downloader.js "<cimalight watch url>"'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE = 'C:\\Users\\Islam\\Desktop\\New folder';

function sleep(ms){ const s=Date.now(); while(Date.now()-s<ms){} }

function curlText(url, extraArgs=[]) {
  return execFileSync('curl.exe', ['-s','-L','-A',UA,...extraArgs,url], {encoding:'utf8',maxBuffer:10*1024*1024});
}
function curlPost(url, data, referer) {
  return execFileSync('curl.exe', ['-s','-L','-X','POST','-A',UA,'-e',referer,'-H','Content-Type: application/x-www-form-urlencoded','-d',data,url], {encoding:'utf8',maxBuffer:10*1024*1024});
}

async function main() {
  const pageHtml = curlText(startUrl);

  let seriesTitle = 'Series';
  const mSeries = pageHtml.match(/<dt>المسلسل<\/dt>\s*<dd>([^<]+)<\/dd>/);
  if (mSeries) seriesTitle = mSeries[1].trim();
  if (seriesTitle === 'Series') {
    const m2 = pageHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (m2) {
      const t = m2[1].trim();
      const m3 = t.match(/مسلسل\s+(.+?)\s+الحلقة/);
      if (m3) seriesTitle = m3[1].trim();
    }
  }
  const safeSeries = seriesTitle.replace(/[\\/:*?"<>|]/g, '_');

  const epMap = new Map();
  const re = /href="(https:\/\/e\.cimalight\.co\/watch\.php\?vid=([a-z0-9]+))"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(pageHtml)) !== null) {
    const vid = m[2];
    const label = m[3].trim();
    if (!epMap.has(vid)) epMap.set(vid, {vid, url: m[1], label});
  }
  const episodes = Array.from(epMap.values());
  if (episodes.length === 0) { console.error('No episodes found on page.'); process.exit(1); }
  function epNum(label) {
    const mm = (label||'').match(/الحلقة\s*(\d+)/);
    return mm ? parseInt(mm[1]) : 9999;
  }
  episodes.sort((a,b) => epNum(a.label) - epNum(b.label));
  console.log(`Series: ${seriesTitle}  |  Episodes: ${episodes.length}`);

  const outDir = path.join(BASE, 'downloads', safeSeries);
  fs.mkdirSync(outDir, {recursive:true});
  const linksFile = path.join(BASE, `links_${safeSeries}.json`);

  function parseEmbedCode(html) {
    const mm = html.match(/vidspeed\.org\/embed-([a-z0-9]+)\.html/i);
    return mm ? mm[1] : null;
  }
  function getHash(code) {
    const url = `https://vidspeed.org/d/${code}_n`;
    const html = curlText(url, ['-e', `https://vidspeed.org/${code}`]);
    const mm = html.match(/name="hash"\s*value="([^"]+)"/);
    if (!mm) throw new Error('no hash for ' + code);
    return mm[1];
  }
  function getDirectLink(code, hash) {
    const url = `https://vidspeed.org/d/${code}_n`;
    const data = `op=download_orig&id=${code}&mode=n&hash=${encodeURIComponent(hash)}`;
    const html = curlPost(url, data, url);
    if (html.includes('Security error')) throw new Error('SECURITY_ERROR');
    const mm = html.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/);
    if (!mm) throw new Error('no direct link for ' + code);
    return mm[1].replace(/\s+/g, '');
  }
  async function acquireLink(ep, attempt=0) {
    console.log(`[${ep.label || ep.vid}] acquiring link (attempt ${attempt})`);
    const watchHtml = curlText(`https://e.cimalight.co/watch.php?vid=${ep.vid}`);
    const code = parseEmbedCode(watchHtml);
    if (!code) throw new Error(`no embed code ${ep.vid}`);
    let hash;
    try { hash = getHash(code); } catch(e){ throw e; }
    try {
      const link = getDirectLink(code, hash);
      console.log(`[${ep.label || ep.vid}] link ready`);
      return { vid: ep.vid, label: ep.label, code, link };
    } catch (e) {
      if (e.message === 'SECURITY_ERROR' && attempt < 6) {
        console.log(`[${ep.label || ep.vid}] security error, waiting 5s then retry`);
        sleep(5000);
        return acquireLink(ep, attempt+1);
      }
      throw e;
    }
  }

  let links = [];
  if (fs.existsSync(linksFile)) {
    try { links = JSON.parse(fs.readFileSync(linksFile,'utf8')); } catch(e){ links=[]; }
  }
  const have = new Set(links.map(l=>l.vid));

  for (const ep of episodes) {
    if (have.has(ep.vid)) { console.log(`[${ep.label}] link cached`); continue; }
    try {
      const r = await acquireLink(ep);
      links.push(r);
      fs.writeFileSync(linksFile, JSON.stringify(links, null, 2));
      sleep(2000);
    } catch (e) {
      console.error(`[${ep.label}] ACQUIRE ERROR:`, e.message);
    }
  }
  console.log(`\nAcquired ${links.length}/${episodes.length} links`);

  async function downloadOne(l, idx) {
    const num = idx + 1;
    const numStr = String(num).padStart(2,'0');
    const dest = path.join(outDir, `${safeSeries} - S01E${numStr}.mp4`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000000) {
      console.log(`[E${numStr}] already downloaded, skip`);
      return dest;
    }
    console.log(`[E${numStr}] downloading`);
    execFileSync('curl.exe', ['-s','-L','-A',UA,'-o',dest,l.link], {stdio:'inherit'});
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
  await Promise.all(workers);
  console.log('\n=== SUMMARY ===');
  results.forEach((x,i) => console.log(i+1, x));
  console.log('\nOutput folder:', outDir);
}

main().catch(e => { console.error(e); process.exit(1); });
