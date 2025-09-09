// src/components/registrar-cierre/AttachmentViewerModal.jsx
import React, { useEffect } from 'react';

export default function AttachmentViewerModal({
  open,
  url,
  mime,
  name,
  onClose,
  onChangeFile,   // <- callback para "Cambiar"
  onRemoveFile,   // <- callback para "Quitar"
}) {
  // Bloquear scroll del fondo
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, [open]);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // En tu flujo solo subes imágenes; mantenemos este check por seguridad
  const isImage =
    (mime && mime.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

  return (
    <div
      className="rc-modal-mask"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        className="rc-modal-card rc-viewer-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(920px, 92vw)',
          height: 'min(92vh, 92dvh)',
          background: '#fff',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 28px rgba(0,0,0,.22)',
        }}
      >
        {/* Header (ahora con Cambiar/Quitar/Cerrar) */}
        <div
          className="rc-modal-hd"
          style={{
            padding: '10px 12px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flex: '0 0 auto',
          }}
        >
          <h4
            style={{
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={name || 'Adjunto'}
          >
            {name || 'Adjunto'}
          </h4>

          <div className="rc-modal-actions" style={{ display: 'flex', gap: 8 }}>
            {onChangeFile && (
              <button
                type="button"
                className="rc-btn rc-btn-outline"
                onClick={onChangeFile}
              >
                Cambiar
              </button>
            )}
            {onRemoveFile && (
              <button
                type="button"
                className="rc-btn rc-btn-ghost"
                onClick={onRemoveFile}
                title="Quitar archivo"
              >
                Quitar
              </button>
            )}
            <button className="rc-btn rc-btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Contenido: imagen contenida, con scroll dentro del modal */}
        <div
          className="rc-viewer-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,          // <- permite que el contenedor calcule alto correctamente
            overflow: 'auto',      // <- scroll interno si la imagen desborda
            background: '#0b0b0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isImage ? (
            <img
              src={url}
              alt={name || 'Adjunto'}
              className="rc-viewer-img"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain', // se ajusta sin salirse del modal
                display: 'block',
              }}
            />
          ) : (
            <div className="rc-empty" style={{ color: '#fff', padding: 24 }}>
              No se puede previsualizar este tipo de archivo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
