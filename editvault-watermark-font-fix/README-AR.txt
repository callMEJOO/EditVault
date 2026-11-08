EditVault — إصلاح مشكلة Fontconfig على Windows

السبب:
نسخة FFmpeg عندك لا تجد إعدادات Fontconfig الافتراضية، لأن فلتر drawtext لم يكن يحدد ملف خط صراحةً. لذلك فشلت معاينات الفيديو الـ11، لكن السكريبت أبقى ملفات الفيديو الأصلية والمعاينات السابقة كما هي.

التثبيت:
1) فك محتويات ZIP داخل جذر مشروع EditVault (نفس المجلد الذي يحتوي client وserver).
2) افتح CMD من جذر المشروع ونفّذ:
   "C:\Program Files\nodejs\node.exe" tools\fix-editvault-watermark-font.js
3) تأكد أن خط Arial موجود:
   dir C:\Windows\Fonts\arial.ttf
4) ادخل مجلد السيرفر:
   cd /d "C:\Users\ys757\Music\edit-marketplace-mvp\edit-marketplace\server"
5) اختبر العلامة المائية على أول 3 ثوانٍ من فيديو demo فقط:
   ffmpeg -hide_banner -loglevel error -y -i "uploads\demo-neon.mp4" -vf "drawtext=fontfile='C\:/Windows/Fonts/arial.ttf':text='EDITVAULT':fontcolor=white@0.42:fontsize=h/20:x=(w-text_w)/2:y=(h-text_h)/2" -t 3 -an "uploads\watermark-font-test.mp4"

إذا نجح الأمر وأنشأ uploads\watermark-font-test.mp4، احذف ملف الاختبار أو احتفظ به، ثم شغّل:
   "C:\Program Files\nodejs\node.exe" src\db\backfill-preview-watermarks.js

لا تشغّل backfill الكامل قبل نجاح اختبار الثلاث ثواني. المعالجة تعيد ترميز الفيديوهات وقد تستغرق بعض الوقت.
