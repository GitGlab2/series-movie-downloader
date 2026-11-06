# Series & Movie Downloader

مجموعة سكربتات Node.js لتحميل **جميع حلقات** أي مسلسل (أو فيلم) من المواقع المدعومة، بجودةٍ هي الأعلى متاحة، مع دعم الاستئناف (resume) والتحميل المتوازي.

## المواقع المدعومة

| الموقع | السكربت | ملاحظات |
|---|---|---|
| `e.cimalight.co` (مسلسل) | `series_downloader.js` | vidspeed، حد أقصى 480p |
| `e.cimalight.co` (فيلم) | `vidspeed_download.js` | Original/Normal/Low (حتى 1920×800) |
| `laroza1.lat` (مسلسل/فيلم) | `laroza_downloader.js` | CDN okprimeone (mp4/mkv) |

## المتطلبات
- Node.js (v18+)
- `curl.exe` (موجود افتراضياً على Windows 10/11)
- لا حاجة لـ ffmpeg/yt-dlp

## الاستخدام

### مسلسل على cimalight
```
node "series_downloader.js" "https://e.cimalight.co/watch.php?vid=<VID>"
```

### فيلم على cimalight (via vidspeed)
1. افتح `https://e.cimalight.co/downloads.php?vid=<VID>` (في المتصفح إن لزم).
2. انسخ رابط `vidspeed.org/d/<code>_<mode>` (o=Original, n=Normal, l=Low).
3. `node "vidspeed_download.js" "https://vidspeed.org/d/<code>_o" "C:\...\downloads\<Title>\<Title>.mp4"`

### laroza
```
node "laroza_downloader.js" "https://laroza1.lat/play.php?vid=<VID>"
```

## قواعد التسمية والحفظ
- مسلسل: `{Title} - S01E{NN}.mp4`
- فيلم: `{Title}.mp4`
- المجلد: `downloads/{Title}/`
- الاستئناف مدعوم: إعادة تشغيل السكربت يكمل من حيث توقف.
- تُحمّل الحلقات إلى ملفات مؤقتة `.part` ثم تُنقل للاسم النهائي بعد نجاح التحميل؛ لذلك لا تُعامل الملفات الجزئية كحلقات مكتملة.
- يمكن تغيير المجلد الأساسي (ومكان حفظ روابط الحلقات المؤقتة) بتعيين متغير البيئة `SERIES_DOWNLOADER_HOME`. القيمة الافتراضية: `C:\Users\Islam\Desktop\New folder`.
- سكربت laroza يحفظ الحلقات بامتداد `.mp4` وفق قاعدة تسمية المشروع.

## ملاحظات
- `anafast.org` غير قابل للوصول من هذه البيئة.
- بعض حلقات laroza لا تحتوي رابط تحميل (مشاهدة فقط) — يُبلّغ عنها.
- الملفات (downloads/, links*.json, debug*.html, test_*.js) **غير** مدرجة في المستودع.