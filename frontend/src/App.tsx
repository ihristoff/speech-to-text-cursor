import React, { useState, useRef, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

const premiumFont = `'Inter', 'Roboto', 'Segoe UI', Arial, sans-serif`;
const darkBg = '#181a20';
const cardBg = '#23262f';
const orange = '#ff9800';
const orangeAccent = '#ffb74d';
const textColor = '#f8fafc';
const cardShadow = '0 4px 24px rgba(0,0,0,0.18)';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileStats, setFileStats] = useState<{ name: string; size: string; type: string } | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [polling, setPolling] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [shineActive, setShineActive] = useState(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setJobId(null);
    setStatus('');
    setTranscript('');
    setSummary('');
    setError('');
    setProgress(0);
    if (f) {
      setFileStats({
        name: f.name,
        size: formatBytes(f.size),
        type: f.type,
      });
    } else {
      setFileStats(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setJobId(null);
    setStatus('');
    setTranscript('');
    setSummary('');
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/upload`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        setUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          setJobId(data.job_id);
          setStatus('pending');
          startPolling(data.job_id);
        } else {
          const data = JSON.parse(xhr.responseText);
          setError(data.error || 'Upload failed');
        }
      };
      xhr.onerror = () => {
        setUploading(false);
        setError('Upload error');
      };
      xhr.send(formData);
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'Upload error');
    }
  };

  const startPolling = (jobId: string) => {
    setPolling(true);
    setProgress(95); // Start at 95% after upload
    pollingRef.current = setInterval(() => checkStatus(jobId), 2000);
  };

  const stopPolling = () => {
    setPolling(false);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  const checkStatus = async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/status/${jobId}`);
      const data = await res.json();
      if (data.status === 'completed') {
        setStatus('completed');
        setTranscript(data.transcript || '');
        setSummary(data.summary || '');
        setProgress(100);
        stopPolling();
      } else if (data.status === 'failed') {
        setStatus('failed');
        setError(data.error_message || 'Job failed');
        setProgress(100);
        stopPolling();
      } else {
        setStatus(data.status);
        setProgress((prev) => (prev < 98 ? prev + 1 : prev));
      }
    } catch (err: any) {
      setError('Status check failed');
      setProgress(100);
      stopPolling();
    }
  };

  const handleDownload = async (type: 'transcript' | 'summary') => {
    if (!jobId) return;
    try {
      const res = await fetch(`${API_BASE}/download/${jobId}/${type}`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobId}_${type}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Download failed');
    }
  };

  // Count words in transcript
  const transcriptWordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  // Run shine animation on mount
  useEffect(() => {
    setShineActive(true);
    const timer = setTimeout(() => setShineActive(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Run shine animation when job finishes
  useEffect(() => {
    if (status === 'completed') {
      setShineActive(true);
      const timer = setTimeout(() => setShineActive(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div style={{ minHeight: '100vh', background: darkBg, fontFamily: premiumFont, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        .shine-card {
          position: relative;
          overflow: hidden;
        }
        .shine-card__shine::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(120deg, transparent 60%, ${orangeAccent}33 80%, transparent 100%);
          transform: rotate(0deg);
          animation: shine-move 2.5s linear 1;
          pointer-events: none;
        }
        @keyframes shine-move {
          0% { transform: translateX(-100%) rotate(0deg); }
          100% { transform: translateX(100%) rotate(0deg); }
        }
        .shine-btn:hover {
          background: ${orangeAccent} !important;
          color: ${darkBg} !important;
          box-shadow: 0 0 0 2px ${orangeAccent} !important;
        }
      `}</style>
      <div className={`shine-card${shineActive ? ' shine-card__shine' : ''}`} style={{ background: cardBg, borderRadius: 22, boxShadow: cardShadow, padding: 44, maxWidth: 1000, width: '100%', textAlign: 'center', border: `1.5px solid ${orangeAccent}10`, transition: 'box-shadow 0.2s' }}>
        <h1 style={{ color: orange, fontWeight: 900, letterSpacing: -1, fontSize: 36, marginBottom: 8, textShadow: `0 2px 8px ${orangeAccent}30` }}>Speech-to-Text App</h1>
        <div style={{ color: textColor, opacity: 0.85, marginBottom: 32, fontSize: 17, fontWeight: 500 }}>Upload your audio or video, get a premium transcript & summary.</div>
        <label style={{ display: 'inline-block', marginBottom: 18 }}>
          <input
            type="file"
            accept="audio/mp3,video/mp4,audio/mpeg"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <span
            className="shine-btn"
            style={{
              display: 'inline-block',
              background: orangeAccent,
              color: darkBg,
              borderRadius: 8,
              padding: '10px 28px',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(255,152,0,0.08)',
              cursor: 'pointer',
              border: `2px solid ${orangeAccent}60`,
              transition: 'background 0.2s, box-shadow 0.2s',
              marginBottom: 0,
            }}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') (e.target as HTMLElement).click(); }}
          >
            {file ? 'Change File' : 'Select File'}
          </span>
        </label>
        {fileStats && (
          <div style={{ color: orangeAccent, fontWeight: 600, fontSize: 15, marginBottom: 10, marginTop: -8, letterSpacing: 0.2 }}>
            <span style={{ marginRight: 18 }}>Name: <span style={{ color: textColor }}>{fileStats.name}</span></span>
            <span style={{ marginRight: 18 }}>Size: <span style={{ color: textColor }}>{fileStats.size}</span></span>
            <span>Type: <span style={{ color: textColor }}>{fileStats.type}</span></span>
          </div>
        )}
        <br />
        <button
          className="shine-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            background: orange,
            color: darkBg,
            border: 'none',
            borderRadius: 8,
            padding: '12px 32px',
            fontWeight: 800,
            fontSize: 17,
            boxShadow: uploading ? `0 0 0 2px ${orangeAccent}` : '0 2px 8px rgba(255,152,0,0.08)',
            cursor: !file || uploading ? 'not-allowed' : 'pointer',
            opacity: !file || uploading ? 0.6 : 1,
            marginBottom: 14,
            marginTop: 2,
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        {(uploading || polling) && (
          <div style={{ margin: '22px 0 10px 0', width: '100%' }}>
            <div style={{ height: 10, width: '100%', background: '#333', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{ height: 10, width: `${progress}%`, background: orangeAccent, borderRadius: 7, transition: 'width 0.4s' }} />
            </div>
            <div style={{ color: orangeAccent, fontWeight: 700, fontSize: 14, marginTop: 4 }}>{progress}%</div>
          </div>
        )}
        {error && <div style={{ color: '#ff5252', marginTop: 8, fontWeight: 600, fontSize: 15 }}>{error}</div>}
        {jobId && (
          <div style={{ marginTop: 20, background: cardBg, borderRadius: 12, padding: 18, border: `1px solid ${orangeAccent}10`, color: orangeAccent, fontWeight: 700, fontSize: 16, letterSpacing: 0.2, boxShadow: '0 1px 4px #0002' }}>
            <div><b>Job ID:</b> <span style={{ color: textColor }}>{jobId}</span></div>
            <div><b>Status:</b> <span style={{ color: textColor }}>{status}</span></div>
          </div>
        )}
        {status === 'completed' && (
          <div style={{
            marginTop: 38,
            display: 'flex',
            gap: 38,
            justifyContent: 'center',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            textAlign: 'left',
          }}>
            <div style={{ flex: 1, minWidth: 280, maxWidth: 420, background: darkBg, borderRadius: 12, boxShadow: '0 1px 8px #0003', border: `1px solid ${orangeAccent}20`, padding: 20, position: 'relative', transition: 'box-shadow 0.2s' }}>
              <h3 style={{ color: orange, fontWeight: 800, fontSize: 22, marginBottom: 10, letterSpacing: 0.2 }}>Transcript</h3>
              <pre style={{ background: 'transparent', padding: 0, borderRadius: 8, fontSize: 16, color: textColor, fontFamily: 'inherit', marginBottom: 18, whiteSpace: 'pre-wrap', minHeight: 120 }}>{transcript}</pre>
              <div style={{ color: orangeAccent, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Words: <span style={{ color: textColor }}>{transcriptWordCount}</span></div>
              <button
                className="shine-btn"
                onClick={() => handleDownload('transcript')}
                style={{
                  background: orangeAccent,
                  color: darkBg,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: 15,
                  marginBottom: 10,
                  marginRight: 12,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(255,152,0,0.08)',
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              >
                Download Transcript
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 280, maxWidth: 420, background: darkBg, borderRadius: 12, boxShadow: '0 1px 8px #0003', border: `1px solid ${orangeAccent}20`, padding: 20, position: 'relative', transition: 'box-shadow 0.2s' }}>
              <h3 style={{ color: orange, fontWeight: 800, fontSize: 22, marginBottom: 10, letterSpacing: 0.2 }}>Summary</h3>
              <pre style={{ background: 'transparent', padding: 0, borderRadius: 8, fontSize: 16, color: textColor, fontFamily: 'inherit', marginBottom: 18, whiteSpace: 'pre-wrap', minHeight: 120 }}>{summary}</pre>
              <button
                className="shine-btn"
                onClick={() => handleDownload('summary')}
                style={{
                  background: orangeAccent,
                  color: darkBg,
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: 15,
                  marginBottom: 10,
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(255,152,0,0.08)',
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              >
                Download Summary
              </button>
            </div>
          </div>
        )}
        <div style={{ marginTop: 38, color: orangeAccent, opacity: 0.5, fontSize: 14, fontWeight: 600, letterSpacing: 0.2 }}>
          &copy; {new Date().getFullYear()} Speech-to-Text App. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default App;
