// src/components/registrar-cierre/GastosList.jsx
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { n, toMoney } from '../../utils/numbers';
import AttachmentViewerModal from './AttachmentViewerModal';

/* Ícono cámara/foto */
const IcoPhoto = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/* Ícono PDF */
const IcoPdf = ({ size = 18, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', ...style }} xmlns="http://www.w3.org/2000/svg">
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
  showCategoriasBtn = true,
  onUseCajaChica,
  activeSucursalNombre,
  cajaChicaDisponible,
  faltantePorGastos,
  readOnly = false,
}) {
  const showCajaChicaBtn = !readOnly && Number(faltantePorGastos) > 0;

  // Visor
  const [viewer, setViewer] = useState({ open: false, url: '', mime: '', name: '' });
  const openViewer = (url, mime, name) => setViewer({ open: true, url, mime: mime || '', name: name || '' });
  const closeViewer = () => setViewer({ open: false, url: '', mime: '', name: '' });

  // Confirmar con Enter y bloquear fila
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
      if (e.currentTarget?.blur) e.currentTarget.blur();
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

  const clearFile = (i) => {
    setGasto(i, 'fileBlob', null);
    setGasto(i, 'filePreview', '');
    setGasto(i, 'fileMime', '');
    setGasto(i, 'fileName', '');
    setGasto(i, 'fileUrl', '');
  };

  // ⬇️ Total de gastos (se recalcula en render)
  const totalGastos = (gastos || []).reduce((sum, g) => sum + n(g.cantidad), 0);

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

        {showCategoriasBtn && (
          <button
            type="button"
            className="rc-btn rc-btn-outline"
            onClick={onOpenCategorias}
            disabled={readOnly}
          >
            Categorías
          </button>
        )}
      </div>

      {/* ===== Tabla de gastos ===== */}
      <table className="rc-table rc-gastos-table">
        {/* prettier-ignore */}
        <colgroup>
          <col style={{width:'200px'}}/>
          <col style={{width:'auto'}}/>
          <col style={{width:'120px'}}/>
          <col style={{width:'120px'}}/>
          <col style={{width:'180px'}}/>{/* Comprobante */}
          <col style={{width:'120px'}}/>{/* Acciones */}
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'center' }}>Categoría</th>
            <th style={{ textAlign: 'center' }}>Descripción</th>
            <th style={{ textAlign: 'center' }}>No. de ref</th>
            <th style={{ textAlign: 'center' }}>Cantidad</th>
            <th style={{ textAlign: 'center' }}>Comprobante</th>
            <th style={{ textAlign: 'center' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {gastos.length === 0 && (
            <tr>
              <td colSpan={6} className="rc-empty">Sin gastos aún.</td>
            </tr>
          )}

          {gastos.map((g, i) => {
            const locked = !!g.locked;
            const disabled = readOnly || locked;

            const hasFile = !!(g.filePreview || g.fileUrl);
            const isPdf = (g.fileMime || '').includes('pdf');

            return (
              <tr key={i}>
                {/* Categoría */}
                <td data-label="Categoría">
                  <select
                    className="rc-input rc-select"
                    value={g.categoria}
                    onChange={(e) => setGasto(i, 'categoria', e.target.value)}
                    disabled={disabled}
                    aria-label="Categoría"
                  >
                    {categorias.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </td>

                {/* Descripción */}
                <td data-label="Descripción">
                  <input
                    className="rc-input rc-desc"
                    placeholder="Descripción"
                    value={g.descripcion}
                    onChange={(e) => setGasto(i, 'descripcion', e.target.value)}
                    onKeyDown={(e) => handleEnterConfirm(i, e)}
                    disabled={disabled}
                    aria-label="Descripción"
                    style={{ width: '100%' }}
                  />
                </td>

                {/* Ref */}
                <td data-label="No. de ref">
                  <input
                    className="rc-input"
                    placeholder="Ref"
                    value={g.ref || ''}
                    onChange={(e) => setGasto(i, 'ref', e.target.value)}
                    onKeyDown={(e) => handleEnterConfirm(i, e)}
                    disabled={disabled}
                    aria-label="Referencia"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </td>

                {/* Cantidad (sin flechas/rueda) */}
                <td data-label="Cantidad">
                  <input
                    className="rc-input rc-qty no-spin"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={g.cantidad ?? ''}
                    onChange={(e) => setGasto(i, 'cantidad', e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'ArrowUp' ||
                        e.key === 'ArrowDown' ||
                        e.key === 'PageUp' ||
                        e.key === 'PageDown'
                      ) {
                        e.preventDefault();
                        return;
                      }
                      handleEnterConfirm(i, e);
                    }}
                    onWheel={(e) => { e.currentTarget.blur(); }}
                    disabled={disabled}
                    aria-label="Cantidad"
                    style={{ width: '100%', textAlign: 'center' }}
                  />
                </td>

                {/* Comprobante */}
                <td data-label="Comprobante" style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                    {hasFile ? (
                      <>
                        <button
                          type="button"
                          className="rc-btn rc-btn-outline"
                          onClick={() => openViewer(g.filePreview || g.fileUrl, g.fileMime, g.fileName)}
                          title="Ver comprobante"
                        >
                          {isPdf ? <IcoPdf /> : <IcoPhoto />}
                        </button>
                        {!disabled && (
                          <button
                            type="button"
                            className="rc-btn rc-btn-outline"
                            onClick={() => handlePickFile(i)}
                          >
                            Cambiar
                          </button>
                        )}
                        {!disabled && (
                          <button
                            type="button"
                            className="rc-btn rc-btn-ghost"
                            onClick={() => clearFile(i)}
                            title="Quitar archivo"
                          >
                            Quitar
                          </button>
                        )}
                      </>
                    ) : (
                      !disabled && (
                        <button
                          type="button"
                          className="rc-btn rc-btn-outline"
                          onClick={() => handlePickFile(i)}
                        >
                          Adjuntar
                        </button>
                      )
                    )}

                    {/* Input oculto */}
                    <input
                      id={`gasto-file-${i}`}
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      onChange={(e) => handleFileChange(i, e)}
                      style={{ display: 'none' }}
                    />
                  </div>
                </td>

                {/* Acciones */}
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
                      style={{ marginLeft: 6 }}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Total de gastos */}
        <tfoot>
          <tr className="rc-gastos-total">
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
              Total de gastos
            </td>
            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--dark)' }}>
              {toMoney(totalGastos)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      {/* Acciones de lista */}
      {!readOnly && (
        <div className="rc-gastos-actions" style={{ marginTop: 10 }}>
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
