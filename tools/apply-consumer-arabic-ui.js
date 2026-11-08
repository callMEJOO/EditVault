'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainPath = path.join(root, 'client', 'src', 'main.jsx');
const accountSettingsPath = path.join(root, 'client', 'src', 'AccountSettings.jsx');
const cssSource = path.join(root, 'upgrade', 'client', 'src', 'consumer-arabic-ui.css');
const cssTarget = path.join(root, 'client', 'src', 'consumer-arabic-ui.css');

function fail(message) { console.error(`EditVault UI update stopped: ${message}`); process.exit(1); }
if (!fs.existsSync(mainPath)) fail('client/src/main.jsx was not found. Run this script from the EditVault project root.');
if (!fs.existsSync(path.join(root, 'client', 'src', 'styles.css'))) fail('client/src/styles.css was not found. No files were changed.');
if (!fs.existsSync(cssSource)) fail('The bundled consumer-arabic-ui.css is missing. Re-extract the full update ZIP.');

let main = fs.readFileSync(mainPath, 'utf8').replace(/\r\n/g, '\n');
if (main.includes("import './consumer-arabic-ui.css';") && main.includes("const tx = (en, ar) => language === 'ar' ? ar : en;")) {
  fs.mkdirSync(path.dirname(cssTarget), { recursive: true });
  if (!fs.existsSync(cssTarget)) fs.copyFileSync(cssSource, cssTarget);
  console.log('Consumer Arabic UI is already applied. No duplicate changes were made.');
  process.exit(0);
}
if (!/const \[language,\s*setLanguage\] = useState/.test(main)) fail('Could not find the language selector in main.jsx. No files were changed.');
if (!main.includes('function App()')) fail('Could not find the App component in main.jsx. No files were changed.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
function backup(file) {
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.pre-consumer-ui-${stamp}.bak`);
}
let mainChanged = false;
const edit = (label, from, to, opts = {}) => {
  const { required = false, all = false } = opts;
  if (all) {
    if (!main.includes(from)) {
      if (required) fail(`Required source snippet not found (${label}). No files were changed.`);
      return 0;
    }
    const count = main.split(from).length - 1;
    main = main.split(from).join(to);
    mainChanged ||= count > 0;
    console.log(`- ${label}: ${count} replacement(s)`);
    return count;
  }
  if (!main.includes(from)) {
    if (required) fail(`Required source snippet not found (${label}). No files were changed.`);
    console.log(`- ${label}: skipped (source wording differs)`);
    return 0;
  }
  main = main.replace(from, to);
  mainChanged = true;
  console.log(`- ${label}: applied`);
  return 1;
};

// Import a separate stylesheet so the update is reversible without replacing existing styles.
if (!main.includes("import './consumer-arabic-ui.css';")) {
  if (main.includes("import './multipage-routing.css';")) {
    edit('Add responsive RTL stylesheet import', "import './multipage-routing.css';", "import './multipage-routing.css';\nimport './consumer-arabic-ui.css';", { required: true });
  } else {
    edit('Add responsive RTL stylesheet import', "import './styles.css';", "import './styles.css';\nimport './consumer-arabic-ui.css';", { required: true });
  }
} else console.log('- Responsive RTL stylesheet import: already present');

// Add a tiny localization helper immediately after the language state.
if (!main.includes('const tx = (en, ar) => language === \'ar\' ? ar : en;')) {
  const stateRegex = /(const \[language,\s*setLanguage\] = useState\([^\n]+\);)/;
  if (!stateRegex.test(main)) fail('Could not safely insert the Arabic text helper.');
  main = main.replace(stateRegex, "$1\n  const tx = (en, ar) => language === 'ar' ? ar : en;");
  mainChanged = true;
  console.log('- Added Arabic/English text helper');
}

// Navigation, shared brand labels, sign-in actions.
const substitutions = [
  ['Navigation accessibility label', 'aria-label="Marketplace navigation"', 'aria-label={tx("Marketplace navigation", "التنقل الرئيسي")}'],
  ['Home brand sublabel', '<small>CREATOR MARKETPLACE</small>', '<small>{tx(\'CREATOR MARKETPLACE\', \'سوق المبدعين\')}</small>', true],
  ['Navigation: Explore', '>Explore</a>', '>{tx(\'Explore\', \'استكشف\')}</a>'],
  ['Navigation: Scene Packs', '>Scene Packs</a>', '>{tx(\'Scene Packs\', \'حزم المشاهد\')}</a>'],
  ['Navigation: Earn Points', '>Earn Points</a>', '>{tx(\'Earn Points\', \'اجمع النقاط\')}</a>'],
  ['Navigation: Accounts', '>Accounts</a>', '>{tx(\'Accounts\', \'الحسابات\')}</a>'],
  ['Navigation: Clip Assembly', '>Clip Assembly</a>', '>{tx(\'Clip Assembly\', \'تجميع المقاطع\')}</a>'],
  ['Navigation: Creators', '>Creators</a>', '>{tx(\'Creators\', \'المبدعون\')}</a>'],
  ['Navigation: How it works', '>How it works</a>', '>{tx(\'How it works\', \'كيف يعمل الموقع\')}</a>'],
  ['Points label', '<span>PTS</span>', '<span>{tx(\'PTS\', \'نقطة\')}</span>', true],
  ['Card points label', '<small>PTS</small>', '<small>{tx(\'PTS\', \'نقطة\')}</small>', true],
  ['Header login action', '                Log in\n              </button>', "                {tx('Log in', 'تسجيل الدخول')}\n              </button>"],
  ['Log in action', '>Log in</button>', '>{tx(\'Log in\', \'تسجيل الدخول\')}</button>', true],
  ['Settings tooltip', 'title="Account settings"', 'title={tx("Account settings", "إعدادات الحساب")}'],
  ['Join free action', 'Join free <ArrowUpRight size={15} />', "{tx('Join free', 'انضم مجانًا')} <ArrowUpRight size={15} />"],
  ['Log out action', '>Log out</button>', '>{tx(\'Log out\', \'تسجيل الخروج\')}</button>', true],
  ['Profile action', '>Profile</button>', '>{tx(\'Profile\', \'الملف الشخصي\')}</button>', true],
  ['Verified role', '>Verified creator</small>', '>{tx(\'Verified creator\', \'مبدع موثّق\')}</small>', true],
  ['Pending role', '>Application pending</small>', '>{tx(\'Application pending\', \'طلب قيد المراجعة\')}</small>', true],
  ['Member role', '>Member</small>', '>{tx(\'Member\', \'عضو\')}</small>', true],
  ['Administrator role', '>Administrator</small>', '>{tx(\'Administrator\', \'مدير\')}</small>', true],
  ['Creator Studio action', '>Creator Studio</button>', '>{tx(\'Creator Studio\', \'استوديو المبدع\')}</button>', true],
  ['Apply as creator action', '>Apply as creator</button>', '>{tx(\'Apply as creator\', \'قدّم كصانع محتوى\')}</button>', true],
  ['Pending action', '>Pending</button>', '>{tx(\'Pending\', \'قيد المراجعة\')}</button>', true],
  ['Admin action', '>Admin</button>', '>{tx(\'Admin\', \'الإدارة\')}</button>', true],

  // Homepage hero and trust messaging.
  ['Hero eyebrow', 'MADE BY CREATORS. OWNED BY YOU.', '{tx(\'MADE BY CREATORS. OWNED BY YOU.\', \'من المبدعين وإليهم\')}'],
  ['Hero headline first line', '              Your next edit.', '              {tx(\'Your next edit.\', \'الإيديت اللي بتدور عليه\')}'],
  ['Hero headline second line', '<span>One click away.</span>', '<span>{tx(\'One click away.\', \'على بُعد ضغطة واحدة\')}</span>'],
  ['Hero description', 'Discover original edits from independent creators.\n              Support the talent, unlock the full-quality video,\n              and make it yours.', "{tx('Discover original edits from independent creators. Support the talent, unlock the full-quality video, and make it yours.', 'اكتشف إيديتات أصلية من مبدعين مستقلين. ادعم أصحابها وافتح الفيديو بجودته الأصلية، واستخدمه حسب الترخيص.')}"],
  ['Explore edits CTA', 'Explore edits <ArrowUpRight size={17} />', "{tx('Explore edits', 'استكشف الإيديتات')} <ArrowUpRight size={17} />"],
  ['Hero creator CTA default', ": 'Become a creator'}", ": tx('Become a creator', 'ابدأ كمبدع')}"],
  ['Hero creator CTA', "canAccessCreatorStudio ? 'Creator Studio' : user?.verification_status === 'pending' ? 'Application pending'", "canAccessCreatorStudio ? tx('Creator Studio', 'استوديو المبدع') : user?.verification_status === 'pending' ? tx('Application pending', 'طلبك قيد المراجعة')"],
  ['Hero proof title', '<b>Creator-first</b>', '<b>{tx(\'Creator-first\', \'المبدع أولًا\')}</b>'],
  ['Hero proof description', 'A marketplace built on credit, not reposts.', "{tx('A marketplace built on credit, not reposts.', 'سوق يحفظ حق المبدع وينسب العمل لصاحبه.')}"],
  ['Stats 1', '<span>Find your style</span>', '<span>{tx(\'Find your style\', \'اختار ستايلك\')}</span>'],
  ['Stats 2', '<span>Earn points from rewarded ads</span>', '<span>{tx(\'Earn points from rewarded ads\', \'اجمع النقاط من الإعلانات المؤهلة\')}</span>'],
  ['Stats 3', '<span>Unlock the original</span>', '<span>{tx(\'Unlock the original\', \'افتح الملف الأصلي\')}</span>'],
  ['Credit notice', 'Credit the creator.', "{tx('Credit the creator.', 'احفظ حق المبدع.')}"],
  ['Credit notice emphasized', '<b>Always.</b>', '<b>{tx(\'Always.\', \'دائمًا.\')}</b>'],

  // Explore marketplace controls and cards.
  ['Explore eyebrow', 'THE DROP ZONE / 001', "{tx('THE DROP ZONE / 001', 'اكتشف الإيديتات / ٠٠١')}"],
  ['Explore heading', 'Find your <span>next favorite.</span>', "{tx('Find your', 'اكتشف')} <span>{tx('next favorite.', 'إيديتك المفضل.')}</span>"],
  ['Explore description', 'Handpicked edits. Real creators. Original quality.', "{tx('Handpicked edits. Real creators. Original quality.', 'إيديتات مختارة من مبدعين حقيقيين وبجودة أصلية.')}"],
  ['View all edits', 'View all edits <ArrowUpRight size={15} />', "{tx('View all edits', 'عرض كل الإيديتات')} <ArrowUpRight size={15} />"],
  ['Category label translation', '                  {item}\n                </button>', "                  {language === 'ar' ? ({ 'All edits': 'كل الإيديتات', Anime: 'أنمي', Cinematic: 'سينمائي', Aesthetic: 'جمالي', Gaming: 'ألعاب', AMV: 'AMV', Other: 'أخرى' }[item] || item) : item}\n                </button>"],
  ['Search placeholder', 'placeholder="Search edits or creators..."', 'placeholder={tx("Search edits or creators...", "ابحث عن إيديت أو مبدع...")}'],
  ['No preview placeholder', 'No preview available', "{tx('No preview available', 'لا توجد معاينة')}", true],
  ['Public preview label', '>PUBLIC PREVIEW</span>', '>{tx(\'PUBLIC PREVIEW\', \'معاينة عامة\')}</span>', true],
  ['Save edit accessibility', 'aria-label="Save edit"', 'aria-label={tx("Save edit", "حفظ الإيديت")}'],
  ['Sign-in-to-save message', "setNotice('Sign in to save edits to your favorites.')", "setNotice(tx('Sign in to save edits to your favorites.', 'سجّل الدخول لحفظ الإيديتات في المفضلة.'))"],
  ['Favorites coming soon message', "setNotice('Favorites are coming soon.')", "setNotice(tx('Favorites are coming soon.', 'قائمة المفضلة ستتوفر قريبًا.'))"],
  ['Creator profile unavailable message', 'setNotice("Creator profile is not available.")', "setNotice(tx('Creator profile is not available.', 'صفحة المبدع غير متاحة حاليًا.'))"],
  ['Preview unavailable message', "setNotice('Preview is not available for this edit yet.')", "setNotice(tx('Preview is not available for this edit yet.', 'معاينة هذا الإيديت غير متاحة حاليًا.'))"],
  ['Verified creator title', 'title="Verified creator"', 'title={tx("Verified creator", "مبدع موثّق")}'],
  ['Preview duration badge', '<span className="duration">PREVIEW</span>', '<span className="duration">{tx(\'PREVIEW\', \'معاينة\')}</span>'],
  ['Preview button accessibility', 'aria-label={`Preview ${edit.title}`}', 'aria-label={`${tx("Preview", "معاينة")} ${edit.title}`}'],
  ['Owned status', '<Download size={14} /> Owned', '<Download size={14} /> {tx(\'Owned\', \'تم الفتح\')}'],
  ['Processing status', ": purchaseLoading ? (\n                        'Processing...'\n                      ) : (", ": purchaseLoading ? (\n                        tx('Processing...', 'جارٍ التنفيذ...')\n                      ) : ("],
  ['Unlock button', '<>\n                          Unlock <ArrowUpRight size={14} />\n                        </>', "<>\n                          {tx('Unlock', 'افتح')} <ArrowUpRight size={14} />\n                        </>"],
  ['Empty explore state', 'No public previews yet for this search. Try another category, or check back after creators upload preview clips.', "{tx('No public previews yet for this search. Try another category, or check back after creators upload preview clips.', 'لا توجد معاينات مطابقة حاليًا. جرّب تصنيفًا آخر أو ارجع بعد رفع المبدعين لمعاينات جديدة.')}"],

  // Premium-account marketplace normal-user view.
  ['Premium eyebrow', '>EXCLUSIVE ACCESS</div>', '>{tx(\'EXCLUSIVE ACCESS\', \'وصول مميز\')}</div>'],
  ['Premium heading', '<h2>Premium <span>Accounts.</span></h2>', '<h2>{tx(\'Premium\', \'حسابات\')} <span>{tx(\'Accounts.\', \'مميزة\')}</span></h2>'],
  ['Premium description', 'Place an order with points. The admin will handle delivery.', "{tx('Place an order with points. The admin will handle delivery.', 'اطلب باستخدام النقاط، وسيتولى فريق الإدارة متابعة تسليم الطلب.')}"],
  ['Premium available count', '{premiumProducts.length} AVAILABLE', "{premiumProducts.length} {tx('AVAILABLE', 'متاحة')}"],
  ['Premium loading state', 'Loading premium products...', "{tx('Loading premium products...', 'جارٍ تحميل الحسابات...')}", true],
  ['Premium empty state', 'No premium products are available right now.', "{tx('No premium products are available right now.', 'لا توجد حسابات متاحة حاليًا.')}"],
  ['Premium default description', "product.description || 'Premium digital access.'", "product.description || tx('Premium digital access.', 'وصول رقمي مميز.')"],
  ['Order processing', "? 'Processing...'", "? tx('Processing...', 'جارٍ التنفيذ...')"],
  ['Order now CTA', ": 'Order now'}", ": tx('Order now', 'اطلب الآن')}"],
  ['My orders heading', '<h3>My premium orders</h3>', '<h3>{tx(\'My premium orders\', \'طلباتي\')}</h3>'],
  ['No orders state', "<p className=\"premium-empty\">You haven't placed any orders yet.</p>", "<p className=\"premium-empty\">{tx(\"You haven't placed any orders yet.\", \'لم تقم بأي طلبات حتى الآن.\')}</p>"],
  ['Status pending', "? 'Pending'", "? tx('Pending', 'قيد الانتظار')"],
  ['Status completed', "? 'Completed'", "? tx('Completed', 'مكتمل')"],
  ['Status refunded', "? 'Rejected / refunded'", "? tx('Rejected / refunded', 'مرفوض / تم رد النقاط')"],

  // Creator invitation banner and How-it-works section, shown to ordinary users.
  ['Creator banner eyebrow active', "? 'APPROVED CREATOR WORKSPACE'", "? tx('APPROVED CREATOR WORKSPACE', 'مساحة المبدع المعتمدة')"],
  ['Creator banner eyebrow pending', ": user?.verification_status === 'pending' ? 'APPLICATION UNDER REVIEW' : 'FOR THE ONES BEHIND THE EDIT'", ": user?.verification_status === 'pending' ? tx('APPLICATION UNDER REVIEW', 'طلبك قيد المراجعة') : tx('FOR THE ONES BEHIND THE EDIT', 'لصنّاع الإيديتات')"],
  ['Creator banner title active', '<>Ready for your next <span>drop?</span></>', "<>{tx('Ready for your next', 'جاهز تنشر')} <span>{tx('drop?', 'إيديتك الجاي؟')}</span></>"],
  ['Creator banner title pending', '<>Your request is <span>under review.</span></>', "<>{tx('Your request is', 'طلبك')} <span>{tx('under review.', 'قيد المراجعة.')}</span></>"],
  ['Creator banner title default', '<>Your work deserves <span>more than a repost.</span></>', "<>{tx('Your work deserves', 'شغلك يستحق')} <span>{tx('more than a repost.', 'أكتر من مجرد إعادة نشر.')}</span></>"],
  ['Creator banner description active', "? 'Your creator access is active. Open Creator Studio to publish edits and manage your catalog.'", "? tx('Your creator access is active. Open Creator Studio to publish edits and manage your catalog.', 'حساب المبدع اتفعّل. افتح استوديو المبدع لنشر إيديتاتك وإدارة أعمالك.')"],
  ['Creator banner description pending', "? 'An administrator must approve your creator application before upload tools become available.'", "? tx('An administrator must approve your creator application before upload tools become available.', 'لازم الإدارة توافق على طلبك قبل إتاحة أدوات الرفع.')"],
  ['Creator banner description default', ": 'Apply for creator access from your Profile. Uploading is enabled only after an administrator approves your application.'", ": tx('Apply for creator access from your Profile. Uploading is enabled only after an administrator approves your application.', 'قدّم طلب الانضمام من ملفك الشخصي. هتظهر أدوات الرفع بعد موافقة الإدارة.')"],
  ['Creator banner active button', "? 'Open Creator Studio'", "? tx('Open Creator Studio', 'افتح استوديو المبدع')"],
  ['Creator banner pending button', ": user?.verification_status === 'pending' ? 'View application' : 'Apply as creator'", ": user?.verification_status === 'pending' ? tx('View application', 'عرض الطلب') : tx('Apply as creator', 'قدّم كمبدع')"],
  ['How eyebrow', '>SIMPLE BY DESIGN</div>', '>{tx(\'SIMPLE BY DESIGN\', \'بسيط من البداية\')}</div>'],
  ['How heading', 'Good edits. <span>Good credit.</span>', "{tx('Good edits.', 'إيديتات حلوة.')} <span>{tx('Good credit.', 'وحقوق محفوظة.')}</span>"],
  ['How discover title', '<h3>Discover</h3>', '<h3>{tx(\'Discover\', \'استكشف\')}</h3>'],
  ['How discover desc', 'Browse previews and find the edit that fits your vision.', "{tx('Browse previews and find the edit that fits your vision.', 'تصفّح المعاينات واختار الإيديت المناسب لذوقك.') }"],
  ['How points title', '<h3>Earn points</h3>', '<h3>{tx(\'Earn points\', \'اجمع النقاط\')}</h3>'],
  ['How points desc', 'Complete eligible rewarded ads to build your balance.', "{tx('Complete eligible rewarded ads to build your balance.', 'أكمل الإعلانات المؤهلة لزيادة رصيد نقاطك.') }"],
  ['How unlock title', '<h3>Unlock & download</h3>', '<h3>{tx(\'Unlock & download\', \'افتح وحمّل\')}</h3>'],
  ['How unlock desc', 'Spend points to access the original file from your library.', "{tx('Spend points to access the original file from your library.', 'استخدم نقاطك للوصول للملف الأصلي من مكتبتك.') }"],
  ['Footer tagline', 'Built for the people who make the edits.', "{tx('Built for the people who make the edits.', 'منصة معمولة للناس اللي بتصنع الإيديتات.')}"],
  ['Footer How it works', '>How it works</a>', '>{tx(\'How it works\', \'كيف يعمل الموقع\')}</a>', true],
  ['Footer Contact', '>Contact</a>', '>{tx(\'Contact\', \'تواصل معنا\')}</a>', true],
  ['Footer copyright', 'آ© 2026 EditVault آ· Respect the original.', "{tx('© 2026 EditVault · Respect the original.', '© 2026 EditVault · احترم العمل الأصلي.')}"],
  ['Wallet eyebrow', '>YOUR WALLET</div>', '>{tx(\'YOUR WALLET\', \'محفظتك\')}</div>'],
  ['Wallet points label', '<span>points</span>', '<span>{tx(\'points\', \'نقطة\')}</span>'],
  ['Wallet description', "Earn points by completing verified rewarded ads.\n                  Ad rewards will be enabled once the provider's\n                  server-side verification is connected.", "{tx(\'Earn points by completing verified rewarded ads. Ad rewards will be enabled once the provider’s server-side verification is connected.\', \'اجمع النقاط من الإعلانات المؤهلة بعد التحقق منها. سيتم تفعيل مكافآت الإعلانات عندما يكتمل ربط التحقق الآمن من جهة الخادم.\')}"],
  ['Reward ads coming soon', 'Reward ads coming soon <ArrowUpRight size={16} />', "{tx('Reward ads coming soon', 'الإعلانات بالمكافآت قريبًا')} <ArrowUpRight size={16} />"],
  ['Create account modal button', ": 'Create account'}", ": tx('Create account', 'إنشاء حساب')}"],
  ['Modal welcome eyebrow', "? 'WELCOME BACK'\n                    : 'YOUR CREATOR JOURNEY STARTS HERE'", "? tx('WELCOME BACK', 'أهلًا بعودتك')\n                    : tx('YOUR CREATOR JOURNEY STARTS HERE', 'رحلتك كمبدع تبدأ هنا')"],
  ['Modal headline login', "? 'Good to see you.'\n                    : 'Join the vault.'", "? tx('Good to see you.', 'سعداء بعودتك.')\n                    : tx('Join the vault.', 'انضم إلى المنصة.')"],
  ['Modal description auth', "? 'Log in to access your library and points.'\n                    : 'Create an account to unlock edits or publish your own.'", "? tx('Log in to access your library and points.', 'سجّل الدخول للوصول إلى مكتبتك ونقاطك.')\n                    : tx('Create an account to unlock edits or publish your own.', 'أنشئ حسابًا لفتح الإيديتات أو نشر أعمالك.')"],
  ['Display name label', '                      Display name\n', "                      {tx('Display name', 'الاسم المعروض')}\n"],
  ['Email address label', '                    Email address\n', "                    {tx('Email address', 'البريد الإلكتروني')}\n"],
  ['Password label', '                    Password\n', "                    {tx('Password', 'كلمة المرور')}\n"],
  ['Password placeholder', 'placeholder="At least 8 characters"', 'placeholder={tx("At least 8 characters", "8 أحرف على الأقل")}'],
];

for (const entry of substitutions) {
  const [label, from, to, allOrRequired] = entry;
  const all = allOrRequired === true;
  edit(label, from, to, { all });
}

// Update main document title when the Arabic UI is selected.
edit('Localized browser page title', "const pageLabels = {\n      home: 'Home', explore: 'Explore Edits', 'scene-packs': 'Scene Packs',\n      'clip-assembly': 'Clip Assembly', editlab: 'EditLab', earn: 'Earn Points',\n      accounts: 'Accounts', creators: 'Creators', how: 'How It Works',\n    };\n    document.title = `EditVault · ${pageLabels[activePage] || 'Home'}`;", "const pageLabels = language === 'ar' ? {\n      home: 'الرئيسية', explore: 'استكشف الإيديتات', 'scene-packs': 'حزم المشاهد',\n      'clip-assembly': 'تجميع المقاطع', editlab: 'معمل المونتاج', earn: 'جمع النقاط',\n      accounts: 'الحسابات', creators: 'المبدعون', how: 'كيف يعمل الموقع',\n    } : {\n      home: 'Home', explore: 'Explore Edits', 'scene-packs': 'Scene Packs',\n      'clip-assembly': 'Clip Assembly', editlab: 'EditLab', earn: 'Earn Points',\n      accounts: 'Accounts', creators: 'Creators', how: 'How It Works',\n    };\n    document.title = `EditVault · ${pageLabels[activePage] || pageLabels.home || 'Home'}`;");

main = main.replace("  }, [activePage]);\n  const [category, setCategory", "  }, [activePage, language]);\n  const [category, setCategory");
if (!main.includes('consumer-arabic-ui.css')) fail('Stylesheet import was not added. No files were changed.');

// Save a reversible backup before changing main.jsx and installing the CSS.
backup(mainPath);
fs.writeFileSync(mainPath, main, 'utf8');
fs.mkdirSync(path.dirname(cssTarget), { recursive: true });
if (fs.existsSync(cssTarget)) backup(cssTarget);
fs.copyFileSync(cssSource, cssTarget);

// Small correction to settings copy: no longer claim most of the customer interface stays English.
if (fs.existsSync(accountSettingsPath)) {
  let account = fs.readFileSync(accountSettingsPath, 'utf8').replace(/\r\n/g, '\n');
  const oldHelp = 'ستتبع الأقسام الجديدة والإعدادات هذا الاختيار؛ قد تظل بعض النصوص القديمة بالإنجليزية.';
  const newHelp = 'سيتم تطبيق اللغة على الواجهة الرئيسية وأقسام المتجر والأدوات المدعومة.';
  if (account.includes(oldHelp)) {
    backup(accountSettingsPath);
    account = account.replace(oldHelp, newHelp);
    fs.writeFileSync(accountSettingsPath, account, 'utf8');
    console.log('- Updated Arabic language preference help text');
  }
}

console.log('\nConsumer UI update applied.');
console.log('Backup files ending in .pre-consumer-ui-*.bak were created before the changes.');
console.log('Restart Vite and hard-refresh the page to verify the new Arabic RTL typography and marketplace layout.');
