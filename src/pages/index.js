import { useState } from 'react';

export default function FileUploader() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-File-Name': file.name,
        },
        body: file,
      });

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.location.href = blobUrl;
      
      setMessage(data.message || 'Upload successful');
    } catch (error) {
      setMessage('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-card">
      <div className="upload-header">
        <h2 className="upload-title">AWO Geburtstagsbriefe erstellen</h2>
        <p className="upload-subtitle">Excel Export als .xls Datei aus ZMAV hier hochladen</p>
      </div>

      <div 
        className={`upload-zone ${isDragging ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          setFile(e.dataTransfer.files[0]);
        }}
      >
        <div className="upload-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
        </div>
        
        {file ? (
          <div className="file-preview">
            <p className="file-name">{file.name}</p>
            <button 
              className="clear-button"
              onClick={() => setFile(null)}
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <label className="browse-button">
              Datei auswählen
              <input 
                type="file" 
                className="file-input"
                onChange={(e) => setFile(e.target.files[0])}
                disabled={uploading}
              />
            </label>
          </>
        )}
      </div>
      
      <div className='year-input'>
        <select className='year-select'
          disabled={uploading}
        >
          <option>2025</option>
          <option>2026</option>
        </select>
      </div>

      <button 
        className={`submit-button ${uploading ? 'uploading' : ''}`}
        disabled={uploading || !file}
        onClick={handleSubmit}
      >
        {uploading ? (
          <>
            <span className="spinner"></span>
            Wird hochgeladen...
          </>
        ) : (
          'Hochladen und PDF erstellen ...'
        )}
      </button>

      {message && <div className={`status-message ${message.type}`}>{message.text}</div>}
    </div>
  );
}