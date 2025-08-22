import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { toMoney } from '../../utils/numbers';
import AttachmentViewerModal from './AttachmentViewerModal';

/* Ícono cámara/foto */
const IcoPhoto = ({ size = 18, style = {} }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ display: 'inline-block', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/* Ícono PDF */
const IcoPdf = ({ size = 18, style = {} }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ display: 'inline-block', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M15 2v5h5" stroke="currentColor" strokeWidth="2"/>
    <text x="8" y="18" fontSize="8" fontFamily="sans-serif" fill="currentColor">PDF</text>
  </svg>
);

export default function GastosList({
  gastos,
  categorias,
  setGasto,
  addGasto,
  removeGasto,
  onOpenCategorias,
  // Caja chica
  onUseCajaChica,
  activeSucursalNombre,
  cajaChicaDisponible,
  faltantePorGastos,
  // NUEVO: modo solo lectura (ver)
  readOnly = false,
}) {
  const showCajaChicaBtn = !readOnly && Number(faltantePorGastos) > 0;

  // Estado del visor
  const [viewer, setViewer] = useState({ open: false, url: '', mime: '', name: '' });
  const openViewer = (url, mime, name) =>
    setViewer({ open: true, url, mime: mime || '', name: name || '' });
  const closeViewer = () =>
    setViewer({ open: false, url: '', mime: '', name: '' });

  // Confirmar con Enter y bloquear la fila (no aplica en readOnly)
  const handleEnterConfirm = async (idx, e) => {
    if (readOnly) return;
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const { isConfirmed } = await Swal.fire({
      title: '¿Guardar cambios en gastos?',
      text: 'Se bloqueará la línea editada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      cancelButtonText: 'Cancelar',
    });

    if (isConfirmed) {
      setGasto(idx, 'locked', true);
      await Swal.fire({ icon: 'success', title: 'Guardado', timer: 900, showConfirmButton: false });
      if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
    }
  };

  const handlePickFile = (i) => {
    if (readOnly) return;
    const el = document.getElementById(`gasto-file-${i}`);
    if (el) el.click();
  };

  const handleFileChange = (i, e) => {
    if (readOnly) return;
    const file = e.target?.files?.[0];
    if (!file) return;

    const okTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!okTypes.includes(file.type)) {
      Swal.fire('Formato no permitido', 'Solo se permiten PNG, JPG o PDF.', 'warning');
      e.target.value = '';
      return;
    }

    const maxBytes = 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      Swal.fire('Archivo muy grande', 'Máximo permitido: 8MB', 'warning');
      e.target.value = '';
      return;
    }

    const isImage = file.type.startsWith('image/');
    const preview = isImage ? URL.createObjectURL(file) : '';
    setGasto(i, 'fileBlob', file);
    setGasto(i, 'filePreview', preview);
    setGasto(i, 'fileMime', file.type);
    setGasto(i, 'fileName', file.name);
    setGasto(i, 'fileUrl', '');
  };

  return (
    <section className="rc-card">
      <div className="rc-card-hd" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: '1 1 auto' }}>Gastos</h3>

        {showCajaChicaBtn && (
          <button
            type="button"
            className="rc-btn rc-btn-outline"
            onClick={onUseCajaChica}
            title={`Disponible en ${activeSucursalNombre || 'sucursal'}: ${toMoney(cajaChicaDisponible)}`}
          >
            Utilizar caja chica
          </button>
        )}

        {/* Mostrar "Categorías" solo si NO es solo-lectura */}
        {!readOnly && onOpenCategorias && (
          <button type="button" className="rc-btn rc-btn-outline" onClick={onOpenCategorias}>
            Categorías
          </button>
        )}
      </div>

      <div className="rc-gastos">
        {gastos.map((g, i) => {
          const locked = !!g.locked;
          const disabled = readOnly || locked;

          const hasUrl = !!g.fileUrl;
          const hasPreview = !!g.filePreview;
          const imgUrl = hasPreview ? g.filePreview : hasUrl ? g.fileUrl : '';
          const isImage =
            (g.fileMime && g.fileMime.startsWith('image/')) ||
            /\.(png|jpe?g|webp|gif)(\?|$)/i.test((imgUrl || ''));
          const isPdf =
            g.fileMime === 'application/pdf' || /\.pdf(\?|$)/i.test((g.fileUrl || '').toLowerCase());

          return (
            <div className="rc-gasto-row" key={i} style={{ alignItems: 'center', gap: 8 }}>
              {/* Categoría */}
              <select
                className="rc-input rc-select"
                value={g.categoria}
                onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                disabled={disabled}
                aria-label="Categoría"
              >
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Descripción */}
              <input
                className="rc-input rc-desc"
                placeholder="Descripción"
                value={g.descripcion}
                onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
                onKeyDown={(e) => handleEnterConfirm(i, e)}
                disabled={disabled}
                aria-label="Descripción"
              />

              {/* Número de referencia */}
              <input
                className="rc-input"
                style={{ width: 160 }}
                placeholder="Ref"
                value={g.ref || ''}
                onChange={(e) => setGasto(i, 'ref', e.target.value)}
                onKeyDown={(e) => handleEnterConfirm(i, e)}
                disabled={disabled}
                aria-label="Referencia"
              />

              {/* Cantidad */}
              <input
                className="rc-input rc-qty"
                placeholder="Cantidad"
                inputMode="numeric"
                value={g.cantidad}
                onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                onKeyDown={(e) => handleEnterConfirm(i, e)}
                disabled={disabled}
                aria-label="Cantidad"
              />

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 6 }}>
                {!readOnly && locked && (
                  <button
                    type="button"
                    className="rc-btn rc-btn-outline"
                    onClick={() => setGasto(i, 'locked', false)}
                    title="Editar gasto"
                  >
                    ✎
                  </button>
                )}

                {!readOnly && (
                  <button
                    type="button"
                    className="rc-btn rc-btn-ghost"
                    onClick={() => removeGasto(i)}
                    title="Eliminar gasto"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Acciones de lista */}
      {!readOnly && (
        <div className="rc-gastos-actions">
          <button
            type="button"
            className="rc-btn rc-btn-outline"
            onClick={addGasto}
            title="Agregar un nuevo gasto (bloquea los anteriores)"
          >
            + Agregar gasto
          </button>
        </div>
      )}

      {/* VISOR MODAL */}
      <AttachmentViewerModal
        open={viewer.open}
        url={viewer.url}
        mime={viewer.mime}
        name={viewer.name}
        onClose={closeViewer}
      />
    </section>
  );
}
