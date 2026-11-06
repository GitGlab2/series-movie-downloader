# Series Downloader Agent Rules

When the user gives a link to a video page on `e.cimalight.co` or `laroza1.lat` (or similar), download it/them following these rules.

## Detect content type
- **Series** (`e.cimalight.co/watch.php`): page has a season/episode list → download all episodes.
- **Movie** (`e.cimalight.co/watch.php`): page is a single film → download the single file.
- **laroza** (`laroza1.lat/play.php` or `video.php`): series with episodes → download all; single movie → download it.

## General rules
- Download **all episodes** of a series, not just the given one.
- Download in **parallel** (concurrent), not sequentially.
- Use the **highest available quality** (on vidspeed: `_o` Original > `_n` Normal > `_l` Low).
- Name files as: `{Title} - S01E{NN}.mp4` for series, `{Title}.mp4` for movies.
- Save to: `C:\Users\Islam\Desktop\New folder\downloads\{Title}\`.
- Reuse cached links/files (resume support).

## Workflow by site
### cimalight.co
- NOTE: e.cimalight.co is Cloudflare-protected; `curl` may return 403. Use the browser tools (`browser.tabs.open` + `browser.evaluate`) to read pages when blocked.
- Series: `node "C:\Users\Islam\Desktop\New folder\series_downloader.js" "<url>"` (vidspeed, max 480p).
- Movie: open `https://e.cimalight.co/downloads.php?vid=<VID>`. This lists download servers. Prefer the `vidspeed.org/d/<code>_<mode>` link (modes: `o`=Original, `n`=Normal, `l`=Low). Then:
  `node "C:\Users\Islam\Desktop\New folder\vidspeed_download.js" "https://vidspeed.org/d/<code>_o" "<output.mp4>"`
- Avoid `anafast.org` links — that host is unreachable from this environment.
- If `downloads.php?vid=<VID>` returns **File not found** (or only anafast), search the site: `https://e.cimalight.co/search.php?keywords=<title>` (open in browser; Cloudflare blocks curl). The same movie often exists under several vids; pick the one whose download page has a working server.
- Download-server landscape (from cimalight): `vidspeed.org` (works, if the file isn't deleted), `anafast.org` (unreachable), `krakenfiles`/`faster-down`/`mixdrop`/`morencius` (blocked/timeout), `frdl` (often 404), `multiup.io` (mirror list is JS-only).
- **Vikingfile works** via browser-assisted flow: open `https://vikingfile.com/f/<code>` in the browser; Cloudflare Turnstile auto-passes in ~10s and `#download-link` then holds the direct URL (`https://vikingfile.com/d/<id>/<name>.mp4`). Download it with `curl.exe -L -g -C - -e "https://vikingfile.com/f/<code>"` (GET + Referer required; HEAD returns 403, ranges/206 are fine).

### laroza1.lat
- `node "C:\Users\Islam\Desktop\New folder\laroza_downloader.js" "<url>"`
- Download page: `https://laroza1.lat/download.php?vid=<VID>` provides direct okprimeone CDN links. Some episodes may lack a link (streaming only) — report those. URLs contain brackets; use curl `-g`. Content may be MP4 despite `.mkv` extension — rename to `.mp4`.

## Technical notes
- vidspeed direct download flow: GET `https://vidspeed.org/d/<code>_<mode>` for a `hash`, then POST `op=download_orig&id=<code>&mode=<mode>&hash=<hash>`; parse the `.mp4` href. Retry on "Security error1" after 5s. Acquire links sequentially (rate limit), then download in parallel.
- No ffmpeg/yt-dlp available; rely on curl.exe.

## Communication
- Reply in Arabic.
- Report final file list, folder path, and any unavailable episodes/qualities.