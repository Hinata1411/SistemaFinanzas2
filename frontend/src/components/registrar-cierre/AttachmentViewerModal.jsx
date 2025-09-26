// src/components/registrar-cierre/AttachmentViewerModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function AttachmentViewerModal({
  open,
  url,
  mime,
  name,
  onClose,
  onChangeFile,          // desktop/fallback
  onRemoveFile,
  isMobile = false,      // <-- pásalo desde la tabla
  onPick = null,         // <-- onPick('camera'|'gallery')
}) {
  const [showPicker, setShowPicker] = useState(false);
  const cardRef = useRef(null);

  // Bloquear scroll del fondo
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Cerrar con Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isImage =
    (mime && mime.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

  // Posicionar el “action sheet” arriba de la imagen: usamos portal + fixed
  const ActionSheet = showPicker && isMobile && typeof onPick === 'function'
    ? createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,                 // por encima del modal
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 72,                // “arriba” de la imagen
            background: 'rgba(0,0,0,0.12)',// tenue para resaltar
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 14,
              boxShadow: '0 10px 28px rgba(0,0,0,.18)',
              padding: 10,
              width: 280,
              display: 'grid',
              gap: 8,
            }}
          >
            <button
              className="rc-btn rc-btn-outline"
              type="button"
              onClick={() => { setShowPicker(false); onPick('camera'); }}
            >
              Tomar foto
            </button>
            <button
              className="rc-btn rc-btn-outline"
              type="button"
              onClick={() => { setShowPicker(false); onPick('gallery'); }}
            >
              Elegir de galería
            </button>
            <button
              className="rc-btn rc-btn-ghost"
              type="button"
              onClick={() => setShowPicker(false)}
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className="rc-modal-mask"
      role="dialog"
      aria-modal="true"
      onClick={() => { setShowPicker(false); onClose?.(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        ref={cardRef}
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
          position: 'relative',
        }}
      >
        {/* Header */}
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
                onClick={() => {
                  if (isMobile && typeof onPick === 'function') {
                    setShowPicker(true);     // ← muestra menu encima (portal)
                  } else {
                    onChangeFile();          // desktop/fallback
                  }
                }}
              >
                Cambiar
              </button>
            )}
            {onRemoveFile && (
              <button
                type="button"
                className="rc-btn rc-btn-ghost"
                onClick={() => { setShowPicker(false); onRemoveFile(); }}
                title="Quitar archivo"
              >
                Quitar
              </button>
            )}
            <button className="rc-btn rc-btn-primary" onClick={() => { setShowPicker(false); onClose?.(); }}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div
          className="rc-viewer-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflow: 'auto',
            background: '#0b0b0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onScroll={() => showPicker && setShowPicker(false)}
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
                objectFit: 'contain',
                display: 'block',
              }}
              onClick={() => showPicker && setShowPicker(false)}
            />
          ) : (
            <div className="rc-empty" style={{ color: '#fff', padding: 24 }}>
              No se puede previsualizar este tipo de archivo.
            </div>
          )}
        </div>
      </div>

      {/* Portal con el menú flotante */}
      {ActionSheet}
    </div>
  );
}
