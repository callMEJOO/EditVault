import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, Image as ImageIcon, ShieldCheck, Upload, X } from 'lucide-react';
import './topaz-admin.css';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export default function TopazAdmin({ open, onClose, user, onNotice }) {
  const [apiState, setApiState] = useState('checking');
  const [file, setFile] = useState(null);
  const [model, setModel] = useState('Standard V2');
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const stopPolling = useRef(false);

  const token = () => localStorage.getItem('editvault_token');
  const requestHeaders = () => ({ Authorization: 'Bearer ' + token() });
  const isTerminal = (status) => ['completed', 'complete', 'succeeded', 'success', 'done', 'failed', 'cancelled', 'error'].includes(String(status || '').toLowerCase());

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setApiState('checking');
    setError('');
    fetch(API_URL + '/api/topaz/status', { headers: requestHeaders() })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not check Topaz configuration.');
        if (live) setApiState(data.configured ? 'configured' : 'missing');
      })
      .catch((requestError) => { if (live) { setApiState('error'); setError(requestError.message || 'Could not check Topaz.'); } });
    return () => { live = false; };
  }, [open, user && user.id]);

  useEffect(() => {
    if (!open || !job || !job.processId || isTerminal(job.status)) return undefined;
    stopPolling.current = false;
    const poll = async () => {
      for (let attempt = 0; attempt < 180 && !stopPolling.current; attempt += 1) {
        await sleep(3000);
        if (stopPolling.current) return;
        try {
          const response = await fetch(API_URL + '/api/topaz/images/' + encodeURIComponent(job.processId) + '/status', { headers: requestHeaders() });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Topaz status check failed.');
          const rawStatus = String(data.status || 'Processing');
          const lower = rawStatus.toLowerCase();
          if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(lower)) {
            let downloadUrl = data.downloadUrl || data.url || '';
            if (!downloadUrl) {
              const downloadResponse = await fetch(API_URL + '/api/topaz/images/' + encodeURIComponent(job.processId) + '/download', { headers: requestHeaders() });
              const downloadData = await downloadResponse.json().catch(() => ({}));
              if (!downloadResponse.ok) throw new Error(downloadData.error || 'Topaz finished but the download link is not ready yet.');
              downloadUrl = downloadData.url || '';
            }
            setJob((current) => current && current.processId === job.processId ? { ...current, status: 'Completed', downloadUrl } : current);
            setBusy(false);
            return;
          }
          if (['failed', 'cancelled', 'error'].includes(lower)) {
            setJob((current) => current && current.processId === job.processId ? { ...current, status: rawStatus } : current);
            setError('Topaz image job ended with status: ' + rawStatus);
            setBusy(false);
            return;
          }
          setJob((current) => current && current.processId === job.processId ? { ...current, status: rawStatus } : current);
        } catch (requestError) {
          setError(requestError.message || 'Unable to check Topaz image job.');
          setBusy(false);
          return;
        }
      }
      if (!stopPolling.current) {
        setError('This image job is taking longer than the in-page wait. Check the Topaz dashboard before submitting another job.');
        setBusy(false);
      }
    };
    poll();
    return () => { stopPolling.current = true; };
  }, [open, job && job.processId]);

  if (!open) return null;

  const selectFile = (selectedFile) => {
    setError('');
    setJob(null);
    if (!selectedFile) { setFile(null); return; }
    const validMime = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff'].includes(selectedFile.type);
    const validExt = /\.(jpg|jpeg|png|webp|tif|tiff)$/i.test(selectedFile.name || '');
    if (!validMime && !validExt) { setFile(null); setError('Choose a JPG, PNG, WebP, or TIFF image.'); return; }
    if (selectedFile.size > MAX_IMAGE_BYTES) { setFile(null); setError('Image exceeds the 25 MB Topaz test limit.'); return; }
    setFile(selectedFile);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) { setError('Choose an image first.'); return; }
    if (!window.confirm('Topaz will process this image and may consume paid API credits. Continue?')) return;
    setBusy(true);
    setError('');
    setJob(null);
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('model', model);
      const response = await fetch(API_URL + '/api/topaz/images', { method: 'POST', headers: requestHeaders(), body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || ('Topaz image request failed (' + response.status + ').'));
      const processId = data.processId || data.requestId;
      if (!processId) throw new Error('Topaz accepted the image request but did not return a job ID. Check the Topaz dashboard before retrying.');
      setJob({ processId: String(processId), status: data.status || 'Queued', downloadUrl: '', info: model });
      onNotice && onNotice('Topaz image enhancement submitted.');
    } catch (requestError) {
      setError(requestError.message || 'Could not submit the Topaz image job.');
      setBusy(false);
    }
  };

  const terminal = job && isTerminal(job.status);
  return (
    <div className="topaz-admin-backdrop" role="presentation" onClick={onClose}>
      <section className="topaz-admin-modal" role="dialog" aria-modal="true" aria-label="Topaz image enhancement" onClick={(event) => event.stopPropagation()}>
        <header className="topaz-admin-header">
          <div className="topaz-admin-brand"><span><ImageIcon size={22} /></span><div><small>EDITVAULT / ADMIN ONLY</small><h2>Topaz Image Enhancer</h2><p>AI enhancement for still images only</p></div></div>
          <button type="button" className="topaz-admin-close" onClick={onClose} aria-label="Close Topaz image enhancer"><X /></button>
        </header>

        {apiState !== 'configured' && <div className={'topaz-admin-key-state ' + (apiState === 'configured' ? 'is-good' : 'is-warn')}>
          <span className="topaz-admin-state-dot" />
          {apiState === 'checking' ? 'Checking server configuration…' : apiState === 'missing' ? 'TOPAZ_API_KEY is missing from server/.env. Save it and restart the backend.' : error || 'Topaz configuration could not be checked.'}
        </div>}

        <form className="topaz-admin-form" onSubmit={submit}>
          <label className="topaz-admin-file-picker">
            <Upload size={22} />
            <strong>{file ? file.name : 'Choose an image'}</strong>
            <span>JPG, PNG, WebP, or TIFF · up to 25 MB</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/tiff,.jpg,.jpeg,.png,.webp,.tif,.tiff" onChange={(event) => selectFile(event.target.files && event.target.files[0])} />
          </label>

          <label>Enhancement model
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option>Standard V2</option>
              <option>High Fidelity V2</option>
            </select>
            <small>Image enhancement can consume paid Topaz API credits.</small>
          </label>

          <div className="topaz-admin-cost-note"><Activity size={17} /><p>Only image processing is enabled here. Video quality, sharpening, denoise, and frame rate are handled in EditLab. Check the <a href="https://developer.topazlabs.com/credit-calculator" target="_blank" rel="noreferrer">Topaz credit calculator</a> before starting an expensive job. This tool is restricted to your administrator account.</p></div>
          {error && <div className="topaz-admin-error" role="alert">{error}</div>}
          <button className="topaz-admin-submit" type="submit" disabled={busy || apiState !== 'configured' || !file}>{busy ? 'Submitting image job…' : 'Enhance image with Topaz'} <ArrowDownToLine size={17} /></button>
        </form>

        {job && <section className="topaz-admin-job" aria-live="polite">
          <div className="topaz-admin-job-top"><div><small>TOPAZ IMAGE JOB</small><strong>{job.processId}</strong></div><span className={'topaz-admin-job-status ' + (terminal ? 'is-terminal' : '')}>{job.status || 'Queued'}</span></div>
          {job.info && <p>{job.info}</p>}
          {!terminal && <p>Keep this panel open while the image job is checked. Processing time depends on image size and model.</p>}
          {job.status === 'Completed' && job.downloadUrl ? <a className="topaz-admin-download" href={job.downloadUrl} target="_blank" rel="noreferrer"><ArrowDownToLine size={17} /> Download enhanced image</a> : null}
          {job.status === 'Completed' && !job.downloadUrl ? <p>Topaz reports the image is finished but no download URL was returned. Check the Topaz dashboard before submitting another job.</p> : null}
        </section>}
      </section>
    </div>
  );
}
