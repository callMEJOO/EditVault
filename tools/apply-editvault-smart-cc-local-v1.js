/** Keyless Smart CC install - run from EditVault project root. */
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const MARK = 'EDITVAULT_SMART_CC_LOCAL_V1';
const jsxRel = 'client/src/EditLabRewards.jsx';
const cssRel = 'client/src/editlab-rewards.css';
const helperRel = 'client/src/smart-cc-analyzer.js';
const pack = path.resolve(__dirname, '..', 'upgrade-files');
function read(rel) { const dest=path.join(root,rel); if (!fs.existsSync(dest)) throw new Error(`Not found: ${rel}. Open CMD in the project root.`); return fs.readFileSync(dest,'utf8'); }
function one(source, find, replacement, name) {
  const count=source.split(find).length-1;
  if (count!==1) throw new Error(`${name}: expected 1 match but found ${count}. Nothing changed.`);
  return source.replace(find,replacement);
}
try {
  let jsx=read(jsxRel), css=read(cssRel);
  if (jsx.includes(MARK)) { console.log('Smart CC is already installed. Nothing to do.'); process.exit(0); }
  if (css.includes(MARK)) throw new Error('Partial install detected: CSS exists but JSX is missing. Nothing changed.');
  if (!jsx.includes('const [toolTab, setToolTab]') || !jsx.includes("{toolTab === 'ai' &&") || !jsx.includes('const PRESETS = [') || !jsx.includes('function formatBytes')) {
    throw new Error('EditLab file does not match this installer. No project files were changed.');
  }
  if (!jsx.includes("{toolTab === 'color' &&") || !jsx.includes("{toolTab === 'compress' &&")) throw new Error('EditLab tabs are missing. Nothing changed.');
  const aiTab = jsx.split('\n').find(line=>line.includes("onClick={() => setToolTab('ai')}"));
  if (!aiTab) throw new Error('AI tab not found. Nothing changed.');
  const aiStart = jsx.indexOf("            {toolTab === 'ai' &&");
  const aiEnd = jsx.indexOf('\n          </section>',aiStart);
  if (aiStart<0 || aiEnd<0 || jsx.slice(aiStart,aiEnd).length>8000) throw new Error('Cannot identify the existing AI tab panel safely. Nothing changed.');
  jsx=one(jsx,"import './editlab-rewards.css';", "import './editlab-rewards.css';\nimport { analyzeVideoColor } from './smart-cc-analyzer.js'; // "+MARK, 'import');
  jsx=one(jsx,"  const [toolTab, setToolTab] = useState('color');",`  const [toolTab, setToolTab] = useState('color');
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartResult, setSmartResult] = useState(null);
  const [smartError, setSmartError] = useState('');
  const smartRunRef = useRef(0);`,'state');
  jsx=one(jsx,"    setProcessError('');\n    setResult(null);\n    if (!incoming) return;",`    setProcessError('');
    setResult(null);
    smartRunRef.current++;
    setSmartBusy(false);
    setSmartResult(null);
    setSmartError('');
    if (!incoming) return;`,'file selection reset');
  jsx=one(jsx,"  const clearFile = () => {\n    setFile(null); setResult(null); setProcessError('');",`  const clearFile = () => {
    smartRunRef.current++;
    setSmartBusy(false);
    setSmartResult(null);
    setSmartError('');
    setFile(null); setResult(null); setProcessError('');`,'file removal reset');
  jsx=one(jsx,"  const qualityOptions = [",`  const runSmartCC = async () => {
    if (!file || smartBusy) return;
    const runId = ++smartRunRef.current;
    setSmartBusy(true);
    setSmartResult(null);
    setSmartError('');
    try {
      const analysis = await analyzeVideoColor(file);
      if (runId === smartRunRef.current) setSmartResult(analysis);
    } catch (error) {
      if (runId === smartRunRef.current) setSmartError(error?.message || 'Could not analyze this video.');
    } finally {
      if (runId === smartRunRef.current) setSmartBusy(false);
    }
  };

  const applySmartCC = () => {
    if (!smartResult) return;
    const candidate = PRESETS.find((item) => item.id === smartResult.presetId) || PRESETS.find((item) => item.id === 'clean') || PRESETS[0];
    setPresetId(candidate.id);
    if (typeof setCcCategory === 'function') setCcCategory('all');
    setCompareMode('after');
    setToolTab('color');
    onNotice?.(tx('Recommended CC applied to preview. Export requires an account.', 'الـ CC المقترح اتطبق على المعاينة. التصدير بيحتاج حساب.'));
  };

  const qualityOptions = [`, 'Smart CC actions');
  const oldTab=jsx.split('\n').find(line=>line.includes("onClick={() => setToolTab('ai')}"));
  const newTab=oldTab.replace("{tx('AI quality boost', 'تحسين بالذكاء الاصطناعي')}","{tx('Smart CC', 'اقتراح CC ذكي')}")
    .replace("{tx('Coming soon', 'قريبًا')}","{tx('No API key', 'بدون مفتاح')}");
  if (newTab===oldTab) throw new Error('AI tab text did not match. Nothing changed.');
  jsx=one(jsx,oldTab,newTab,'Smart CC tab');
  const start=jsx.indexOf("            {toolTab === 'ai' &&");
  const end=jsx.indexOf('\n          </section>',start);
  if (start<0 || end<0 || end-start>8000) throw new Error('Smart CC panel replacement unsafe. Nothing changed.');
  const panel=`            {toolTab === 'ai' && <div className="evlr-tool-panel" role="tabpanel">
              <div className="evlr-smart-cc">
                <div className="evlr-smart-top"><span className="evlr-smart-icon"><Sparkles size={22}/></span><div>
                  <span className="evlr-smart-badge"><CheckCircle2 size={12}/>{tx('Free for everyone · no API key', 'مجاني للكل · بدون API Key')}</span>
                  <h3>{tx('Smart CC Finder', 'اختار CC المناسب تلقائيًا')}</h3>
                  <p>{tx('Analyze the brightness, contrast, and colors in a few frames from your video. Get an instant CC suggestion, right on your device.', 'هنحلل الإضاءة والتباين والألوان من كام لقطة في الفيديو ونقترحلك CC مناسب على جهازك مباشرة.')}</p>
                </div></div>
                <button type="button" className="evlr-smart-button" onClick={runSmartCC} disabled={!file || smartBusy}>
                  {smartBusy ? <><LoaderCircle size={16} className="evlr-spin" />{tx('Analyzing video...', 'بنحلل الفيديو...')}</> : <><WandSparkles size={17}/>{tx('Find my best CC', 'اقترحلي CC')}</>}
                </button>
                {!file && <p className="evlr-smart-disclaimer">{tx('Upload a video above to enable analysis. No sign-in is needed for suggestions.', 'ارفع فيديو من فوق الأول. مش محتاج تسجيل دخول عشان تاخد اقتراح.')}</p>}
                {smartError && <div className="evlr-smart-error" role="alert">{tx('Analysis unavailable:', 'تعذر التحليل:')} {smartError}</div>}
                {smartResult && <div className="evlr-smart-output" role="status">
                  <div><span className="evlr-smart-badge"><Check size={13}/>{tx('RECOMMENDED LOOK', 'الفلتر المقترح')}</span>
                    <h4>{(isArabic ? PRESETS.find(p => p.id === smartResult.presetId)?.ar : PRESETS.find(p => p.id === smartResult.presetId)?.en) || tx('Clean', 'طبيعي')}</h4>
                    <p>{isArabic ? smartResult.reasonAr : smartResult.reasonEn}</p></div>
                  <div className="evlr-smart-metrics">
                    <div><span>{tx('Brightness', 'الإضاءة')}</span><strong>{smartResult.brightness}/255</strong></div>
                    <div><span>{tx('Contrast', 'التباين')}</span><strong>{smartResult.contrast}</strong></div>
                    <div><span>{tx('Color level', 'الألوان')}</span><strong>{smartResult.saturation}%</strong></div>
                  </div>
                  <button type="button" className="evlr-smart-button" onClick={applySmartCC}><Check size={17}/>{tx('Apply suggested CC', 'طبّق الـ CC المقترح')} <ArrowRight size={15}/></button>
                </div>}
                <p className="evlr-smart-disclaimer">{tx('Local color analysis, not a generative AI model or true video restoration. Preview is free for all visitors; server export follows existing account rules. Some formats cannot be decoded by every browser.', 'تحليل ألوان محلي مش نموذج AI توليدي أو ترميم جودة حقيقي. المعاينة مجانية للكل، والتصدير حسب نظام الحساب الحالي. بعض صيغ الفيديو مش مدعومة على كل المتصفحات.')}</p>
              </div>
            </div>}`;
  jsx=jsx.slice(0,start)+panel+jsx.slice(end);
  const newCss=css+'\n'+fs.readFileSync(path.join(pack,'smart-cc.css'),'utf8');
  // Validate patched files fully before any write.
  if (!jsx.includes(MARK) || !jsx.includes('analyzeVideoColor') || !jsx.includes('applySmartCC') || !newCss.includes(MARK)) throw new Error('Validation failed. No changes made.');
  const backup=path.join(root,'backups',`before-smart-cc-${new Date().toISOString().replace(/[:.]/g,'-')}`);
  for (const rel of [jsxRel,cssRel]) {
    const dest=path.join(backup,rel);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(root,rel),dest);
  }
  if (fs.existsSync(path.join(root,helperRel))) {
    const dest=path.join(backup,helperRel);
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.copyFileSync(path.join(root,helperRel),dest);
  }
  fs.writeFileSync(path.join(root,jsxRel),jsx,'utf8');
  fs.writeFileSync(path.join(root,cssRel),newCss,'utf8');
  fs.copyFileSync(path.join(pack,'smart-cc-analyzer.js'),path.join(root,helperRel));
  console.log('SUCCESS! Added keyless Smart CC Finder to EditLab for all visitors.');
  console.log('Only client files modified. No DB change or API key needed.');
  console.log('Backup:',backup);
  console.log('Restart the client with npm run dev, then open /editlab.');
} catch (error) { console.error('Install stopped:',error.message); process.exitCode=1; }
