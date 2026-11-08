import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, Image as ImageIcon, ShieldCheck, Upload, Video, X } from 'lucide-react';
import './topaz-admin.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TopazAdmin({ open, onClose, user, onNotice }) {
  const [mode, setMode] = useState('image');
  const [apiState, setApiState] = useState('checking');
  const [file, setFile] = useState(null);
  const [model, setModel] = useState('Standard V2');
  const [quality, setQuality] = useState('1080p');
  const [frameRate, setFrameRate] = useState('30');
  const [videoMeta, setVideoMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const stopPolling = useRef(false);

  const token = () => localStorage.getItem('editvault_token');
  const requestHeaders = () => ({ Authorization: `Bearer ${token()}` });

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setApiState('checking');
    fetch(`${API_URL}/api/topaz/status`, { headers: requestHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not check Topaz configuration.');
        if (live) setApiState(data.configured ? 'configured' : 'missing');
      })
      .catch((requestError) => { if (live) { setApiState('error'); setError(requestError.message || 'Could not check Topaz.'); } });
    return () => { live = false; };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !job?.processId || ['Completed', 'Failed', 'Cancelled', 'Error'].includes(job.status)) return undefined;
    stopPolling.current = false;
    const poll = async () => {
      for (let attempt = 0; attempt < (job.kind === 'video' ? 240 : 180) && !stopPolling.current; attempt += 1) {
        await sleep(3000);
        if (stopPolling.current) return;
        try {
          const path = job.kind === 'image' ? 'images' : 'videos';
          const response = await fetch(`${API_URL}/api/topaz/${path}/${encodeURIComponent(job.processId)}/status`, { headers: requestHeaders() });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Topaz status check failed.');
          const rawStatus = String(data.status || 'Processing');
          const lower = rawStatus.toLowerCase();
          if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(lower)) {
            let downloadUrl = data.downloadUrl || '';
            if (job.kind === 'image' && !downloadUrl) {
              const downloadResponse = await fetch(`${API_URL}/api/topaz/images/${encodeURIComponent(job.processId)}/download`, { headers: requestHeaders() });
              const downloadData = await downloadResponse.json().catch(() => ({}));
              if (!downloadResponse.ok) throw new Error(downloadData.error || 'Topaz finished but the download link is not ready yet.');
              downloadUrl = downloadData.url || '';
            }
            setJob((current) => current?.processId === job.processId ? { ...current, status: 'Completed', downloadUrl } : current);
            setBusy(false);
            return;
          }
          if (['failed', 'cancelled', 'error'].includes(lower)) {
            setJob((current) => current?.processId === job.processId ? { ...current, status: rawStatus } : current);
            setError(`Topaz job ended with status: ${rawStatus}`);
            setBusy(false);
            return;
          }
          setJob((current) => current?.processId === job.processId ? { ...current, status: rawStatus } : current);
        } catch (requestError) {
          setError(requestError.message || 'Unable to check Topaz job.');
          setBusy(false);
          return;
        }
      }
      if (!stopPolling.current) {
        setError('This job is taking longer than the in-page wait. Close this window safely and check the Topaz dashboard or reopen the tool to check again.');
        setBusy(false);
      }
    };
    poll();
    return () => { stopPolling.current = true; };
  }, [open, job?.processId, job?.kind]);

  if (!open) return null;

  const selectFile = (selectedFile) => {
    setFile(selectedFile || null);
    setVideoMeta(null);
    setError('');
    setJob(null);
    if (!selectedFile || !selectedFile.name.toLowerCase().endsWith('.mp4')) return;
    const objectUrl = URL.createObjectURL(selectedFile);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      setVideoMeta({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
      URL.revokeObjectURL(objectUrl);
    };
    video.onerror = () => { setError('The video metadata could not be read. Try another MP4 file.'); URL.revokeObjectURL(objectUrl); };
    video.src = objectUrl;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) { setError(mode === 'image' ? 'Choose an image first.' : 'Choose an MP4 video first.'); return; }
    if (mode === 'video' && !videoMeta) { setError('Wait until the video metadata is loaded, then submit again.'); return; }
    const spendWarning = mode === 'image'
      ? 'Topaz will process this image and may charge API credits. Continue?'
      : `Topaz will process this video to ${quality} and may charge API credits. Continue?`;
    if (!window.confirm(spendWarning)) return;
    setBusy(true); setError(''); setJob(null);
    try {
      const body = new FormData();
      body.append(mode === 'image' ? 'image' : 'video', file);
      let endpoint = `${API_URL}/api/topaz/images`;
      if (mode === 'image') {
        body.append('model', model);
      } else {
        endpoint = `${API_URL}/api/topaz/videos`;
        body.append('width', String(videoMeta.width));
        body.append('height', String(videoMeta.height));
        body.append('duration', String(Number(videoMeta.duration.toFixed(3))));
        body.append('frameRate', frameRate);
        body.append('quality', quality);
      }
      const response = await fetch(endpoint, { method: 'POST', headers: requestHeaders(), body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Topaz request failed (${response.status}).`);
      const processId = data.processId || data.requestId;
      if (!processId) throw new Error('Topaz accepted the request but did not return a job ID.');
      setJob({ kind: mode, processId, status: data.status || 'Queued', downloadUrl: '', info: mode === 'video' ? `${data.output || quality} · ${data.model || 'Proteus'}` : model });
      onNotice?.(mode === 'image' ? 'Topaz image enhancement submitted.' : 'Topaz video enhancement submitted.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit the Topaz job.');
      setBusy(false);
    }
  };

  const statusText = job?.status || 'Ready';
  const terminal = job && ['Completed', 'Failed', 'Cancelled', 'Error'].includes(job.status);

  return (
    <div className="topaz-admin-backdrop" role="presentation" onClick={onClose}>
      <section className="topaz-admin-modal" role="dialog" aria-modal="true" aria-label="Topaz AI admin tool" onClick={(event) => event.stopPropagation()}>
        <header className="topaz-admin-header">
          <div className="topaz-admin-brand"><span><ShieldCheck size={22} /></span><div><small>EDITVAULT / ADMIN ONLY</small><h2>Topaz AI Studio</h2><p>Private media enhancement workspace</p></div></div>
          <button type="button" className="topaz-admin-close" onClick={onClose} aria-label="Close Topaz AI"><X /></button>
        </header>

        {apiState !== 'configured' && <div className={`topaz-admin-key-state ${apiState === 'configured' ? 'is-good' : 'is-warn'}`}>
          <span className="topaz-admin-state-dot" />
          {apiState === 'checking' ? 'Checking server configuration…' : apiState === 'missing' ? 'TOPAZ_API_KEY is missing from server/.env. Save it and restart the backend.' : error || 'Topaz configuration could not be checked.'}
        </div>}

        <div className="topaz-admin-tabs" role="tablist" aria-label="Media type">
          <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'is-active' : ''} onClick={() => { setMode('image'); setFile(null); setVideoMeta(null); setJob(null); setError(''); }}><ImageIcon size={17} /> Enhance image</button>
          <button type="button" role="tab" aria-selected={mode === 'video'} className={mode === 'video' ? 'is-active' : ''} onClick={() => { setMode('video'); setFile(null); setVideoMeta(null); setJob(null); setError(''); }}><Video size={17} /> Enhance video</button>
        </div>

        <form className="topaz-admin-form" onSubmit={submit}>
          <label className="topaz-admin-file-picker">
            <Upload size={22} />
            <strong>{file ? file.name : mode === 'image' ? 'Choose an image' : 'Choose an MP4 video'}</strong>
            <span>{mode === 'image' ? 'JPG, PNG, WebP, or TIFF · up to 25 MB' : 'MP4 only for this first test · up to 25 MB and 2 minutes'}</span>
            <input type="file" accept={mode === 'image' ? 'image/jpeg,image/png,image/webp,image/tiff' : 'video/mp4,.mp4'} onChange={(event) => selectFile(event.target.files?.[0] || null)} />
          </label>

          {mode === 'image' ? (
            <label>Enhancement model
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                <option>Standard V2</option>
                <option>High Fidelity V2</option>
              </select>
              <small>Enhance requests consume API credits once Topaz processes the image.</small>
            </label>
          ) : (
            <div className="topaz-admin-video-options">
              <div className="topaz-admin-video-meta"><strong>Source details</strong><span>{videoMeta ? `${videoMeta.width} × ${videoMeta.height} · ${videoMeta.duration.toFixed(1)} sec` : 'Choose a video to read its dimensions and duration.'}</span></div>
              <label>Output quality
                <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                  <option value="720p">720p</option><option value="1080p">1080p</option><option value="4k">4K</option>
                </select>
              </label>
              <label>Input frame rate
                <select value={frameRate} onChange={(event) => setFrameRate(event.target.value)}>
                  <option value="24">24 FPS</option><option value="25">25 FPS</option><option value="30">30 FPS</option><option value="50">50 FPS</option><option value="60">60 FPS</option>
                </select>
                <small>Choose the source video's actual FPS when known.</small>
              </label>
            </div>
          )}

          <div className="topaz-admin-cost-note"><Activity size={17} /><p>Processing can consume paid Topaz API credits. Check the current <a href="https://developer.topazlabs.com/credit-calculator" target="_blank" rel="noreferrer">credit calculator</a> before starting expensive 4K jobs. This tool is restricted to your administrator account; don't expose it to regular users without Topaz's written approval.</p></div>
          {error && <div className="topaz-admin-error" role="alert">{error}</div>}
          <button className="topaz-admin-submit" type="submit" disabled={busy || apiState !== 'configured' || !file || (mode === 'video' && !videoMeta)}>{busy ? 'Submitting job…' : `Start ${mode === 'image' ? 'image' : 'video'} enhancement`} <ArrowDownToLine size={17} /></button>
        </form>

        {job && <section className="topaz-admin-job" aria-live="polite">
          <div className="topaz-admin-job-top"><div><small>TOPAZ JOB</small><strong>{job.processId}</strong></div><span className={`topaz-admin-job-status ${terminal ? 'is-terminal' : ''}`}>{statusText}</span></div>
          {job.info && <p>{job.info}</p>}
          {!terminal && <p>Keep this panel open while the job is checked. Processing time depends on file size and model.</p>}
          {job.status === 'Completed' && job.downloadUrl ? <a className="topaz-admin-download" href={job.downloadUrl} target="_blank" rel="noreferrer"><ArrowDownToLine size={17} /> Download enhanced result</a> : null}
          {job.status === 'Completed' && !job.downloadUrl ? <p>Topaz reports the job is finished but no download URL was returned. Check the Topaz dashboard before resubmitting.</p> : null}
        </section>}
      </section>
    </div>
  );
}
