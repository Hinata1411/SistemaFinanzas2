// src/components/registrar-cierre/GastosList.jsx
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { n, toMoney } from '../../utils/numbers';
import AttachmentViewerModal from './AttachmentViewerModal';

/* Iconos */
const ICONS = {
  attach: '/img/camara.png',
  view: '/img/img.png',
};

// Detección simple de móvil
const isMobileUA = () =>
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

export default function GastosList({
  gastos,
  categorias = [],
  setGasto,
  addGasto,
  removeGasto,
  onUseCajaChica,
  activeSucursalNombre,
  cajaChicaDisponible,
  faltantePorGastos,
  readOnly = false,
  isAdmin = false,

  // Caja chica
  cajaChicaUsada = 0,
  onRemoveCajaChica = () => {},
}) {
  const showCajaChicaBtn = !readOnly && Number(faltantePorGastos) > 0;

  const [viewer, setViewer] = useState({ open: false, url: '', mime: '', name: '', rowIndex: -1 });
  const openViewer = ({ url, mime, name, rowIndex }) =>
    setViewer({ open: true, url, mime: mime || '', name: name || '', rowIndex });
  const closeViewer = () => setViewer({ open: false, url: '', mime: '', name: '', rowIndex: -1 });

  const handleEnterConfirm = async (idx, e) => {
    if (readOnly || e.key !== 'Enter') return;
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
      e.currentTarget?.blur?.();
    }
  };

  // Abrir selector (cámara o galería en móvil; galería en desktop)
  const handlePickFile = async (i) => {
    if (readOnly) return;

    if (isMobileUA()) {
      const res = await Swal.fire({
        title: 'Agregar imagen',
        text: 'Elige una opción',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Elegir de galería',
        showDenyButton: true,
        denyButtonText: 'Tomar foto',
        reverseButtons: true,
      });

      if (res.isDismissed) return;
      // Deny = Tomar foto (cámara), Confirm = Galería
      if (res.isDenied) {
        document.getElementById(`gasto-file-camera-${i}`)?.click();
      } else if (res.isConfirmed) {
        document.getElementById(`gasto-file-gallery-${i}`)?.click();
      }
    } else {
      // Desktop: ir directo a galería/selector de archivos
      document.getElementById(`gasto-file-gallery-${i}`)?.click();
    }
  };

  const handleFileChange = (i, e) => {
    if (readOnly) return;
    const file = e.target?.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      Swal.fire('Formato no permitido', 'Selecciona una imagen.', 'warning');
      e.target.value = '';
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      Swal.fire('Archivo muy grande', 'Máximo permitido: 8MB', 'warning');
      e.target.value = '';
      return;
    }

    const preview = URL.createObjectURL(file);
    setGasto(i, 'fileBlob', file);
    setGasto(i, 'filePreview', preview);
    setGasto(i, 'fileMime', file.type || '');
    setGasto(i, 'fileName', file.name || '');
    setGasto(i, 'fileUrl', '');

    // Si el visor está abierto sobre esa fila, actualizarlo
    setViewer((v) => (v.open && v.rowIndex === i ? { ...v, url: preview, mime: file.type, name: file.name } : v));
  };

  const clearFile = (i) => {
    setGasto(i, 'fileBlob', null);
    setGasto(i, 'filePreview', '');
    setGasto(i, 'fileMime', '');
    setGasto(i, 'fileName', '');
    setGasto(i, 'fileUrl', '');
  };

  const totalGastos = (gastos || []).reduce((sum, g) => sum + n(g.cantidad), 0);
  const colCount = isAdmin ? 6 : 5;

 
  const handleModalRemove = () => {
    if (readOnly) return;
    if (viewer.rowIndex < 0) return;
    clearFile(viewer.rowIndex);
    closeViewer();
  };

  const cajaChicaTieneMonto = Number(cajaChicaUsada) > 0;

  return (
    <section className="rc-card">
      <div className="rc-card-hd">
        <h3 style={{ margin: 0 }}>Gastos</h3>

        {showCajaChicaBtn && !cajaChicaTieneMonto && (
          <button
            type="button"
            className="rc-btn rc-btn-primary"
            onClick={onUseCajaChica}
            title={`Disponible en ${activeSucursalNombre || 'sucursal'}: ${toMoney(cajaChicaDisponible)}`}
          >
            Utilizar caja chica
          </button>
        )}
      </div>

      <table className="rc-table rc-gastos-table">
        <colgroup>
          {isAdmin && <col style={{ width: '200px' }} />}
          <col style={{ width: '240px' }} />
          <col style={{ width: '200px' }} />
          <col style={{ width: '200px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '120px' }} />
        </colgroup>

        <thead>
          <tr>
            {isAdmin && <th style={{ textAlign: 'center' }}>Categoría</th>}
            <th style={{ textAlign: 'center' }}>Descripción</th>
            <th style={{ textAlign: 'center' }}>Cantidad</th>
            <th style={{ textAlign: 'center' }}>No. de ref</th>
            <th style={{ textAlign: 'center' }}>Comprobante</th>
            <th style={{ textAlign: 'center' }}>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {gastos.length === 0 && (
            <tr>
              <td colSpan={colCount} className="rc-empty">Sin gastos aún.</td>
            </tr>
          )}

          {gastos.map((g, i) => {
            const locked = !!g.locked;
            const disabled = readOnly || locked;
            const canEdit = !readOnly && !locked;
            const viewUrl = g.filePreview || g.fileUrl || g.fileURL || g.comprobanteUrl || '';
            const hasFile = !!viewUrl;

            return (
              <tr key={i}>
                {isAdmin && (
                  <td data-label="Categoría">
                    <select
                      className="rc-input rc-select"
                      value={g.categoria}
                      onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                      disabled={disabled}
                      aria-label="Categoría"
                    >
                      {categorias.length === 0 && <option value="">Sin categorías</option>}
                      {categorias.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                )}

                <td data-label="Descripción">
                  <input
                    className="rc-input rc-desc"
                    placeholder="Descripción"
                    value={g.descripcion}
                    onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
                    onKeyDown={(e) => handleEnterConfirm(i, e)}
                    disabled={disabled}
                    aria-label="Descripción"
                  />
                </td>

                <td data-label="Cantidad">
                  <input
                    className="rc-input rc-qty no-spin"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={g.cantidad ?? ''}
                    onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                    onKeyDown={(e) => handleEnterConfirm(i, e)}
                    onWheel={(e) => e.currentTarget.blur()}
                    disabled={disabled}
                    aria-label="Cantidad"
                  />
                </td>

                <td data-label="No. de ref">
                  <input
                    className="rc-input"
                    placeholder="Ref"
                    value={g.ref || ''}
                    onChange={(e) => setGasto(i, 'ref', e.target.value)}
                    onKeyDown={(e) => handleEnterConfirm(i, e)}
                    disabled={disabled}
                    aria-label="Referencia"
                  />
                </td>

                <td data-label="Comprobante" style={{ textAlign: 'center' }}>
                  <div className="rc-proof-cell">
                    {hasFile ? (
                      <button
                        type="button"
                        className="rc-iconbtn"
                        onClick={() =>
                          openViewer({
                            url: viewUrl,
                            mime: g.fileMime || '',
                            name: g.fileName || '',
                            rowIndex: i,
                          })
                        }
                        title="Abrir comprobante"
                        disabled={false}
                      >
                        <img src={ICONS.view} alt="Ver" width={25} height={25} />
                      </button>
                    ) : (
                      canEdit && (
                        <button
                          type="button"
                          className="rc-iconbtn"
                          onClick={() => handlePickFile(i)}
                          title="Adjuntar imagen"
                        >
                          <img src={ICONS.attach} alt="Adjuntar" width={25} height={25} />
                        </button>
                      )
                    )}

                    {/* Inputs ocultos:
                        - cámara (móvil) -> capture="environment"
                        - galería (móvil/desktop) */}
                    <input
                      id={`gasto-file-camera-${i}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange(i, e)}
                      style={{ display: 'none' }}
                    />
                    <input
                      id={`gasto-file-gallery-${i}`}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(i, e)}
                      style={{ display: 'none' }}
                    />
                  </div>
                </td>

                <td data-label="Acciones" style={{ textAlign: 'center' }}>
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
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="rc-gastos-total">
            {isAdmin && <td />}
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
              Total de gastos
            </td>
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
              {toMoney(totalGastos)}
            </td>
            <td />
            <td />
            <td />
          </tr>

          {/* Fila Caja Chica usada: texto en "No. de ref" y monto en "Comprobante" */}
          {cajaChicaTieneMonto && (
            <tr className="rc-cajachica-row">
              {isAdmin && <td />}{/* Categoría */}
              <td />{/* Descripción */}
              <td />{/* Cantidad */}
              <td style={{ textAlign: 'left', fontWeight: 600 }}>
                Caja chica usada
              </td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                {toMoney(cajaChicaUsada)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <div className="rc-inline-actions" style={{ display: 'inline-flex', gap: 8 }}>
                  <button
                    type="button"
                    className="rc-btn rc-btn-ghost"
                    onClick={onRemoveCajaChica}
                    title="Quitar caja chica"
                  >
                    ✕
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {!readOnly && (
        <div className="rc-gastos-actions" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="rc-btn rc-btn-outline"
            onClick={addGasto}
          >
            + Agregar gasto
          </button>
        </div>
      )}

     <AttachmentViewerModal
      open={viewer.open}
      url={viewer.url}
      mime={viewer.mime}
      name={viewer.name}
      onClose={closeViewer}
      onChangeFile={() => handlePickFile(viewer.rowIndex)} // desktop
      onRemoveFile={handleModalRemove}
      isMobile={/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}
      onPick={(mode) => {
        const idx = viewer.rowIndex;
        const inputId = mode === 'camera'
          ? `gasto-file-camera-${idx}`
          : `gasto-file-gallery-${idx}`;
        document.getElementById(inputId)?.click();
      }}
    />

    </section>
  );
}
