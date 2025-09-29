import { useEffect, useMemo, useState } from 'react';

export default function FileUploader() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [filePath, setFilePath] = useState('');
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [letterYear, setLetterYear] = useState(currentYear);
  const requiredOk = useMemo(() => {
    if (!preview?.required_columns) return false;
    return Object.values(preview.required_columns).every(Boolean);
  }, [preview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-File-Name': file.name,
          'X-Letter-Year': String(letterYear),
        },
        body: file,
      });

  const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.location.href = blobUrl;
  setMessage('Upload erfolgreich. PDF wird geöffnet.');
    } catch (error) {
      setMessage('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: {
          'X-File-Name': file.name,
        },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Preview failed');
      }
      setPreview(data);
      setFilePath(data.file_path);
    } catch (err) {
      setMessage('Vorschau fehlgeschlagen: ' + err.message);
      setPreview(null);
      setFilePath('');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (file) {
      handlePreview();
    } else {
      setPreview(null);
      setFilePath('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  return (
    <div className="upload-card">
      <div className="upload-header">
        <h2 className="upload-title">AWO Geburtstagsbriefe erstellen</h2>
        <p className="upload-subtitle">Excel Export als .csv Datei aus ZMAV hier hochladen</p>
      </div>
      {/* Schritt 1: Datei auswählen */}
      <section className="step">
        <div className="step-header">
          <span className="step-number">1</span>
          <h3 className="step-title">Datei auswählen</h3>
        </div>
        <div className="step-body">
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
        </div>
      </section>
      {/* Vorschau erscheint automatisch nach Dateiauswahl */}
      {/* Schritt 2: Vorschau der Pflichtfelder (sichtbar nach Dateiauswahl) */}
      {preview && (
        <section className="step">
          <div className="step-header">
            <span className="step-number">2</span>
            <h3 className="step-title">Vorschau der Pflichtfelder</h3>
          </div>
          <div className="step-body">
            <div className="preview-container">
              <div className="preview-meta">
                <span className="badge">Encoding: {preview.detected_encoding}</span>
                <span className="badge">Delimiter: {preview.used_delimiter}</span>
                <span className="badge">Zeilen: {preview.row_count_estimate}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="preview-table">
                  <thead>
                    <tr>
                      {(preview.required_columns_order || []).map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i}>
                        {(preview.required_columns_order || []).map((name) => (
                          <td key={name}>{r[name] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.required_columns && (
                <div style={{ marginTop: 8 }}>
                  <strong>Pflichtspalten:</strong>
                  <div className="preview-required">
                    {(preview.required_columns_order || [
                      'Geburtsdatum',
                      'Briefanrede',
                      'Vorname',
                      'Nachname',
                      'Straße',
                      'Postleitzahl',
                      'Ort',
                    ]).map((name) => {
                      const ok = preview.required_columns?.[name] ?? false;
                      return (
                        <span key={name} className={`badge ${ok ? 'ok' : 'error'}`}>
                          {name}: {ok ? 'ok' : 'fehlt'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Schritt 3: Jahr auswählen (sichtbar nach Vorschau) */}
      {preview && (
        <section className='step'>
          <div className='step-header'>
            <span className='step-number'>3</span>
            <h3 className='step-title'>Jahr auswählen</h3>
          </div>
          <div className='step-body'>
            <div className='year-input'>
              <select
                className='year-select'
                disabled={uploading}
                value={letterYear}
                onChange={(e) => setLetterYear(Number(e.target.value))}
              >
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear + 1}>{currentYear + 1}</option>
              </select>
            </div>
          </div>
        </section>
      )}

      {/* Schritt 4: PDF erstellen (sichtbar nach Vorschau) */}
      {preview && (
        <section className="step">
          <div className="step-header">
            <span className="step-number">4</span>
            <h3 className="step-title">PDF erstellen</h3>
          </div>
          <div className="step-body">
            <button 
              className={`submit-button ${uploading ? 'uploading' : ''}`}
              disabled={uploading || !file || !requiredOk}
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
            {!requiredOk && (
              <div className="status-message error" style={{ marginTop: '8px' }}>
                Es fehlen Pflichtspalten in der CSV. Bitte korrigieren Sie die Datei.
              </div>
            )}
          </div>
        </section>
      )}

  {message && <div className="status-message">{message}</div>}
    </div>
  );
}