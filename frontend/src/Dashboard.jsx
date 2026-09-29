import { useState, useEffect, useRef } from 'react';
import { getFiles, uploadFile, getDownloadLink, deleteFile } from './api';
import './Dashboard.css';

function Dashboard({ token, onLogout }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState('all');
  const [previewUrls, setPreviewUrls] = useState({});
  const [modalFile, setModalFile] = useState(null);
  const [modalUrl, setModalUrl] = useState('');

  // Upload queue state
  const [pendingFiles, setPendingFiles] = useState([]); // files selected, awaiting confirm
  const [uploadQueue, setUploadQueue] = useState([]); // [{id, file, progress, status, controller}]
  const fileInputRef = useRef(null);

  const loadFiles = async () => {
    try {
      const res = await getFiles(token);
      setFiles(res.data.files);
    } catch (err) {
      setError('Failed to load files');
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    const loadPreviews = async () => {
      const needsPreview = files.filter(
        (f) => (f.type === 'image' || f.type === 'video') && !previewUrls[f.id]
      );
      if (needsPreview.length === 0) return;
      const newUrls = {};
      for (const f of needsPreview) {
        try {
          const res = await getDownloadLink(token, f.id);
          newUrls[f.id] = res.data.url;
        } catch (err) {}
      }
      setPreviewUrls((prev) => ({ ...prev, ...newUrls }));
    };
    if (files.length > 0) loadPreviews();
  }, [files]);

  // Step A: user picks files -> show confirmation preview, don't upload yet
  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;

    const withPreviews = selected.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      isImage: file.type.startsWith('image/'),
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setPendingFiles(withPreviews);
  };

  const cancelPending = () => {
    pendingFiles.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step B: user confirms -> start actual uploads with progress
  const confirmUpload = () => {
    const toUpload = pendingFiles;
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';

    toUpload.forEach((item) => {
      const queueId = `${Date.now()}-${Math.random()}`;
      const controller = new AbortController();

      setUploadQueue((prev) => [
        ...prev,
        { id: queueId, name: item.file.name, size: item.file.size, progress: 0, status: 'uploading', controller },
      ]);

      uploadFile(
        token,
        item.file,
        (percent) => {
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === queueId ? { ...q, progress: percent } : q))
          );
        },
        controller.signal
      )
        .then(() => {
          setUploadQueue((prev) =>
            prev.map((q) => (q.id === queueId ? { ...q, status: 'done', progress: 100 } : q))
          );
          loadFiles();
          // auto-remove from queue after a short delay
          setTimeout(() => {
            setUploadQueue((prev) => prev.filter((q) => q.id !== queueId));
          }, 2000);
        })
        .catch((err) => {
          if (err.code === 'ERR_CANCELED') {
            setUploadQueue((prev) => prev.map((q) => (q.id === queueId ? { ...q, status: 'canceled' } : q)));
          } else {
            setUploadQueue((prev) => prev.map((q) => (q.id === queueId ? { ...q, status: 'error' } : q)));
          }
        });

      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  };

  const cancelUpload = (queueId) => {
    setUploadQueue((prev) => {
      const item = prev.find((q) => q.id === queueId);
      if (item && item.controller) item.controller.abort();
      return prev;
    });
  };
  const removeFromQueue = (queueId) => {
  setUploadQueue((prev) => prev.filter((q) => q.id !== queueId));
};

  const handleDownload = async (fileId) => {
    try {
      const res = await getDownloadLink(token, fileId);
      window.open(res.data.url, '_blank');
    } catch (err) {
      setError('Download failed');
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await deleteFile(token, fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      setError('Delete failed');
    }
  };

  const openPreview = async (file) => {
    try {
      const res = await getDownloadLink(token, file.id);
      setModalUrl(res.data.url);
      setModalFile(file);
    } catch (err) {
      setError('Failed to open preview');
    }
  };

  const closeModal = () => {
    setModalFile(null);
    setModalUrl('');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const typeIcon = (type) => {
    if (type === 'image') return '🖼️';
    if (type === 'video') return '🎬';
    if (type === 'pdf') return '📕';
    return '📄';
  };

  const filteredFiles = () => {
    if (view === 'photos') return files.filter((f) => f.type === 'image');
    if (view === 'videos') return files.filter((f) => f.type === 'video');
    if (view === 'documents') return files.filter((f) => f.type === 'document' || f.type === 'pdf');
    return files;
  };

  const displayedFiles = filteredFiles();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>📁 RDrive</h1>
        <button className="btn-secondary" onClick={onLogout}>Log out</button>
      </header>

      <div className="toolbar">
        <div className="tabs">
          <button className={view === 'all' ? 'tab active' : 'tab'} onClick={() => setView('all')}>All Files</button>
          <button className={view === 'photos' ? 'tab active' : 'tab'} onClick={() => setView('photos')}>Photos</button>
          <button className={view === 'videos' ? 'tab active' : 'tab'} onClick={() => setView('videos')}>Videos</button>
          <button className={view === 'documents' ? 'tab active' : 'tab'} onClick={() => setView('documents')}>Documents</button>
        </div>

        <label className="btn-primary upload-btn">
          + Upload
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} hidden />
        </label>
      </div>

      {error && <p className="error-text">{error}</p>}

      {/* Active upload progress list */}
      {uploadQueue.length > 0 && (
        <div className="upload-queue">
          {uploadQueue.map((q) => (
            <div key={q.id} className="upload-item">
              <div className="upload-item-info">
                <span className="upload-name">{q.name}</span>
                <span className="upload-size">{formatSize(q.size)}</span>
              </div>
              <div className="upload-bar-track">
                <div
                  className={`upload-bar-fill ${q.status}`}
                  style={{ width: `${q.progress}%` }}
                />
              </div>
              <div className="upload-item-status">
                {q.status === 'uploading' && (
                  <>
                    <span>{q.progress}%</span>
                    <button onClick={() => cancelUpload(q.id)} className="cancel-btn">Cancel</button>
                  </>
                )}
                {q.status === 'done' && <span className="status-done">✓ Done</span>}
{q.status === 'canceled' && (
  <>
    <span className="status-canceled">Canceled</span>
    <button onClick={() => removeFromQueue(q.id)} className="cancel-btn">Remove</button>
  </>
)}
{q.status === 'error' && (
  <>
    <span className="status-error">Failed</span>
    <button onClick={() => removeFromQueue(q.id)} className="cancel-btn">Remove</button>
  </>
)}
              </div>
            </div>
          ))}
        </div>
      )}

      {(view === 'photos' || view === 'videos') ? (
        <div className="photo-grid">
          {displayedFiles.map((file) => (
            <div key={file.id} className="photo-card">
              <div className="photo-thumb" onClick={() => openPreview(file)} style={{ cursor: 'pointer' }}>
                {file.type === 'image' && previewUrls[file.id] ? (
                  <img src={previewUrls[file.id]} alt={file.name} />
                ) : file.type === 'video' && previewUrls[file.id] ? (
                  <video src={previewUrls[file.id]} muted />
                ) : (
                  <div className="thumb-placeholder">{typeIcon(file.type)}</div>
                )}
                {file.type === 'video' && <div className="play-badge">▶</div>}
              </div>
              <div className="photo-info">
                <span className="photo-name">{file.name}</span>
                <div className="photo-actions">
                  <button onClick={() => handleDownload(file.id)}>Download</button>
                  <button onClick={() => handleDelete(file.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            </div>
          ))}
          {displayedFiles.length === 0 && <p className="empty-text">Nothing here yet.</p>}
        </div>
      ) : (
        <table className="file-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayedFiles.map((file) => (
              <tr key={file.id}>
                <td
                  onClick={() => (file.type === 'pdf' || file.type === 'image' ? openPreview(file) : null)}
                  style={{ cursor: file.type === 'pdf' || file.type === 'image' ? 'pointer' : 'default' }}
                >
                  {typeIcon(file.type)} {file.name}
                </td>
                <td>{file.type}</td>
                <td>{formatSize(file.size_bytes)}</td>
                <td>{new Date(file.created_at).toLocaleDateString()}</td>
                <td className="row-actions">
                  <button onClick={() => handleDownload(file.id)}>Download</button>
                  <button onClick={() => handleDelete(file.id)} className="delete-btn">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {displayedFiles.length === 0 && view !== 'photos' && view !== 'videos' && (
        <p className="empty-text">No files yet. Upload something above!</p>
      )}

      {/* Pre-upload confirmation modal */}
      {pendingFiles.length > 0 && (
        <div className="modal-overlay" onClick={cancelPending}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={cancelPending}>✕</button>
            <h3>Upload {pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}?</h3>
            <div className="pending-list">
              {pendingFiles.map((f, i) => (
                <div key={i} className="pending-item">
                  {f.isImage ? (
                    <img src={f.previewUrl} alt={f.name} className="pending-thumb" />
                  ) : (
                    <div className="pending-thumb pending-icon">📄</div>
                  )}
                  <div className="pending-info">
                    <span className="pending-name">{f.name}</span>
                    <span className="pending-size">{formatSize(f.size)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button onClick={cancelPending} className="btn-secondary">Cancel</button>
              <button onClick={confirmUpload}>Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* File preview modal */}
      {modalFile && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>
            <h3>{modalFile.name}</h3>
            {modalFile.type === 'image' && <img src={modalUrl} alt={modalFile.name} className="modal-media" />}
            {modalFile.type === 'video' && <video src={modalUrl} controls autoPlay className="modal-media" />}
            {modalFile.type === 'pdf' && <iframe src={modalUrl} className="modal-pdf" title={modalFile.name} />}
            <div className="modal-actions">
              <button onClick={() => handleDownload(modalFile.id)}>Download</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;