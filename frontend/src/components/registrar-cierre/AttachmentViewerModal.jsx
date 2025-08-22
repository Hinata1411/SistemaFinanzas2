// src/components/registrar-cierre/AttachmentViewerModal.jsx
import React, { useEffect } from 'react';

export default function AttachmentViewerModal({ open, url, mime, name, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isImage =
    (mime && mime.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

  const isPdf =
    mime === 'application/pdf' || /\.pdf(\?|$)/i.test((url || '').toLowerCase());

  return (
    <div className="rc-modal-mask" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="rc-modal-card rc-viewer-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rc-modal-hd">
          <h4 style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || (isPdf ? 'Documento PDF' : 'Adjunto')}
          </h4>
          <div className="rc-modal-actions">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rc-btn rc-btn-outline"
              title="Abrir en nueva pestaña"
            >
              Abrir
            </a>
            <button className="rc-btn rc-btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        <div className="rc-viewer-body">
          {isImage && (
            <img
              src={url}
              alt={name || 'Adjunto'}
              className="rc-viewer-img"
            />
          )}

          {isPdf && (
            <iframe
              className="rc-viewer-iframe"
              src={url}
              title={name || 'PDF'}
            />
          )}

          {!isImage && !isPdf && (
            <div className="rc-empty">No se puede previsualizar este tipo de archivo.</div>
          )}
        </div>
      </div>
    </div>
  );
}
