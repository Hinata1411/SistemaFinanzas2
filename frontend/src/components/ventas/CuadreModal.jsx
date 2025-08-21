import React, { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import { db } from '../../firebase';

// Reutilizados de RegistrarCierre
import ArqueoGrid from '../registrar-cierre/ArqueoGrid';
import CierreGrid from '../registrar-cierre/CierreGrid';
import GastosList from '../registrar-cierre/GastosList';
import CajaChicaModal from '../registrar-cierre/CajaChicaModal';
import CategoriasModal from '../registrar-cierre/CategoriasModal';

// estilos del registrar cierre para look&feel
import '../registrar-cierre/RegistrarCierre.css';

// ===== Helpers seguros =====
const n = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const totalEfectivoCaja = (c = {}) =>
  n(c.q100) + n(c.q50) + n(c.q20) + n(c.q10) + n(c.q5) + n(c.q1);

const ensureArray = (val) => (Array.isArray(val) ? val : []);
const ensure3 = (arr) => {
  const base = ensureArray(arr).slice(0, 3);
  while (base.length < 3) base.push({});
  return base;
};

export default function CuadreModal({
  open,
  onClose,
  cuadre,
  sucursalNombre,
  cajaChicaDisponible = 0,
  mode = 'view',
  onSaved,
}) {
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  // Estado editable (SIEMPRE seguro)
  const [arqueo, setArqueo] = useState(ensure3(cuadre?.arqueo));
  const [cierre, setCierre] = useState(ensure3(cuadre?.cierre));
  const [gastos, setGastos] = useState(ensureArray(cuadre?.gastos));
  const [comentario, setComentario] = useState(cuadre?.comentario || '');
  const [categorias, setCategorias] = useState(
    Array.isArray(cuadre?.categorias) && cuadre.categorias.length
      ? cuadre.categorias
      : ['Varios', 'Coca-cola', 'Servicios', 'Publicidad', 'Gas y gasolina', 'Transporte', 'Mantenimiento']
  );
  const [cajaChicaUsada, setCajaChicaUsada] = useState(n(cuadre?.cajaChicaUsada));
  const [faltantePagado, setFaltantePagado] = useState(n(cuadre?.faltantePagado));

  // Modales secundarios
  const [showCajaChica, setShowCajaChica] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);

  // Reset cuando abre/cambia el cuadre
  useEffect(() => {
    if (!open) return;
    setIsEditing(mode === 'edit');
    setArqueo(ensure3(cuadre?.arqueo));
    setCierre(ensure3(cuadre?.cierre));
    setGastos(ensureArray(cuadre?.gastos));
    setComentario(cuadre?.comentario || '');
    setCategorias(
      Array.isArray(cuadre?.categorias) && cuadre.categorias.length
        ? cuadre.categorias
        : ['Varios', 'Coca-cola', 'Servicios', 'Publicidad', 'Gas y gasolina', 'Transporte', 'Mantenimiento']
    );
    setCajaChicaUsada(n(cuadre?.cajaChicaUsada));
    setFaltantePagado(n(cuadre?.faltantePagado)); // <-- typo FIX
  }, [open, cuadre, mode]);

  // ===== Cálculos =====
  const totalArqueoEfectivo = useMemo(
    () => (arqueo || []).reduce((acc, c) => acc + totalEfectivoCaja(c), 0),
    [arqueo]
  );
  const totalArqueoTarjeta = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.tarjeta), 0),
    [arqueo]
  );
  const totalArqueoMotorista = useMemo(
    () => (arqueo || []).reduce((s, c) => s + n(c.motorista), 0),
    [arqueo]
  );

  const totalCierreEfectivo = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.efectivo), 0),
    [cierre]
  );
  const totalCierreTarjeta = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.tarjeta), 0),
    [cierre]
  );
  const totalCierreMotorista = useMemo(
    () => (cierre || []).reduce((s, c) => s + n(c.motorista), 0),
    [cierre]
  );

  const totalGastos = useMemo(
    () => (gastos || []).reduce((s, g) => s + n(g.cantidad), 0),
    [gastos]
  );

  // total a depositar (regla acordada)
  const totalGeneral = useMemo(
    () => totalArqueoEfectivo - totalGastos + n(cajaChicaUsada) + n(faltantePagado),
    [totalArqueoEfectivo, totalGastos, cajaChicaUsada, faltantePagado]
  );
  const isDepositNegative = totalGeneral < 0;

  // diferencia efectivo (control admin - sistema)
  const diferenciaEfectivo = useMemo(
    () => totalArqueoEfectivo - totalCierreEfectivo,
    [totalArqueoEfectivo, totalCierreEfectivo]
  );
  const diffEsPositivo = diferenciaEfectivo >= 0;
  const diffLabel = diffEsPositivo ? 'Sobrante' : 'Faltante';
  const diffAbs = Math.abs(diferenciaEfectivo);
  const faltanteEfectivo = Math.max(0, -diferenciaEfectivo);

  // faltante por gastos (para caja chica)
  const faltantePorGastos = useMemo(() => {
    const diff = totalGastos - totalArqueoEfectivo - n(cajaChicaUsada);
    return diff > 0 ? diff : 0;
  }, [totalGastos, totalArqueoEfectivo, cajaChicaUsada]);
  const showCajaChicaBtn = faltantePorGastos > 0;

  // ===== Acciones =====
  const handlePagarFaltante = async () => {
    if (faltanteEfectivo <= 0) return;
    const confirmar = await Swal.fire({
      title: 'Pagar faltante',
      text: `Se sumará Q ${faltanteEfectivo.toFixed(2)} al depósito.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, pagar',
      cancelButtonText: 'Cancelar',
    });
    if (confirmar.isConfirmed) {
      setFaltantePagado(faltanteEfectivo);
      Swal.fire({
        icon: 'success',
        title: 'Faltante pagado',
        text: `Se agregó Q ${faltanteEfectivo.toFixed(2)} al total a depositar.`,
        timer: 1400,
        showConfirmButton: false,
      });
    }
  };

  const handleSave = async () => {
    const boxesOk = [...ensure3(arqueo), ...ensure3(cierre)].every((b = {}) =>
      [
        'efectivo',
        'tarjeta',
        'motorista',
        'q100',
        'q50',
        'q20',
        'q10',
        'q5',
        'q1',
      ].every((f) => b[f] === undefined || b[f] === '' || !isNaN(parseFloat(b[f])))
    );
    const gastosOk = ensureArray(gastos).every((g) => g && !isNaN(parseFloat(g.cantidad)));
    if (!boxesOk || !gastosOk) {
      Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
      return;
    }

    try {
      await updateDoc(doc(db, 'cierres', cuadre.id), {
        arqueo: ensure3(arqueo),
        cierre: ensure3(cierre),
        gastos: ensureArray(gastos),
        comentario,
        categorias,
        cajaChicaUsada: n(cajaChicaUsada),
        faltantePagado: n(faltantePagado),
      });
      Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        text: 'Los cambios se guardaron correctamente.',
        timer: 1600,
        showConfirmButton: false,
      });
      onSaved?.({
        arqueo: ensure3(arqueo),
        cierre: ensure3(cierre),
        gastos: ensureArray(gastos),
        comentario,
        categorias,
        cajaChicaUsada: n(cajaChicaUsada),
        faltantePagado: n(faltantePagado),
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', err.message || 'No se pudo actualizar.', 'error');
    }
  };

  if (!open) return null;

  // Copias seguras para pasar a los hijos
  const arqueoSafe = ensure3(arqueo);
  const cierreSafe = ensure3(cierre);
  const gastosSafe = ensureArray(gastos);

  return (
    <div className="rc-modal-mask" role="dialog" aria-modal="true">
      <div className="rc-modal-card" style={{ maxWidth: 1100, width: '95vw' }}>
        <div className="rc-modal-hd">
          <h4>
            {isEditing ? 'Editar cuadre' : 'Detalle del cuadre'} — {sucursalNombre || 'Sucursal'} — {cuadre?.fecha || '-'}
          </h4>
          <div className="rc-modal-actions">
            {isEditing ? (
              <>
                <button className="rc-btn rc-btn-primary" onClick={handleSave}>Guardar</button>
                <button className="rc-btn" onClick={() => setIsEditing(false)}>Cancelar</button>
              </>
            ) : (
              <button className="rc-btn" onClick={() => setIsEditing(true)}>Editar</button>
            )}
            <button className="rc-btn rc-btn-outline" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div className="rc-modal-body">
          <div className="rc-grid">
            <section className="rc-card">
              <h3>Arqueo Físico</h3>
              <ArqueoGrid value={arqueoSafe} onChange={setArqueo} readOnly={!isEditing} />
            </section>

            <section className="rc-card">
              <h3>Cierre de Sistema</h3>
              <CierreGrid value={cierreSafe} onChange={setCierre} readOnly={!isEditing} />
            </section>
          </div>

          <div className="rc-grid rc-grid-bottom">
            <section className="rc-card">
              <div className="rc-card-hd">
                <h3>Gastos</h3>
                <button type="button" className="rc-btn rc-btn-outline" onClick={() => setShowCategorias(true)}>
                  Categorías
                </button>
              </div>
              <GastosList
                value={gastosSafe}
                onChange={setGastos}
                categorias={categorias}
                readOnly={!isEditing}
              />
            </section>

            <section className="rc-card">
              <h3>Resumen</h3>

              <div className="rc-resumen-grid">
                <div className="rc-res-col">
                  <div className="rc-res-title">Ventas Total Sistema</div>
                  <div className="rc-res-item"><span>Efectivo</span><b>Q {totalCierreEfectivo.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>Tarjeta</span><b>Q {totalCierreTarjeta.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>A domicilio</span><b>Q {totalCierreMotorista.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>Caja chica (usada)</span><b>Q {n(cajaChicaUsada).toFixed(2)}</b></div>

                  <div className={`rc-res-item ${diferenciaEfectivo >= 0 ? 'ok' : 'bad'}`}>
                    <span>{diffLabel}</span><b>Q {diffAbs.toFixed(2)}</b>
                  </div>

                  {faltanteEfectivo > 0 && n(faltantePagado) === 0 && (
                    <div className="rc-res-item">
                      <button className="rc-btn rc-btn-primary" onClick={handlePagarFaltante}>
                        Pagar faltante (Q {faltanteEfectivo.toFixed(2)})
                      </button>
                    </div>
                  )}
                  {n(faltantePagado) > 0 && (
                    <div className="rc-res-item ok">
                      <span>Faltante pagado</span><b>Q {n(faltantePagado).toFixed(2)}</b>
                    </div>
                  )}
                </div>

                <div className="rc-res-col">
                  <div className="rc-res-title">Control Administración</div>
                  <div className="rc-res-item"><span>Efectivo</span><b>Q {totalArqueoEfectivo.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>Tarjeta</span><b>Q {totalArqueoTarjeta.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>A domicilio</span><b>Q {totalArqueoMotorista.toFixed(2)}</b></div>
                  <div className="rc-res-item"><span>Gastos</span><b>Q {totalGastos.toFixed(2)}</b></div>

                  {showCajaChicaBtn && (
                    <div className="rc-res-item">
                      <button
                        type="button"
                        className="rc-btn rc-btn-outline"
                        onClick={() => setShowCajaChica(true)}
                        title={`Disponible: Q ${n(cajaChicaDisponible).toFixed(2)}`}
                      >
                        Utilizar caja chica
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className={`rc-total-deposit ${isDepositNegative ? 'bad' : ''}`}>
                <span className="money">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 7h18v10H3V7zm2 2v6h14V9H5zm3 1h4v4H8v-4zM4 6h16V5H4v1z" />
                  </svg>
                  Total a depositar
                </span>
                <b>Q {totalGeneral.toFixed(2)}</b>
              </div>

              <div className="rc-comentario">
                <label htmlFor="rc-com">Comentario</label>
                <textarea
                  id="rc-com"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Agrega un comentario"
                  rows={3}
                  disabled={!isEditing}
                />
              </div>

              {isEditing && (
                <div style={{ textAlign: 'right', marginTop: 12 }}>
                  <button className="rc-btn rc-btn-primary" onClick={handleSave}>
                    Guardar cambios
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Modal Caja Chica */}
      {showCajaChica && (
        <CajaChicaModal
          open={showCajaChica}
          onClose={() => setShowCajaChica(false)}
          disponible={n(cajaChicaDisponible)}
          faltantePorGastos={n(faltantePorGastos)}
          value={n(cajaChicaUsada)}
          onApply={(monto) => {
            setCajaChicaUsada(n(monto));
            setShowCajaChica(false);
          }}
        />
      )}

      {/* Modal Categorías */}
      {showCategorias && (
        <CategoriasModal
          open={showCategorias}
          onClose={() => setShowCategorias(false)}
          categorias={categorias}
          onChange={setCategorias}
        />
      )}
    </div>
  );
}
