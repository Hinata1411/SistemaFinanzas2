// src/components/registrar-cierre/AttachmentViewerModal.jsx
import React, { useEffect, useState, useRef } from 'react';

export default function AttachmentViewerModal({
  open,
  url,
  mime,
  name,
  onClose,
  onChangeFile,   // Desktop/fallback: abrir file picker normal
  onRemoveFile,   // Quitar archivo
  // Opcionales para móvil:
  isMobile = false,
  // onPick('camera' | 'gallery') -> tú disparas el input correcto en la fila
  onPick = null,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const cardRef = useRef(null);

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

  // Imagen?
  const isImage =
    (mime && mime.startsWith('image/')) ||
    /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || '');

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
        zIndex: 9999,
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
            {/* Cambiar */}
            {onChangeFile && (
              <button
                type="button"
                className="rc-btn rc-btn-outline"
                onClick={() => {
                  if (isMobile && typeof onPick === 'function') {
                    // En móvil abrimos el menú inline (arriba de la imagen)
                    setShowPicker((s) => !s);
                  } else {
                    // Desktop = comportamiento actual
                    onChangeFile();
                  }
                }}
              >
                Cambiar
              </button>
            )}

            {/* Quitar */}
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

            {/* Cerrar */}
            <button className="rc-btn rc-btn-primary" onClick={() => { setShowPicker(false); onClose?.(); }}>
              Cerrar
            </button>
          </div>
        </div>

        {/* Action sheet inline (solo si móvil) */}
        {isMobile && typeof onPick === 'function' && showPicker && (
          <div
            style={{
              position: 'absolute',
              top: 48,            // debajo del header
              right: 12,
              zIndex: 5,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              padding: 8,
              display: 'grid',
              gap: 6,
              minWidth: 190,
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
          </div>
        )}

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
    </div>
  );
}
