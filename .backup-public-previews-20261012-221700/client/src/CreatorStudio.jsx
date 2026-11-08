import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Coins,
  ExternalLink,
  Film,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

const initialForm = {
  title: '',
  description: '',
  category: 'Anime',
  editingSoftware: 'After Effects',
  pricePoints: '80',
  original: null,
};

export default function CreatorStudio({
  open,
  onClose,
  user,
  onNotice,
}) {
  const [profile, setProfile] = useState(user || null);
  const [videos, setVideos] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState(initialForm);

  const [tiktokUrl, setTiktokUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');

  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('editvault_token');

  const headers = () => ({
    Authorization: `Bearer ${token()}`,
  });

  const readJson = async (response) => {
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || data.message || 'Request failed.'
      );
    }

    return data;
  };

  // Load creator profile, videos and sales.
  const loadStudio = useCallback(async () => {
    if (!token()) {
      setError('Please sign in to access Creator Studio.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [profileRes, videosRes, salesRes] = await Promise.all([
        fetch(`${API_URL}/api/creators/me`, {
          headers: headers(),
        }),
        fetch(`${API_URL}/api/edits/mine`, {
          headers: headers(),
        }),
        fetch(`${API_URL}/api/creators/sales`, {
          headers: headers(),
        }),
      ]);

      const [profileData, videosData, salesData] = await Promise.all([
        readJson(profileRes),
        readJson(videosRes),
        readJson(salesRes),
      ]);

      const nextProfile = profileData.user || profileData;

      setProfile(nextProfile);
      setTiktokUrl(nextProfile.tiktok_url || '');

      setVideos(
        Array.isArray(videosData.edits)
          ? videosData.edits
          : []
      );

      setSales(
        Array.isArray(salesData.sales)
          ? salesData.sales
          : []
      );
    } catch (e) {
      setError(e.message || 'Could not load Creator Studio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      loadStudio();
    }
  }, [open, user, loadStudio]);

  if (!open) return null;

  const verified =
    profile?.verification_status === 'verified' ||
    profile?.role === 'admin';

  const pending =
    profile?.verification_status === 'pending';

  const pointsEarned = videos.reduce(
    (sum, video) => sum + Number(video.points_earned || 0),
    0
  );

  const totalSales = videos.reduce(
    (sum, video) => sum + Number(video.sales || 0),
    0
  );

  // Submit TikTok verification request.
  const submitVerification = async (event) => {
    event.preventDefault();

    setRequesting(true);
    setError('');

    try {
      const response = await fetch(
        `${API_URL}/api/creators/verification-request`,
        {
          method: 'POST',
          headers: {
            ...headers(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tiktokUrl: tiktokUrl.trim(),
          }),
        }
      );

      const data = await readJson(response);

      setProfile(
        data.user || {
          ...profile,
          tiktok_url: tiktokUrl.trim(),
          verification_status: 'pending',
        }
      );

      onNotice?.(
        data.message || 'TikTok verification request submitted.'
      );

      await loadStudio();
    } catch (e) {
      setError(
        e.message || 'Could not submit verification request.'
      );
    } finally {
      setRequesting(false);
    }
  };

  // Upload a video with real upload progress.
  const submitUpload = async (event) => {
    event.preventDefault();

    if (!form.original) {
      setError('Choose a video file first.');
      return;
    }

    if (!form.title.trim()) {
      setError('Please enter a video title.');
      return;
    }

    if (!token()) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadMessage('Preparing video upload...');
    setError('');

    try {
      const body = new FormData();

      body.append('original', form.original);
      body.append('title', form.title.trim());
      body.append('description', form.description.trim());
      body.append('category', form.category);
      body.append('editingSoftware', form.editingSoftware);
      body.append('pricePoints', form.pricePoints);

      const uploadData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('POST', `${API_URL}/api/edits`);

        xhr.setRequestHeader(
          'Authorization',
          `Bearer ${token()}`
        );

        // Track the actual upload progress.
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          const progress = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100)
          );

          setUploadProgress(progress);

          if (progress >= 100) {
            setUploadMessage(
              'Upload sent. Waiting for server confirmation...'
            );
          } else {
            setUploadMessage(`Uploading video: ${progress}%`);
          }
        };

        xhr.onload = () => {
          let data;

          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            reject(
              new Error('The server returned an invalid response.')
            );
            return;
          }

          if (xhr.status < 200 || xhr.status >= 300) {
            reject(
              new Error(
                data.error ||
                  data.message ||
                  `Video upload failed (${xhr.status}).`
              )
            );
            return;
          }

          if (!data.edit?.id) {
            reject(
              new Error(
                'The server did not confirm that the video was saved.'
              )
            );
            return;
          }

          resolve(data);
        };

        xhr.onerror = () => {
          reject(
            new Error(
              'Network error. Check that the server is running.'
            )
          );
        };

        xhr.onabort = () => {
          reject(new Error('Video upload was cancelled.'));
        };

        xhr.ontimeout = () => {
          reject(new Error('The upload timed out. Please try again.'));
        };

        xhr.timeout = 0;
        xhr.send(body);
      });

      // The server confirmed that the video was saved.
      setUploadProgress(100);
      setUploadMessage('Video uploaded successfully!');

      setForm(initialForm);

      const fileInput = document.getElementById(
        'creator-original-video'
      );

      if (fileInput) {
        fileInput.value = '';
      }

      onNotice?.('Video uploaded successfully.');

      // Refresh the creator catalog.
      await loadStudio();
    } catch (e) {
      setError(e.message || 'Video upload failed.');
      setUploadMessage('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="creator-studio-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Creator Studio"
    >
      <section className="creator-studio">
        {/* Header */}
        <header className="cs-header">
          <div className="cs-brand">
            <span className="cs-brand-icon">
              <Film size={22} />
            </span>

            <div>
              <div className="eyebrow">
                EDITVAULT / CREATOR TOOLS
              </div>

              <h2>
                Creator <span>Studio</span>
              </h2>
            </div>
          </div>

          <div className="cs-header-actions">
            <button
              className="cs-quiet-btn"
              onClick={loadStudio}
              disabled={loading}
            >
              <RefreshCw size={15} />
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              className="cs-close"
              onClick={onClose}
              aria-label="Close Creator Studio"
            >
              <X />
            </button>
          </div>
        </header>

        <div className="cs-content">
          {/* Welcome */}
          <div className="cs-welcome">
            <div>
              <div className="eyebrow">
                YOUR CREATOR DASHBOARD
              </div>

              <h3>
                Welcome back,{' '}
                {profile?.display_name ||
                  profile?.displayName ||
                  user?.email ||
                  'creator'}
                .
              </h3>

              <p>
                Manage your edits, track sales, and keep your
                creator verification up to date.
              </p>
            </div>

            <span
              className={`cs-status ${
                verified
                  ? 'is-verified'
                  : pending
                    ? 'is-pending'
                    : ''
              }`}
            >
              {verified ? (
                <>
                  <BadgeCheck size={15} />
                  Verified creator
                </>
              ) : pending ? (
                'Verification pending'
              ) : (
                'Verification required'
              )}
            </span>
          </div>

          {/* Errors */}
          {error && (
            <div className="cs-error" role="alert">
              {error}
            </div>
          )}

          {/* Metrics */}
          <div className="cs-metrics">
            <article>
              <span>VIDEOS</span>
              <strong>{videos.length}</strong>
              <small>Uploaded by you</small>
            </article>

            <article>
              <span>TOTAL SALES</span>
              <strong>{totalSales}</strong>
              <small>Successful purchases</small>
            </article>

            <article>
              <span>POINTS EARNED</span>
              <strong>{pointsEarned.toLocaleString()}</strong>
              <small>From your edits</small>
            </article>
          </div>

          <div className="cs-grid">
            {/* Video Upload */}
            <section className="cs-panel">
              <div className="cs-panel-heading">
                <div>
                  <div className="eyebrow">PUBLISH NEW WORK</div>
                  <h3>Upload an edit</h3>
                </div>

                <Upload size={20} />
              </div>

              {!verified ? (
                <div className="cs-locked">
                  <ShieldCheck size={24} />

                  <strong>Verification needed</strong>

                  <p>
                    Submit your TikTok profile below. Uploading
                    is enabled after an admin verifies your account.
                  </p>
                </div>
              ) : (
                <form
                  className="cs-form"
                  onSubmit={submitUpload}
                >
                  <label>
                    Video file

                    <input
                      id="creator-original-video"
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm"
                      required
                      disabled={uploading}
                      onChange={(event) => {
                        setForm({
                          ...form,
                          original:
                            event.target.files?.[0] || null,
                        });

                        setError('');
                        setUploadMessage('');
                        setUploadProgress(0);
                      }}
                    />

                    <small>
                      MP4, MOV or WebM. Server upload limit applies.
                    </small>
                  </label>

                  <label>
                    Title

                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      value={form.title}
                      disabled={uploading}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          title: event.target.value,
                        })
                      }
                      placeholder="e.g. Neon after hours"
                    />
                  </label>

                  <label>
                    Description

                    <textarea
                      maxLength={2000}
                      value={form.description}
                      disabled={uploading}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          description: event.target.value,
                        })
                      }
                      placeholder="Tell buyers about this edit"
                      rows={3}
                    />
                  </label>

                  <div className="cs-form-row">
                    <label>
                      Category

                      <select
                        value={form.category}
                        disabled={uploading}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            category: event.target.value,
                          })
                        }
                      >
                        {[
                          'Anime',
                          'Cinematic',
                          'Aesthetic',
                          'Gaming',
                          'AMV',
                          'Other',
                        ].map((category) => (
                          <option key={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Editing software

                      <select
                        required
                        value={form.editingSoftware}
                        disabled={uploading}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            editingSoftware: event.target.value,
                          })
                        }
                      >
                        {[
                          'After Effects',
                          'Premiere Pro',
                          'CapCut',
                          'DaVinci Resolve',
                          'Final Cut Pro',
                          'Alight Motion',
                          'Other',
                        ].map((program) => (
                          <option key={program}>
                            {program}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label>
                    Price (points)

                    <input
                      required
                      type="number"
                      min="1"
                      max="100000"
                      step="1"
                      value={form.pricePoints}
                      disabled={uploading}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          pricePoints: event.target.value,
                        })
                      }
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary-cta cs-submit"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <span
                          className="cs-spinner"
                          aria-hidden="true"
                        />
                        Uploading {uploadProgress}%
                      </>
                    ) : (
                      <>
                        Upload video
                        <Upload size={16} />
                      </>
                    )}
                  </button>

                  {/* Upload progress */}
                  {(uploading || uploadMessage) && (
                    <div
                      className="cs-upload-progress"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="cs-upload-progress-track">
                        <div
                          className={`cs-upload-progress-fill ${
                            !uploading && uploadProgress === 100
                              ? 'is-complete'
                              : ''
                          }`}
                          style={{
                            width: `${uploadProgress}%`,
                          }}
                        />
                      </div>

                      <div className="cs-upload-progress-info">
                        <span>{uploadMessage}</span>

                        <strong>{uploadProgress}%</strong>
                      </div>
                    </div>
                  )}

                  {!uploading &&
                    uploadMessage &&
                    !error &&
                    uploadProgress === 100 && (
                      <p
                        className="cs-upload-success"
                        role="status"
                      >
                        ✓ {uploadMessage}
                      </p>
                    )}
                </form>
              )}
            </section>

            {/* TikTok Verification */}
            <section className="cs-panel">
              <div className="cs-panel-heading">
                <div>
                  <div className="eyebrow">
                    CREATOR VERIFICATION
                  </div>

                  <h3>TikTok profile</h3>
                </div>

                <ShieldCheck size={20} />
              </div>

              <p className="cs-panel-copy">
                Verification is reviewed manually. Use your
                public TikTok profile URL.
              </p>

              <form
                className="cs-form"
                onSubmit={submitVerification}
              >
                <label>
                  TikTok profile URL

                  <input
                    type="url"
                    required
                    value={tiktokUrl}
                    disabled={
                      requesting ||
                      verified ||
                      (profile?.verification_status &&
                        profile.verification_status !==
                          'not_requested')
                    }
                    onChange={(event) =>
                      setTiktokUrl(event.target.value)
                    }
                    placeholder="https://www.tiktok.com/@username"
                  />
                </label>

                {profile?.verification_note && (
                  <div className="cs-note">
                    Admin note: {profile.verification_note}
                  </div>
                )}

                <button
                  type="submit"
                  className="primary-cta cs-submit"
                  disabled={
                    requesting ||
                    verified ||
                    (profile?.verification_status &&
                      profile.verification_status !==
                        'not_requested')
                  }
                >
                  {verified
                    ? 'Already verified'
                    : pending
                      ? 'Request pending review'
                      : profile?.verification_status ===
                          'rejected'
                        ? 'Request already used'
                        : requesting
                          ? 'Submitting...'
                          : 'Request verification'}

                  <ExternalLink size={15} />
                </button>
              </form>

              <div className="cs-verification-hint">
                Status:{' '}
                <strong>
                  {profile?.verification_status ||
                    'not requested'}
                </strong>
              </div>
            </section>
          </div>

          {/* Creator Video Catalog */}
          <section className="cs-panel cs-videos-panel">
            <div className="cs-panel-heading">
              <div>
                <div className="eyebrow">YOUR CATALOG</div>
                <h3>My videos</h3>
              </div>

              <span className="cs-count">
                {videos.length} total
              </span>
            </div>

            {loading ? (
              <p className="cs-empty">
                Loading your creator data...
              </p>
            ) : videos.length === 0 ? (
              <div className="cs-empty">
                <Film size={25} />
                <strong>No videos yet</strong>
                <span>
                  Your uploaded videos will appear here.
                </span>
              </div>
            ) : (
              <div className="cs-video-list">
                {videos.map((video) => (
                  <article
                    className="cs-video-row"
                    key={video.id}
                  >
                    <div className="cs-video-icon">
                      <Film size={20} />
                    </div>

                    <div className="cs-video-info">
                      <strong>{video.title}</strong>

                      <span>
                        {video.category || 'Other'} ·{' '}
                        {video.editing_software ||
                          'Software not set'}{' '}
                        · {Number(video.price_points || 0)} points
                      </span>

                      <small>
                        {video.status || 'published'} ·{' '}
                        {video.created_at
                          ? new Date(
                              video.created_at
                            ).toLocaleDateString()
                          : ''}
                      </small>
                    </div>

                    <div className="cs-video-stats">
                      <span>
                        <b>{Number(video.sales || 0)}</b> sales
                      </span>

                      <span>
                        <b>
                          {Number(
                            video.points_earned || 0
                          ).toLocaleString()}
                        </b>{' '}
                        pts earned
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

      {/* Footer */}
      <footer className="cs-footer">
        <span>
          <Coins size={15} />
          Earnings are shown from completed purchase records.
        </span>

        <button onClick={onClose}>
          <ArrowLeft size={15} />
          Back to marketplace
        </button>
      </footer>
    </section>
  </div>
  );
}