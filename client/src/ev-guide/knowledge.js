// EditVault's own, editable help knowledge base. No outside provider or API key.
// Every entry is reviewed copy, not a claim to access user account information.
const faq = [];
const add = (category, ar, en, answerAr, answerEn, aliases = [], path = '') => {
  faq.push({ id: `ev-${faq.length + 1}`, category, question: { ar, en }, answer: { ar: answerAr, en: answerEn }, aliases, path });
};

// Basics and navigation
add('start','إيه هو EditVault؟','What is EditVault?',
  'EditVault منصة للمبدعين: تقدر تستكشف إيديتات، وحزم مشاهد، وتستخدم أدوات المونتاج في EditLab، وتجمع نقاط داخل الموقع.','EditVault is a creator platform with edits, scene packs, EditLab tools, and an in-site points system.',
  ['الموقع ده ايه','اي هو الموقع','ايه فايدة الموقع','how does this site work'],'/');
add('start','أبدأ منين لو أول مرة؟','Where should I start?',
  'ابدأ بـ«استكشف» علشان تتفرج على الإيديتات، وبعدها جرّب EditLab. لو محتاج محتوى بالنقاط، افتح «جمع النقاط» وشوف المتاح.','Explore edits first, then try EditLab. Visit Earn Points if you want in-site points.',
  ['انا جديد','مش فاهم الموقع','first time here','ازاي ابدا'],'/explore');
add('start','هل لازم أسجل حساب؟','Do I need an account?',
  'تقدر تتصفح أقسام عامة من غير حساب. العمليات المرتبطة برصيدك أو مكتبتك أو رفع المحتوى بتحتاج تسجيل دخول.','Public pages can be browsed without an account. Wallet, library and uploads require signing in.',
  ['التسجيل اجباري','ينفع من غير حساب','guest'],'/');
add('start','أغيّر اللغة إزاي؟','How do I change the language?',
  'استخدم زر اختيار اللغة في الموقع أو من إعدادات الحساب إن كان متاحًا. تغيير اللغة مش محتاج تسجيل دخول، واختيارك بيتحفظ على جهازك.','Use the site language control, no sign-in required. The choice is saved in your browser.',
  ['انجليزي','لغة عربية','switch language','الترجمة','change to arabic']);
add('start','الموقع بيشتغل على الموبايل؟','Does it work on mobile?',
  'الموقع مصمم علشان يشتغل من المتصفح على الموبايل والكمبيوتر. لو جزء من أدوات الفيديو تقيل، جرّبه على متصفح حديث أو كمبيوتر أقوى.','EditVault supports mobile and desktop browsers. Heavy video tools may run better on a desktop.',
  ['تليفون','اندرويد','ايفون','phone','mobile']);
add('start','فين EditLab؟','Where is EditLab?',
  'افتح قسم «EditLab» من القائمة. فيه أدوات تخص تحسين الفيديو والألوان والصوت؛ المتاح فعليًا بيعتمد على الأدوات الظاهرة عندك.','Open EditLab from the navigation to find video, color and audio tools.',
  ['الاب','معمل المونتاج','ادوات المونتاج'],'/editlab');
add('start','فين الإيديتات؟','Where are the edits?',
  'ادخل «استكشف الإيديتات» وتصفح الأعمال المتاحة، أو استخدم البحث لو بتدور على إيديت محدد.','Open Explore to browse edits, or search for a specific one.',
  ['استكشف','explore edits','تصفح الايديتات'],'/explore');
add('start','فين حزم المشاهد؟','Where are Scene Packs?',
  'هتلاقي قسم «Scene Packs» في القائمة. منه تقدر تستكشف الحزم المتاحة وتشوف خيارات المشاركة لو حسابك مؤهل.','Open the Scene Packs section to browse available packs and contribution options.',
  ['قسم سين باك','scene pack page','حزم'],'/scene-packs');
add('start','فين مكتبتي؟','Where is my library?',
  'افتح «مكتبتي» بعد تسجيل الدخول. هناك بتراجع المحتوى اللي حصلت عليه داخل حسابك.','Open My Library after signing in to see content associated with your account.',
  ['مكتبتي فين','حاجاتي اللي اشتريتها','my library'],'/library');
add('start','إزاي أوصل لصفحة طلبات التعديل؟','Where are edit requests?',
  'من القائمة افتح «طلبات التعديل» علشان تشوف الطلبات أو الخيارات المتاحة لتقديم طلب.','Open Requests from the main menu to view available edit requests.',
  ['طلب ايديت','عايز ايديت مخصوص','request an edit'],'/requests');
add('start','إزاي أرجع للصفحة الرئيسية؟','How do I return home?',
  'اضغط على شعار EditVault أو على «الرئيسية» في القائمة.','Click the EditVault logo or Home in the navigation.',
  ['الرئيسيه','home page'],'/');

// Auth and profile
add('account','إزاي أعمل حساب جديد؟','How do I sign up?',
  'من أعلى الموقع اختار إنشاء حساب، اكتب اسم العرض والبريد وكلمة مرور قوية، وبعدها اضغط إنشاء حساب. لو حصل خطأ ابعتلي نص الرسالة من غير كلمة السر.','Choose Sign Up, enter your display name, email and a strong password, then submit. Never share your password.',
  ['ساين اب','تسجيل','انشاء حساب','register','signup','ازاي اعمل اكونت','ازاي اسجل']);
add('account','إزاي أسجل دخول؟','How do I log in?',
  'اضغط «تسجيل الدخول»، اكتب بريدك وكلمة المرور اللي سجلت بيها، وبعدها افتح حسابك.','Select Log In, enter your registered email and password, then sign in.',
  ['لوجين','log in','login','ادخل حسابي']);
add('account','نسيت كلمة المرور','I forgot my password',
  'لو مش ظاهر قدامك خيار لاسترجاع كلمة المرور، متشاركش كلمة السر مع أي حد. تواصل مع إدارة EditVault للحصول على طريقة الاسترجاع المعتمدة.','If no password reset option appears, contact EditVault support. Never share your password.',
  ['باسورد','password reset','استرجاع كلمة السر','مش فاكر الباسورد']);
add('account','ليه تسجيل الدخول مش شغال؟','Why is login failing?',
  'تأكد من البريد وكلمة المرور واتصال الإنترنت. جرّب تحديث الصفحة؛ ولو لسه فيه مشكلة ابعت نص رسالة الخطأ فقط من غير أي بيانات دخول.','Double-check credentials and connectivity. Refresh once, then share only the error text with support.',
  ['مش عارف اسجل','login error','error في لوجين','تسجيل دخول فشل']);
add('account','ليه إنشاء الحساب مش شغال؟','Why is sign up failing?',
  'تأكد إن البريد مكتوب صح وإن كلمة المرور مطابقة لشروط النموذج، وجرب تحديث الصفحة. لو ظهر خطأ سيرفر، ابعت نصه لإدارة الموقع.','Check your email and password requirements, refresh and retry. Report any server error to support.',
  ['signup error','ساين اب مش شغال','انشاء حساب مش شغال']);
add('account','إزاي أغير صورة البروفايل؟','How do I change my profile picture?',
  'افتح إعدادات الحساب أو إعدادات البروفايل، ودور على خيار صورة الحساب لو ظاهر، وارفع صورة مناسبة.','Open account/profile settings and use the profile photo option if it is available.',
  ['صورة الحساب','avatar','البروفايل','profile photo']);
add('account','إزاي أغير اسمي؟','How do I change my display name?',
  'افتح إعدادات الحساب وابحث عن اسم العرض. لو خيار التعديل مش متاح، تواصل مع الإدارة بدل محاولة تعديل البيانات من أدوات المتصفح.','Look for Display Name in account settings. If editing is unavailable, contact support.',
  ['اسم العرض','display name','تغيير الاسم']);
add('account','إيه الفرق بين اليوزر واسم العرض؟','Username vs display name?',
  'اليوزر اسم فريد بيستخدم للبحث أو رابط البروفايل، أما اسم العرض فهو الاسم اللي بيظهر للناس وممكن يتكرر.','A username is unique and often used in profile links; a display name is what people see and may not be unique.',
  ['username','يوزر','اسم المستخدم','اسم البروفايل']);
add('account','إزاي ألاقي حساب شخص؟','How do I find a user?',
  'استخدم البحث واكتب اليوزر أو اسم العرض. لو الحساب عام وموجود، المفروض يظهر ضمن نتائج المستخدمين والكريتورز.','Use search with their username or display name. Public accounts can appear in results.',
  ['ابحث عن يوزر','دور على حساب','find creator','بحث المستخدمين'],'/explore');
add('account','ليه مش لاقي مستخدم في البحث؟','Why cannot I find a user?',
  'جرب تكتب اليوزر من غير @، وتأكد من الهجاء. بعض الحسابات ممكن تكون خاصة أو مش متاحة في نتائج البحث.','Try the exact username without @. Private or unavailable accounts may not appear.',
  ['مستخدم مش ظاهر','username not found','search not working'],'/explore');
add('account','هل بيانات حسابي آمنة؟','Is my account data safe?',
  'خلي كلمة المرور قوية ومختلفة عن باقي حساباتك، ومتشاركش التوكنات أو روابط الدخول. المساعد ده ما بيطلبش كلمات مرور أو معلومات حساسة.','Use a strong unique password; never share tokens. This helper does not ask for secrets.',
  ['الأمان','safe account','حماية حسابي']);
add('account','إزاي أسجّل خروج؟','How do I log out?',
  'من قائمة الحساب اختار «تسجيل الخروج». ولو بتستخدم جهاز مش جهازك، اقفل المتصفح بعد الخروج.','Open the account menu and choose Log Out.',
  ['لوج اوت','logout','خروج']);
add('account','إزاي أشوف بروفايل كريتور؟','How do I view a creator profile?',
  'اضغط اسم الكريتور في الإيديتات أو نتيجة البحث علشان تفتح بروفايله العام.','Click a creator name in an edit card or a search result to open their public profile.',
  ['صفحة كريتور','profile creator','بروفايل'],'/creators');
add('account','هل أقدر أتابع كريتور؟','Can I follow a creator?',
  'افتح البروفايل العام للكريتور، ولو زر «متابعة» ظاهر اضغط عليه.','Open the public creator profile and use Follow if the option is shown.',
  ['متابعة','follow','فولو'],'/creators');
add('account','إزاي أبلّغ عن مشكلة في حساب؟','How do I report an account problem?',
  'سجّل رسالة الخطأ ووقت المشكلة واسم الصفحة، وابعتها للدعم. متبعتش كلمة السر أو مفتاح تسجيل الدخول.','Send the error message, time and page to support. Never send passwords or auth tokens.',
  ['مشكلتي في الحساب','support','تواصل مع الدعم']);

// Points and ads
add('points','إزاي أجمع نقاط؟','How can I earn points?',
  'افتح «جمع النقاط»، وسجّل دخولك، وشوف الإعلانات أو العروض المتاحة. النقاط بتتضاف بعد ما الشبكة تؤكد إتمام النشاط المؤهل، مش بمجرد الضغط.','Open Earn Points, sign in, and complete an eligible offer. Rewards are credited only after provider verification.',
  ['اكسب نقط','عايز نقاط','ازاي اجيب بوينت','earn points','watch ads'],'/earn');
add('points','هل الإعلانات فيديوهات بس؟','Are ads videos only?',
  'المتاح حاليًا ممكن يشمل أنواع عروض مختلفة حسب الشبكة والبلد. مش كل عرض بالضرورة فيديو؛ اعتمد على النوع المعروض في صفحة جمع النقاط.','Available offers depend on the provider and your region. They are not guaranteed to be video-only.',
  ['مشاهدة فيديو','فيديوهات','video ads only'],'/earn');
add('points','ليه مش فيه إعلانات عندي؟','Why are no ads available?',
  'توافر الإعلانات والعروض بيختلف حسب البلد والجهاز والحساب. جرّب ترجع لاحقًا واتأكد إن متصفحك مش مانع تحميل نافذة العروض.','Ad inventory varies by region and device. Retry later and check popup or content blockers.',
  ['مافيش عروض','no offers','الإعلانات مش ظاهرة'],'/earn');
add('points','ليه النقاط ماوصلتش بعد الإعلان؟','Why did not I get my points?',
  'النقاط بتحتاج تأكيد من مزوّد الإعلانات، وأحيانًا التأكيد بيتأخر. جرّب تحديث الرصيد، وراجع حالة العرض لو متاحة. لو المشكلة مستمرة تواصل مع الدعم بتفاصيل العرض فقط.','Rewards need provider confirmation and may be delayed. Refresh your balance and contact support with the offer details if needed.',
  ['مكافأة الاعلان','نقاط مضافتش','no points','missing reward'],'/earn');
add('points','هل أخد نقاط لمجرد الضغط على الإعلان؟','Do clicks earn points?',
  'لا، الضغط لوحده مش دليل على إكمال عرض مؤهل. لازم الشبكة تؤكد المكافأة أولًا.','No. Clicking alone is not sufficient; the provider must confirm a qualifying completion.',
  ['ضغطت على اعلان','click ads','advertisement click'],'/earn');
add('points','إزاي أعرف رصيدي؟','Where is my points balance?',
  'سجّل دخولك وهتلاقي رصيد النقاط في منطقة الحساب أو شريط النقاط بالموقع، حسب الصفحة اللي أنت فيها.','Sign in and check your points indicator in your account or the site header.',
  ['رصيدي كام','محفظة النقاط','balance','points balance']);
add('points','أقدر أشتري بالنقاط إزاي؟','How do I spend points?',
  'افتح المحتوى اللي يعجبك، وشوف سعره بالنقاط، وبعدها استخدم زر الفتح أو الشراء لو رصيدك كافي والشروط متاحة.','Open an item, check its points price, then use Unlock/Purchase if you have enough points.',
  ['اصرف نقط','شراء','purchase with points'],'/explore');
add('points','ليه رصيدي مش كفاية؟','Why do I have insufficient points?',
  'سعر المحتوى أعلى من رصيدك الحالي. ارجع لقسم «جمع النقاط» وشوف أنشطة مؤهلة، أو اختار محتوى أقل سعرًا.','The item costs more than your current balance. Visit Earn Points or choose a cheaper item.',
  ['رصيد غير كافي','insufficient','not enough points'],'/earn');
add('points','هل النقاط فلوس حقيقية؟','Are points real money?',
  'لا، نقاط EditVault مخصصة للاستخدام داخل الموقع. متعتبرهاش مبلغًا ماليًا ولا رصيدًا نقديًا مضمونًا.','No. EditVault points are in-site credits, not cash.',
  ['النقط فلوس','points to money','قيمة النقاط']);
add('points','هل أقدر أحوّل نقاطي لحد؟','Can I transfer points to a friend?',
  'التحويل بين المستخدمين مش ميزة مضمونة. لو مش لاقي زر تحويل رسمي في حسابك، فمتستخدمش طرق خارج الموقع، واسأل الدعم.','Peer-to-peer transfers are not guaranteed. Do not use unofficial methods.',
  ['تحويل نقاط','ابعت نقاط','send points']);
add('points','هل أقدر أزوّد النقاط من الأدمن؟','Can admin add points?',
  'إضافة أو تعديل النقاط من صلاحيات الإدارة المعتمدة فقط، ومن خلال لوحة الأدمن عند توافرها. المساعد نفسه ما يقدرش يضيف أو يخصم نقاط.','Only authorized admins may adjust balances in the admin tools. This assistant cannot modify points.',
  ['النقاط الادمن','admin give points']);
add('points','هل تقدر تديني نقاط مجانية؟','Can you give me free points?',
  'أنا مساعد إرشادي ومش عندي صلاحية تعديل الأرصدة. تقدر تجمع نقاط من الطرق المتاحة داخل «جمع النقاط» حسب شروط الموقع.','I cannot change balances. Use eligible Earn Points activities.',
  ['هدية نقط','اديني بوينت','free points'],'/earn');
add('points','الإعلان وقف أو قفل','My ad froze or closed',
  'جرّب تحديث الصفحة وإعادة فتح قسم جمع النقاط. لو الإعلان مقفول قبل ما يكتمل، المكافأة مش مضمونة؛ ومتكررش نفس العرض إلا لو شروط الشبكة تسمح.','Refresh and retry. If the activity was not completed, the reward is not guaranteed.',
  ['اعلان علق','offer stuck','video freezes'],'/earn');
add('points','هل ينفع استخدم VPN للإعلانات؟','Can I use VPN for ads?',
  'اتبع شروط مزوّد الإعلانات بدقة؛ تغيير موقعك أو التلاعب بالمشاهدات ممكن يمنع المكافآت أو يعرّض الحساب للحظر.','Follow the provider rules. Spoofing location or ad activity may void rewards or suspend accounts.',
  ['vpn ads','بروكسي اعلانات','vpn']);
add('points','هل فيه حد يومي للإعلانات؟','Is there a daily ad limit?',
  'الحدود بتعتمد على الشبكة الإعلانية وتوافر العروض. راجع التعليمات الظاهرة مع كل عرض؛ متقدرش تعتمد على رقم ثابت لكل المستخدمين.','Limits depend on the provider and inventory; there is no universal daily count I can promise.',
  ['عدد الاعلانات','حد المشاهدة','daily limit']);

// Marketplace, purchasing and files
add('market','إزاي أشتري إيديت؟','How do I unlock an edit?',
  'افتح «استكشف»، اختار إيديت متاح، راجع المعاينة والسعر، واضغط زر الفتح بالنقاط. بعد إتمام العملية هتلاقيه في مكتبتك.','Browse Explore, preview an available edit and unlock it with points. Purchased content appears in your library.',
  ['اشتري فيديو','unlock edit','ازاي افتح ايديت'],'/explore');
add('market','إيه معنى الإيديت اتباع؟','What does sold mean?',
  'بعض الإيديتات في EditVault بنظام بيع نسخة واحدة؛ لو الإيديت اتباع، مش هيبقى متاح لعملية شراء جديدة بنفس النظام.','Some edits are one-of-one: once sold, they are unavailable for another purchase.',
  ['sold','خلص','نسخة واحدة','one of one'],'/explore');
add('market','أقدر أشوف الفيديو قبل الشراء؟','Can I preview an edit?',
  'لو فيه معاينة للإيديت، تقدر تشوفها قبل الشراء. المعاينة مش هي نفس الملف الأصلي القابل للتنزيل.','If a preview is provided, you can watch it before purchase; the preview is not the downloadable original.',
  ['معاينة','preview','اتفرج قبل الشراء'],'/explore');
add('market','فين أحمّل الإيديت اللي اشتريته؟','Where do I download my purchase?',
  'سجّل دخول بنفس الحساب اللي اشترى المحتوى، وبعدها افتح «مكتبتي» وابحث عن العنصر وزر التحميل المتاح.','Sign in with the purchasing account, open My Library and find the download control.',
  ['داونلود ايديت','download purchased','تنزيل الملف'],'/library');
add('market','التحميل مش شغال','My download is not working',
  'اتأكد إنك مسجل بنفس الحساب وإن العنصر ظاهر في «مكتبتي». جرّب متصفح تاني؛ ولو استمرت المشكلة بلّغ الإدارة باسم العنصر ورسالة الخطأ.','Check the correct account and library item. Try another browser, then report the error to support.',
  ['failed download','فشل التحميل','ملف مش بينزل'],'/library');
add('market','اشتريت ومش لاقي الإيديت','I bought an edit but cannot find it',
  'افتح «مكتبتي» وتأكد إنك على نفس الحساب اللي أكمل الشراء. لو المبلغ اتخصم ومفيش عنصر، ابعت تفاصيل العملية للدعم من غير بيانات حساسة.','Check My Library on the purchasing account. If charged but missing, contact support with the transaction details.',
  ['مش في المكتبة','purchase missing','اشتريت ومظهرش'],'/library');
add('market','إزاي أقيّم كريتور؟','How do I review a creator?',
  'افتح بروفايل الكريتور أو العنصر اللي تعاملت معاه ودور على قسم التقييمات، لو متاح لحسابك.','Open the creator profile or item and look for the rating section if eligible.',
  ['ريفيو','rate creator','نجوم','تقييم'],'/creators');
add('market','هل فيه استرجاع للنقاط؟','Are points refundable?',
  'سياسة الاسترجاع بتعتمد على نوع العملية وشروط المنصة. ماقدرش أضمن استرداد النقاط تلقائيًا؛ لو عندك مشكلة في شراء تواصل مع الإدارة.','Refunds depend on platform rules and the purchase. Contact support if something went wrong.',
  ['ريفاند','refund','ارجاع نقط']);
add('market','يعني إيه Original File؟','What is the original file?',
  'ده الملف الكامل الخاص بالمحتوى، واللي بيختلف عن نسخة المعاينة. الوصول له بيكون حسب حالة الشراء وصلاحيات حسابك.','The original is the full content file, separate from a preview. Access depends on your purchase permissions.',
  ['الملف الاصلي','original','raw edit']);
add('market','عايز أشتري بس العنصر Sold Out','The item is sold out',
  'لو الإيديت اتباع بنظام النسخة الواحدة، مش هيكون متاح لشراء جديد. دور على أعمال تانية من نفس الكريتور.','One-of-one sold items are no longer available for new purchases. Browse more work by the creator.',
  ['sold out','اتباع خلاص'],'/explore');
add('market','الصور أو المعاينات مش بتشتغل','Images or previews do not load',
  'جرّب تحديث الصفحة ومتصفح تاني. لو المشكلة في عنصر محدد بس، ابعت رابط العنصر للدعم؛ ممكن يكون ملف المعاينة غير متاح على السيرفر.','Refresh or try another browser. If only one item fails, report its URL to support.',
  ['صورة مش ظاهرة','video not playing','preview failed']);

// Scene packs
add('scenes','يعني إيه Scene Pack؟','What is a scene pack?',
  'حزمة مشاهد أو لقطات جاهزة ممكن تفيدك في عمل إيديتات جديدة. راجع وصف كل حزمة وشروط استخدامها قبل التنزيل.','A scene pack is a collection of footage or clips for editing. Check its description and usage terms.',
  ['سين باك يعني ايه','scene pack meaning','مشاهد'],'/scene-packs');
add('scenes','إزاي أرفع Scene Pack؟','How do I upload a scene pack?',
  'ادخل «Scene Packs»، وافتح خيار رفع أو مشاركة حزمة جديدة لو متاح لحسابك، وبعدها اتبع الحقول المطلوبة وارفع الملف المناسب.','Open Scene Packs, choose the contribution option if available, then submit the requested details and file.',
  ['رفع سين باك','upload pack','انشر مشاهد','ازاي ارفع سين باك'],'/scene-packs');
add('scenes','ينفع أرفع السين باك فيديو؟','Can I upload a video scene pack?',
  'قسم Scene Packs عندنا بيدعم تقديم فيديوهات في النسخ المجهزة لده. اختار صيغة فيديو مدعومة من نموذج الرفع، ولو ظهرت رسالة رفض ابعت نوع الملف وحجمه للدعم.','Video uploads are supported in equipped versions. Follow the upload form’s accepted file types and size limits.',
  ['mp4 scene pack','رفع فيديو للسين','video pack','ازاي ارفع سين باك فيديو','ارفع سين باك كفيديو'],'/scene-packs');
add('scenes','ينفع Scene Pack مضغوط ZIP؟','Can I upload a ZIP pack?',
  'راجع صيغ الملفات المسموحة في نموذج رفع Scene Packs؛ لو ZIP ظاهر في الصيغ المدعومة، تقدر ترفعه بدل فيديو مباشر.','Check accepted formats in the Scene Pack form. ZIP can be uploaded where supported.',
  ['zip pack','rar','ملف مضغوط'],'/scene-packs');
add('scenes','ليه السين باك قيد المراجعة؟','Why is my scene pack pending?',
  'مساهمات Scene Packs بتحتاج مراجعة قبل النشر والمكافآت. انتظر نتيجة المراجعة من قسم الحزم أو الإشعارات المتاحة.','Scene Pack contributions may require moderation before publication or rewards.',
  ['pending','قيد المراجعة','الموافقة على الحزمة'],'/scene-packs');
add('scenes','هل باخد نقاط على رفع Scene Pack؟','Do contributors earn points?',
  'قد تحصل على نقاط بعد اعتماد مساهمة أصلية وفق شروط القسم وحدود المكافآت. مش كل رفع يضمن مكافأة تلقائيًا.','Eligible original submissions may earn points after approval, subject to limits and rules.',
  ['مكافأة الرفع','earn scene pack points'],'/scene-packs');
add('scenes','ليه Scene Pack اترفض؟','Why was my scene pack rejected?',
  'ممكن يكون السبب تكرار المحتوى أو مشكلة في الملف أو مخالفة شروط النشر. راجع سبب الرفض لو ظاهر، وتواصل مع الإدارة لو مش واضح.','Possible reasons include duplicates, file issues or policy violations. Review the stated reason or contact support.',
  ['رفض الحزمة','rejected scene pack'],'/scene-packs');
add('scenes','هل ينفع أرفع Scene Pack مكرر؟','Are duplicate scene packs allowed?',
  'بلاش ترفع نفس المحتوى أكتر من مرة. أنظمة المراجعة ممكن ترفض الملفات المكررة، ومش هتضمن مكافأة إضافية.','Avoid duplicates. Repeated submissions may be rejected and do not guarantee extra rewards.',
  ['حزمة مكررة','duplicate pack'],'/scene-packs');
add('scenes','حجم فيديو Scene Pack كبير','My scene pack is too large',
  'راجع الحد المكتوب في صفحة الرفع. لو الملف أكبر منه، اضغطه مع الحفاظ على جودة مناسبة أو قلّل مدته قبل إعادة المحاولة.','Check the upload limit; compress or shorten files that exceed it.',
  ['size limit scene pack','فيديو كبير','الملف كبير'],'/scene-packs');
add('scenes','هل أقدر أنزل Scene Packs؟','Can I download scene packs?',
  'افتح الحزمة اللي تعجبك واتبع زر الوصول أو التنزيل الظاهر حسب شروطها، وتأكد إن رصيدك وصلاحياتك كافية لو مطلوبة.','Open a pack and use the access/download option where available and permitted.',
  ['تحميل سين باك','download scenes'],'/scene-packs');

// Creator
add('creator','إزاي أبقى كريتور؟','How do I become a creator?',
  'من قسم الكريتورز أو إعدادات الحساب دور على طلب الانضمام ككريتور، وكمل البيانات أو التحقق المطلوب. قبول الطلب بيرجع لشروط المنصة.','Look for the Creator Application option and complete the required information. Approval is subject to platform rules.',
  ['creator','عايز انشر ايديت','اصبح كريتور'],'/creators');
add('creator','إزاي أرفع إيديت جديد؟','How do I upload an edit?',
  'بعد ما يبقى عندك صلاحية كريتور، افتح Creator Studio ثم اختار إضافة إيديت، وارفع المعاينة والملف المطلوب واكتب تفاصيل العمل والسعر.','After creator approval, open Creator Studio and submit the edit, preview, details and points price.',
  ['ارفع مونتاج','upload edit','انشر فيديو'],'/creators');
add('creator','إيه Creator Studio؟','What is Creator Studio?',
  'دي مساحة إدارة أعمال الكريتور: نشر الإيديتات ومتابعة المحتوى وإعدادات الملف الإبداعي.','Creator Studio is the workspace for publishing and managing creator content.',
  ['استوديو الكريتور','creator dashboard'],'/creators');
add('creator','ليه مش قادر أرفع إيديت؟','Why can’t I upload an edit?',
  'تأكد إن حسابك معتمد ككريتور وإن الملف ضمن الصيغ والحجم المسموح. لو ظهر خطأ، ابعت رسالته من غير أي بيانات سرية.','Check creator approval, file type and size. Report the error text if it persists.',
  ['رفع الايديت فشل','creator upload error'],'/creators');
add('creator','إيه شارة Verified؟','What does Verified mean?',
  'شارة Verified بتوضح إن الكريتور اتوثق طبقًا لإجراءات EditVault، ومش معناها ضمان جودة كل ملف أو صفقة.','Verified means the creator passed EditVault verification; it does not guarantee every upload or transaction.',
  ['موثق','علامة صح','verified badge'],'/creators');
add('creator','إزاي أوثّق حسابي؟','How can I get verified?',
  'افتح إعدادات الكريتور أو طلب التوثيق لو متاح، واقرأ المتطلبات. التوثيق قرار إداري بعد مراجعة المعلومات.','Check creator verification options and submit the required proof if offered. Approval is reviewed by admins.',
  ['توثيق','ازاي اخد علامة صح','verification request'],'/creators');
add('creator','إيه شارات الكريتور؟','What are creator badges?',
  'الشارات زي Creator وVerified بتوضح حالة الحساب، وبعض الشارات الخاصة ممكن تمنحها الإدارة حسب معاييرها.','Badges identify creator or verification status; special badges depend on admin decisions.',
  ['badges','شارات','top creator','vip badge'],'/creators');
add('creator','هل فيه تقييمات للكريتورز؟','Do creators have ratings?',
  'البروفايلات ممكن تعرض تقييمات ومراجعات لما تكون متاحة. اختار الكريتور بناءً على المعاينة والتقييمات وملاءمة أعماله ليك.','Creator profiles may show reviews and ratings. Preview their work and read feedback when available.',
  ['ريفيو الكريتور','creator reviews'],'/creators');
add('creator','إزاي أعرف مبيعاتي؟','How do I see my sales?',
  'افتح Creator Studio أو صفحة الأرباح المستقلة لو حسابك كريتور، وشوف تفاصيل المبيعات المعروضة.','Check Creator Studio or the independent Withdrawals page for available creator sales information.',
  ['مبيعات','sales count','كام بعت'],'/withdrawals');
add('creator','فين صفحة سحب الأرباح؟','Where is creator withdrawals?',
  'صفحة السحب مستقلة عن Creator Studio. افتح «سحب الأرباح» من القائمة الخاصة بحساب الكريتور.','Withdrawals has its own page, separate from Creator Studio.',
  ['سحب الارباح','withdrawals page','payouts'],'/withdrawals');
add('creator','هل السحب متاح دلوقتي؟','Are withdrawals available?',
  'السحب الفعلي مش متاح حاليًا حتى لو طرق السحب معروضة. مفيش تحويل نقدي مضمون للنقاط في الوقت الحالي.','Withdrawals are not currently available, even if payout methods are displayed.',
  ['اسحب فلوس','vodafone cash','instapay','paypal withdraw'],'/withdrawals');
add('creator','إزاي أختار سعر الإيديت؟','How do I price my edit?',
  'لو حسابك كريتور، هتحدد السعر بالنقاط من نموذج النشر المتاح. خليك واضح في وصف المحتوى وجودته قبل التسعير.','Set the points price in the creator upload form, where offered. Describe the content clearly.',
  ['سعر الفيديو','edit price','التسعير'],'/creators');
add('creator','هل أي مستخدم يقدر يرفع إيديت؟','Can everyone sell edits?',
  'نشر الإيديتات في المتجر ممكن يحتاج صلاحية Creator، لكن المساهمة في Scene Packs لها نظام منفصل حسب قواعد القسم.','Publishing marketplace edits may require creator status; Scene Pack submissions follow separate rules.',
  ['كل الناس ترفع','upload permission'],'/creators');

// EditLab, CC, export, audio
add('editlab','يعني إيه CC؟','What is CC?',
  'CC اختصار شائع لـColor Correction أو Color Grading في المونتاج؛ بتستخدمه لضبط الألوان والكونتراست والإضاءة وإعطاء الفيديو ستايل.','CC refers to color correction/grading: adjusting a video’s color, contrast and overall look.',
  ['سي سي','color correction','color grading'],'/editlab');
add('editlab','إزاي أستخدم الـCC؟','How do I use CC presets?',
  'افتح EditLab، وارفع الفيديو، واختار قسم CC، جرّب البريست وشوف المعاينة. لما يظهر خيار التصدير، استخدمه لتنزيل النتيجة.','Open EditLab, upload video, select a CC preset, preview, then export when available.',
  ['تلوين الفيديو','cc preset','تأثيرات الوان'],'/editlab');
add('editlab','Pure Quality بيعمل إيه؟','What does Pure Quality do?',
  'Pure Quality ستايل هدفه مظهر أنضف وأوضح من غير تغيير مبالغ فيه للألوان. راجع المعاينة لأن النتيجة بتختلف من فيديو للتاني.','Pure Quality aims for a clean, clear look with subtle adjustments. Preview the result first.',
  ['بيور كواليتي','pure quality'],'/editlab');
add('editlab','Fire CC بيعمل إيه؟','What does Fire CC do?',
  'Fire ستايل دافئ بيبرز درجات الأحمر والبرتقالي حسب إعدادات التأثير. مناسب لتجربة ألوان حماسية، لكن مش شرط يناسب كل اللقطات.','Fire is a warmer look emphasizing red/orange tones depending on the preset.',
  ['فاير سي سي','fire preset','fire colors'],'/editlab');
add('editlab','Ice Blue CC بيعمل إيه؟','What does Ice Blue do?',
  'Ice Blue بيميل بالألوان للدرجات الباردة والزرقاء. اختار التأثير وشوف المعاينة قبل التصدير.','Ice Blue is a cooler, blue-tinted look; preview it before export.',
  ['ايس بلو','blue cc','ice blue'],'/editlab');
add('editlab','إيه Cinema Pro؟','What is Cinema Pro?',
  'Cinema Pro بريست ألوان بطابع سينمائي، لكن الشكل النهائي بيعتمد على تصوير الفيديو الأصلي.','Cinema Pro is a cinematic color preset; results depend on the source footage.',
  ['سينما برو','cinematic preset'],'/editlab');
add('editlab','فين زر تصدير الـCC؟','Where is CC export?',
  'بعد اختيار البريست، دوّر على زر «تطبيق الـCC وتصدير الفيديو» داخل القسم. لو الزر مش ظاهر، جرّب تحديث الصفحة أو بلّغ عن إصدار الصفحة لأن الخاصية ممكن تكون لسه غير منشورة عندك.','Look for Apply CC & Export in the CC section. If missing, refresh or report the page version.',
  ['مفيش تصدير','export cc','تصدير تحت السي سي','مش عارف اصدر سي سي','اصدر ال cc'],'/editlab');
add('editlab','التصدير فشل، أعمل إيه؟','Why did export fail?',
  'تأكد إن الملف بصيغة مدعومة ومش كبير زيادة، وإن رصيد المعالجة كافي لو العملية بتحتاج نقاط. جرّب ملف صغير واكتب رسالة الخطأ للدعم.','Check file format, size and any point requirements. Retry with a smaller file and report the error.',
  ['failed to export','export failed','مش بيتصدر'],'/editlab');
add('editlab','الفيديو مش بيرفع في EditLab','Video upload fails in EditLab',
  'جرّب MP4 بحجم أصغر، وتأكد من اتصالك. بعض أدوات المونتاج ليها حدود للحجم والصيغ؛ شوف التعليمات داخل الأداة.','Try a smaller MP4 and check the tool’s supported formats and size limits.',
  ['مش راضي ارفع الفيديو','video upload error'],'/editlab');
add('editlab','يعني إيه FPS؟','What is FPS?',
  'FPS يعني عدد الإطارات في الثانية. 30 FPS مناسب لكتير من الفيديوهات، و60 FPS بيدي حركة أنعم لو الفيديو الأصلي والتصدير بيدعموه.','FPS means frames per second. 60 FPS can look smoother than 30 when supported by the source and output.',
  ['فريمات','frame rate','60 fps','30fps'],'/editlab');
add('editlab','يعني إيه Bitrate؟','What is bitrate?',
  'الـBitrate معدل البيانات في الفيديو. غالبًا رفعه يحسّن التفاصيل لكن بيكبر حجم الملف، والنتيجة بتعتمد على الكودك والمصدر.','Bitrate is the data rate. Higher rates often preserve detail but increase file size.',
  ['بيت ريت','kbps','mbps'],'/editlab');
add('editlab','إيه الفرق بين الجودة والحجم؟','Quality vs file size?',
  'الجودة هي وضوح النتيجة، والحجم هو مساحة الملف. ضغط أكبر غالبًا يقلل الحجم لكنه ممكن يأثر على التفاصيل.','Quality is visual fidelity; size is storage used. Stronger compression may reduce file size and detail.',
  ['compress','حجم الفيديو','ضغط فيديو'],'/editlab');
add('editlab','يعني إيه 1080p؟','What does 1080p mean?',
  '1080p ارتفاع دقة الصورة 1080 بكسل. تكبير فيديو قليل الدقة لـ1080p مش معناه إن تفاصيل أصلية جديدة هتظهر تلقائيًا.','1080p is a 1080-pixel image height. Upscaling alone cannot restore missing original detail.',
  ['full hd','فول اتش دي','resolution'],'/editlab');
add('editlab','إزاي أحسن جودة فيديو؟','How do I improve video quality?',
  'ابدأ بفيديو مصدر واضح. جرّب أدوات الجودة في EditLab بزيادة بسيطة في الوضوح وتقليل الضوضاء، وبعدين قارن قبل وبعد.','Start with the best source file, then try EditLab enhancements and compare before/after.',
  ['enhance video','تحسين الفيديو','quality'],'/editlab');
add('editlab','إزاي أضغط فيديو من غير خسارة كبيرة؟','How do I compress video?',
  'اختار إعداد ضغط متوسط، واحتفظ بنسخة أصلية. قلل الـBitrate تدريجيًا بدل الضغط الشديد مرة واحدة.','Use moderate compression, keep an original copy, and lower bitrate gradually.',
  ['اصغر حجم الفيديو','video compression','تصغير الحجم'],'/editlab');
add('editlab','إيه الفرق بين MP4 وMOV؟','MP4 vs MOV?',
  'دول حاويات ملفات فيديو. MP4 غالبًا أكثر توافقًا مع المتصفحات، لكن جودة الفيديو بتعتمد على الكودك والإعدادات الداخلية.','They are video containers. MP4 is broadly compatible; quality depends on codec and settings.',
  ['صيغة الفيديو','mov','mp4'],'/editlab');
add('editlab','يعني إيه Codec؟','What is a codec?',
  'الـCodec طريقة ضغط وترميز الصوت أو الفيديو، زي H.264. اختيار كودك مناسب بيساعد تشغيل الفيديو على أجهزة أكتر.','A codec encodes/compresses video or audio, such as H.264. Compatibility varies by device.',
  ['h264','h265','ترميز'],'/editlab');
add('editlab','إيه الفرق بين 9:16 و16:9؟','9:16 vs 16:9?',
  '9:16 رأسي وغالبًا مناسب لريلز وتيك توك، و16:9 أفقي ومناسب لفيديوهات يوتيوب العادية.','9:16 is vertical and common for shorts; 16:9 is horizontal and common for standard video.',
  ['مقاس الفيديو','aspect ratio','ريلز','تيك توك'],'/editlab');
add('editlab','إزاي أفصل الصوت عن الموسيقى؟','How do I separate vocals and music?',
  'افتح Audio Lab في EditLab واختار الأداة المناسبة، مثل عزل الصوت البشري أو استخراج الموسيقى بدون غناء، لو موجودة. النتيجة بتعتمد على المقطع.','Open Audio Lab and choose vocal isolation or instrumental extraction when available; quality depends on the source.',
  ['فصل صوت','فصل الغنا','vocal isolation','instrumental'],'/editlab');
add('editlab','يعني إيه عزل الصوت البشري؟','What is vocal isolation?',
  'هو محاولة استخراج الكلام أو الغناء من تسجيل فيه موسيقى أو أصوات تانية. الجودة مش مضمونة 100% مع كل الملفات.','It attempts to extract speech or singing from a mixed track; results vary.',
  ['عزل صوت','remove music keep vocals'],'/editlab');
add('editlab','يعني إيه استخراج الموسيقى بدون غناء؟','What is instrumental extraction?',
  'ده بيحاول يحتفظ بالموسيقى ويقلّل صوت الغناء أو الكلام قدر الإمكان. ممكن تفضل آثار بسيطة للصوت الأصلي.','It attempts to preserve music while reducing vocals; artifacts may remain.',
  ['موسيقى بدون غناء','remove vocals','karaoke'],'/editlab');
add('editlab','ممكن أشيل ضوضاء الصوت؟','Can I reduce audio noise?',
  'لو أداة تنظيف الصوت متاحة في Audio Lab، جرّبها بمستوى بسيط الأول. المعالجة القوية ممكن تخلي الكلام صوته غير طبيعي.','Use any available denoising tool gently; aggressive filtering can distort voices.',
  ['noise reduction','تنظيف الصوت','شوشرة'],'/editlab');
add('editlab','إيه الفرق بين CC وQuality؟','CC vs Quality?',
  'CC بيغيّر الألوان والإضاءة والطابع البصري، أما Quality فتركّز أكتر على وضوح الصورة أو تحسين تفاصيلها.','CC adjusts color/look; Quality tools focus on clarity and fidelity.',
  ['سي سي ولا تحسين','colors vs enhance'],'/editlab');
add('editlab','هل التصدير بيستهلك نقاط؟','Does export cost points?',
  'بعض عمليات EditLab ممكن تعرض تكلفة بالنقاط حسب الأداة. راجع الرقم المعروض قبل بدء المعالجة؛ المساعد مش بيقدر يغيّر التكلفة.','Some EditLab jobs may display a points cost. Check the on-screen amount before processing.',
  ['تكلفة التصدير','نقط تصدير','export points'],'/editlab');
add('editlab','فين الفيديو بعد التصدير؟','Where is my exported file?',
  'بعد ما المعالجة تنجح دور على زر تنزيل النتيجة في نفس الأداة. لو انتهت الجلسة أو الرابط اختفى، ممكن تحتاج تعيد المعالجة.','After successful processing, use the result download control in that tool.',
  ['download export','الملف الناتج','فين الناتج'],'/editlab');
add('editlab','هل الفيديو بيتحفظ تلقائيًا؟','Are processed videos saved?',
  'متفترضش إن الملفات المعالجة محفوظة للأبد. نزّل النتيجة على جهازك بمجرد ما تخلص، واحتفظ بنسخة احتياطية.','Do not assume processed files are stored permanently. Download your result and keep a backup.',
  ['حفظ الفيديو','save exported video'],'/editlab');

// Admin, security and site troubleshooting
add('support','الصفحة بتطلع 404','I see a 404 error',
  'جرّب فتح الموقع من الرئيسية والتنقل للقسم من القائمة. لو الرابط المباشر بيرجع 404، ابعته للدعم علشان يتراجع إعداد نشر صفحات React.','Navigate from Home first; if a direct route gives 404, report the URL for deployment routing checks.',
  ['page not found','صفحة مش موجودة','404 error']);
add('support','الموقع بيطلع Internal Server Error','What is internal server error?',
  'ده غالبًا خطأ في السيرفر أو قاعدة البيانات، مش عندك. جرّب التحديث وبعدها بلّغ الإدارة باسم الصفحة ووقت المشكلة من غير أي بيانات حساسة.','Usually a backend or database error. Refresh and report the page, time and error text.',
  ['error 500','500','السيرفر فيه مشكلة','internal server error']);
add('support','الموقع بطيء','Why is the website slow?',
  'ممكن يكون الاتصال بطيء أو السيرفر بيصحى بعد فترة خمول. جرّب تنتظر الاستجابة وتحدّث الصفحة، ولو المشكلة مستمرة بلّغ الإدارة.','Slow connectivity or hosting wake-up time can cause delays. Retry and report persistent issues.',
  ['بيعلق','slow loading','بطئ']);
add('support','الموقع شاشة سودا','Why is the site blank?',
  'جرّب تحديث قوي Ctrl+Shift+R، أو افتحه في نافذة خاصة. لو لسه الشاشة فاضية، ابعت نوع المتصفح ورسالة الـConsole للدعم.','Hard-refresh, try a private window and report any console error.',
  ['black screen','صفحة سودا','مش بيفتح']);
add('support','زر مش بيستجيب','A button does not work',
  'تأكد إنك مسجل دخول لو الزر مرتبط بحساب. جرّب تحديث الصفحة، ولو فضل مش شغال ابعت اسم الزر ورابط الصفحة للدعم.','Check sign-in requirements, refresh, then report the button and page URL.',
  ['مش بيدوس','button broken','زرار']);
add('support','مش عارف أستخدم الموقع','I need help using the site',
  'قولّي عايز تعمل إيه بالضبط: تجمع نقاط، تشتري إيديت، ترفع Scene Pack، أو تلوّن فيديو في EditLab؟ وهوجّهك للخطوات المناسبة.','Tell me your goal: earn points, unlock an edit, submit a scene pack, or edit a video.',
  ['مساعدة','help me','مش فاهم','اعمل ايه']);
add('support','إزاي أتواصل مع الإدارة؟','How do I contact support?',
  'استخدم وسيلة التواصل الرسمية الموجودة بالموقع إن كانت ظاهرة. اذكر المشكلة والصفحة ووقت حدوثها، ومتشاركش كلمات مرور أو مفاتيح.','Use the official support contact shown on the site, and include the issue and page—not secrets.',
  ['كلم الادمن','support contact','عايز اكلم حد']);
add('support','هل المساعد يقدر يعدّل حسابي؟','Can the assistant change my account?',
  'لا. أنا دليل مساعدة داخل الموقع، ماعنديش صلاحية تسجيل دخول بدل منك أو تعديل نقاط أو حظر أو إجراء عمليات مالية.','No. I am an informational guide and cannot change accounts, balances, bans or payouts.',
  ['اعدلي النقاط','ban user','حظر','modify account']);
add('support','هل أبعث كلمة السر للمساعد؟','Should I send my password?',
  'لا، متبعتش كلمة السر أو JWT أو مفاتيح API أو بيانات البطاقة لأي حد. المساعد مش محتاجها علشان يشرحلك.','Never share passwords, tokens, API keys or payment details. This assistant does not need them.',
  ['باسوردي','password safe','jwt']);
add('support','هل ده ذكاء اصطناعي زي ChatGPT؟','Is this like ChatGPT?',
  'أنا مساعد إرشادي متخصص في EditVault، ببحث داخل قاعدة أسئلة وإجابات عملها فريق الموقع. مش نموذج توليدي عام، ومش بقدر أشوف بيانات حسابك.','I am a knowledge-base assistant, not a general generative model. I cannot view your private account data.',
  ['ai ولا bot','هل انت ai','روبوت ولا شات جي بي تي']);
add('support','ليه المساعد مش عارف الإجابة؟','Why does the assistant not know?',
  'قاعدة المعرفة بتكبر مع الوقت. لو سؤال مش موجود هعرض أقرب موضوعات بدل ما أخمّن أو أديك معلومة غلط.','The knowledge base is curated. When unsure, I suggest related topics instead of inventing an answer.',
  ['ردود قليلة','not in faq','مش فاهم السؤال']);
add('support','ممكن تساعدني في التحقق من مشكلة؟','Can you troubleshoot an issue?',
  'أيوه: قولّي اسم الصفحة، بتعمل إيه قبل المشكلة، ونص رسالة الخطأ بدون بيانات حساسة. هقدملك خطوات عامة بناءً على المعرفة المتاحة.','Share the page, what you were doing and the error text—without sensitive details.',
  ['debug','حل مشكلة','help bug']);
add('support','هل ينفع أستخدم محتوى غيري؟','Can I upload someone else’s work?',
  'ارفع فقط محتوى عندك حق نشره أو تصريح باستخدامه. وجود فيديو على الإنترنت مش معناه إنك تقدر تبيعه أو توزّعه.','Upload only content you have rights or permission to distribute. Publicly accessible does not mean free to resell.',
  ['حقوق ملكية','copyright','فيديو مسروق']);
add('support','هل في موقع رسمي للمنصة؟','What is the official EditVault URL?',
  'أنت داخل EditVault بالفعل. استخدم روابط الموقع الرسمية وتجنب نسخ تسجيل الدخول أو روابط غير موثوقة.','You are on EditVault; use official site navigation and avoid untrusted sign-in copies.',
  ['رابط الموقع','official site']);

export const FAQ = Object.freeze(faq);
export const CATEGORIES = [
  { id: 'start', ar: 'البدء', en: 'Getting started', emoji: '🚀' },
  { id: 'points', ar: 'النقاط والإعلانات', en: 'Points & ads', emoji: '🪙' },
  { id: 'editlab', ar: 'EditLab والمونتاج', en: 'EditLab & editing', emoji: '🎨' },
  { id: 'scenes', ar: 'Scene Packs', en: 'Scene Packs', emoji: '🎬' },
  { id: 'creator', ar: 'الكريتورز', en: 'Creators', emoji: '✨' },
  { id: 'market', ar: 'الشراء والمكتبة', en: 'Buying & library', emoji: '🛍️' },
  { id: 'account', ar: 'الحسابات', en: 'Accounts', emoji: '👤' },
  { id: 'support', ar: 'حل المشاكل', en: 'Troubleshooting', emoji: '🛟' },
];

const AR_STOP = new Set('انا انت انتي هو هي هم احنا هو ال الي اللي عايز عاوز ازاي ازاى كيف ايه اي ليه ما في من على علي و او اوي ا انا يا هل ده دي دا لو عندي ممكن اعمل ايش عشان علشان اخد get how why can do i you my the to a in on for is it what where with of and or'.split(' '));
const replacements = [
  [/\blogin\b/g,'تسجيل دخول'],[/\bsignup\b/g,'انشاء حساب'],[/\bsign up\b/g,'انشاء حساب'],
  [/\bpoints?\b/g,'نقاط'],[/\bads?\b/g,'اعلانات'],[/\breward(s|ed)?\b/g,'مكافاة'],
  [/\bdownload\b/g,'تحميل'],[/\bexport\b/g,'تصدير'],[/\bupload\b/g,'رفع'],[/\bwithdraw(als)?\b/g,'سحب'],
  [/\bcreator(s)?\b/g,'كريتور'],[/\bprofile\b/g,'بروفايل'],[/\bscene packs?\b/g,'سين باك'],
  [/\bvideo\b/g,'فيديو'],[/\bquality\b/g,'جودة'],[/\baccount\b/g,'حساب'],
  [/\bcc\b/g,'سي سي'],[/\beditlab\b/g,'ايديت لاب'],
  [/نقطه|نقط|بوينت|بوينتس/g,'نقاط'],[/فلوس|اموال/g,'مال'],[/اصدر|صدر|بيصدر/g,'تصدير'],[/ارفع|برفع/g,'رفع'],[/اشتري|اشتريت|شراء|شرا/g,'شراء'],
  [/إعلان|اعلان|الاعلانات|الاعلان/g,'اعلانات'],[/الساين اب|ساين اب/g,'انشاء حساب'],
  [/باسورد|باسوورد|باسوردات/g,'كلمة مرور'],[/كريتر|كريتورز/g,'كريتور'],
  [/البروفايل/g,'بروفايل'],[/التصدير/g,'تصدير'],[/التحميل/g,'تحميل'],
  [/الفيديوهات/g,'فيديو'],[/اليوزر/g,'يوزر'],[/المكتبة/g,'مكتبة'],
];
export function normalize(text) {
  let s = String(text || '').toLowerCase().normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670\u0640]/g,'')
    .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/ؤ/g,'و').replace(/ئ/g,'ي');
  for (const [pattern, replacement] of replacements) s = s.replace(pattern, replacement);
  return s.replace(/[^a-z0-9\u0621-\u064a ]/g, ' ').replace(/\s+/g,' ').trim();
}
const tokens = (s) => normalize(s).split(' ').filter(w => w.length > 1 && !AR_STOP.has(w));
const faqIndex = FAQ.map(item => {
  const questions = [item.question.ar, item.question.en, ...item.aliases];
  return { item, variants: questions.map(q => ({ phrase: normalize(q), words: new Set(tokens(q)) })) };
});
function relevance(query, variant) {
  const q = normalize(query);
  if (!q || !variant.phrase) return 0;
  if (q === variant.phrase) return 1;
  if (q.length >= 5 && variant.phrase.includes(q)) return 0.9;
  if (variant.phrase.length >= 6 && q.includes(variant.phrase)) return 0.86;
  const ask = new Set(tokens(query));
  if (!ask.size) return 0;
  let overlap = 0;
  ask.forEach(w => {
    if (variant.words.has(w)) overlap += 1;
    else if (w.length >= 4 && [...variant.words].some(v => v.length >= 4 && (v.includes(w) || w.includes(v)))) overlap += 0.53;
  });
  const coverage = overlap / ask.size;
  const precision = overlap / Math.max(1, variant.words.size);
  return Math.min(0.88, coverage * 0.68 + precision * 0.32);
}
export function matchFaq(query, maxResults = 4) {
  const results = faqIndex.map(({ item, variants }) => ({ item, score: Math.max(...variants.map(v => relevance(query, v))) }))
    .filter(r => r.score >= 0.28).sort((a,b) => b.score - a.score);
  return results.slice(0, maxResults);
}
