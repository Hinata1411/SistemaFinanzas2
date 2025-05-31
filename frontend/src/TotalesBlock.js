// src/TotalesBlock.jsx
import React, { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const TotalesBlock = forwardRef(
  (
    {
      arqueoData = [],
      cierreData = [],
      gastosData = [],
      sumDifEfectivo = 0,
      sucursalId,
      balanceCajaChica = 0,
      onCoverWithCajaChica,
      inicialComentario = '',
      readonly = false
    },
    ref
  ) => {
    const [comentario, setComentario] = useState(inicialComentario);
    const [yaCubierto, setYaCubierto] = useState(false);
    const [montoPagar, setMontoPagar] = useState('');

    useEffect(() => {
      setComentario(inicialComentario);
    }, [inicialComentario]);

    const sumField = (arr, field) =>
      arr.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);

    // ==== ARQUEO FÍSICO MODIFICADO ====
    const efectivoArqueo = sumField(arqueoData, 'efectivo');
    const motoristaArqueo = sumField(arqueoData, 'motorista');
    const tarjetaArqueo = sumField(arqueoData, 'tarjeta');
    const datosAperturaArqueo = sumField(cierreData, 'apertura');
    const totalEfectivoArqueo = efectivoArqueo - datosAperturaArqueo;

    // ==== CIERRE DE SISTEMA MODIFICADO ====
    const totalEfectivoCierre = sumField(cierreData, 'efectivo');
    const totalTarjetaCierre = sumField(cierreData, 'tarjeta');
    const totalMotoristaCierre = sumField(cierreData, 'motorista');
    const aperturaCierre = sumField(cierreData, 'apertura');
    const totalCierreSistema = totalEfectivoCierre + totalTarjetaCierre - aperturaCierre;

    // ==== GASTOS (solo total) ====
    const totalGastos = gastosData.reduce(
      (sum, g) => sum + (parseFloat(g.cantidad) || 0),
      0
    );

    // ==== DIFERENCIA DE EFECTIVO (Total a depositar − Total Sistema) ====
    const diferenciaEfectivo = totalEfectivoArqueo - totalCierreSistema;

    // Si gastaste más que lo a depositar, prellenar montoPagar = totalGastos − totalEfectivoArqueo
    useEffect(() => {
      if (!readonly && totalGastos > totalEfectivoArqueo && !yaCubierto) {
        const faltanteGastos = totalGastos - totalEfectivoArqueo;
        setMontoPagar(faltanteGastos.toFixed(2));
      }
    }, [totalGastos, totalEfectivoArqueo, readonly, yaCubierto]);

    useImperativeHandle(
      ref,
      () => ({
        getData: () => ({
          comentario
        })
      }),
      [comentario]
    );

    const handleCoverClick = async () => {
      const faltante = parseFloat(montoPagar);
      if (isNaN(faltante) || faltante <= 0) {
        Swal.fire('Cantidad inválida', 'Ingresa un monto válido.', 'warning');
        return;
      }
      if (balanceCajaChica < faltante) {
        Swal.fire(
          'Saldo insuficiente',
          `No tienes suficiente caja chica (Q${balanceCajaChica.toFixed(
            2
          )}) para cubrir Q${faltante.toFixed(2)}.`,
          'warning'
        );
        return;
      }
      await onCoverWithCajaChica(faltante);
      setYaCubierto(true);
      Swal.fire(
        'Hecho',
        `Faltante de gastos cubierto con Caja Chica Q${faltante.toFixed(2)}`,
        'success'
      );
      setMontoPagar('');
    };

    // ==== NUEVO: Total a depositar tras gastos ====
    const totalDespuesGastos = totalEfectivoArqueo - totalGastos;

    return (
      <div
        className="totales-block"
        style={{
          border: '1px solid #ddd',
          padding: '1rem',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        {/* === Primera fila: Arqueo Físico (izq) & Cierre de Sistema (der) === */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Arqueo Físico */}
          <div
            className="totales-arqueo"
            style={{
              flex: 1,
              background: '#f9f9f9',
              padding: '0.75rem',
              borderRadius: '4px'
            }}
          >
            <h4>Arqueo Físico</h4>
            <p>
              <strong>Efectivo (Sum. cajas):</strong> Q{efectivoArqueo.toFixed(2)}
            </p>
            <p>
              <strong>Motorista (Sum. cajas):</strong> Q{motoristaArqueo.toFixed(2)}
            </p>
            <p>
              <strong>Tarjeta (Sum. cajas):</strong> Q{tarjetaArqueo.toFixed(2)}
            </p>
            <p>
              <strong>Apertura de cajas:</strong> Q{datosAperturaArqueo.toFixed(2)}
            </p>
            <p>
              <strong>Total Efectivo:</strong> Q{totalEfectivoArqueo.toFixed(2)}
            </p>
            <div
              style={{
                marginTop: '0.5rem',
                borderTop: '1px solid #ccc',
                paddingTop: '0.5rem'
              }}
            >
              <p>
                <strong>Saldo Caja Chica:</strong>{' '}
                <span style={{ color: balanceCajaChica < 0 ? 'red' : 'green' }}>
                  Q{balanceCajaChica.toFixed(2)}
                </span>
              </p>
            </div>
          </div>

          {/* Cierre de Sistema */}
          <div
            className="totales-cierre"
            style={{
              flex: 1,
              background: '#f9f9f9',
              padding: '0.75rem',
              borderRadius: '4px'
            }}
          >
            <h4>Cierre de Sistema</h4>
            <p>
              <strong>Efectivo:</strong> Q{totalEfectivoCierre.toFixed(2)}
            </p>
            <p>
              <strong>Tarjeta:</strong> Q{totalTarjetaCierre.toFixed(2)}
            </p>
            <p>
              <strong>Motorista:</strong> Q{totalMotoristaCierre.toFixed(2)}
            </p>
            <p>
              <strong>Apertura de cajas:</strong> Q{aperturaCierre.toFixed(2)}
            </p>
            <p>
              <strong>Total Sistema:</strong> Q{totalCierreSistema.toFixed(2)}
            </p>
          </div>
        </div>

        {/* === Segunda fila: Total Gastos (izq) & Diferencia de Efectivo (der) === */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Total Gastos */}
          <div
            className="totales-gastos"
            style={{
              flex: 1,
              background: '#f9f9f9',
              padding: '0.75rem',
              borderRadius: '4px'
            }}
          >
            <h4>Total Gastos</h4>
            <p style={{ fontSize: '0.9rem' }}>
              <strong>Q{totalGastos.toFixed(2)}</strong>
            </p>

            {/* === NUEVO: Total a depositar tras gastos === */}
            <p style={{ marginTop: '0.5rem', fontSize: '1.1rem' }}>
              <strong>Total a depositar:</strong> Q{totalDespuesGastos.toFixed(2)}
            </p>

            {/* Si los gastos exceden el total a depositar, mostrar botón para cubrir */}
            {!readonly && totalGastos > totalEfectivoArqueo && !yaCubierto && (
              <div style={{ marginTop: '0.5rem' }}>
                <label htmlFor="monto-pagar">
                  <strong>Pagar Faltante con Caja Chica:</strong>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    id="monto-pagar"
                    type="number"
                    placeholder="Q"
                    value={montoPagar}
                    onChange={(e) => setMontoPagar(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.25rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                  />
                  <button
                    onClick={handleCoverClick}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: '#d9534f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Pagar Faltante
                  </button>
                </div>
              </div>
            )}
            {!readonly && totalGastos > totalEfectivoArqueo && yaCubierto && (
              <p style={{ marginTop: '0.5rem', color: 'green', fontWeight: 'bold' }}>
                Faltante de gastos cubierto con Caja Chica Q
                {(totalGastos - totalEfectivoArqueo).toFixed(2)}
              </p>
            )}
          </div>

          {/* Diferencia de Efectivo */}
          <div
            className="totales-diferencia"
            style={{
              flex: 1,
              background: '#f1f1f1',
              padding: '0.75rem',
              borderRadius: '4px'
            }}
          >
            <h4>Diferencia de Efectivo</h4>
            <p>
              <strong
                style={{ color: diferenciaEfectivo < 0 ? 'red' : 'green' }}
              >
                {diferenciaEfectivo >= 0 ? 'Sobrante:' : 'Faltante:'}
              </strong>{' '}
              Q{Math.abs(diferenciaEfectivo).toFixed(2)}
            </p>

            {/* Si hay faltante en efectivo, mostrar campo para pagar */}
            {!readonly && diferenciaEfectivo < 0 && !yaCubierto && (
              <div style={{ marginTop: '0.5rem' }}>
                <label htmlFor="monto-pagar-dif">
                  <strong>Pagar Faltante con Caja Chica:</strong>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <input
                    id="monto-pagar-dif"
                    type="number"
                    placeholder="Q"
                    value={montoPagar}
                    onChange={(e) => setMontoPagar(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.25rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                  />
                  <button
                    onClick={handleCoverClick}
                    style={{
                      padding: '0.4rem 0.8rem',
                      backgroundColor: '#d9534f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Pagar Faltante
                  </button>
                </div>
              </div>
            )}

            {!readonly && diferenciaEfectivo < 0 && yaCubierto && (
              <p style={{ marginTop: '0.5rem', color: 'green', fontWeight: 'bold' }}>
                Faltante de efectivo cubierto con Caja Chica Q
                {Math.abs(diferenciaEfectivo).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {/* === Comentario (ancho completo) === */}
        <div
          className="totales-comentario"
          style={{
            marginTop: '1rem',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <label htmlFor="comentario">
            <strong>Comentario:</strong>
          </label>
          <textarea
            id="comentario"
            value={comentario}
            disabled={readonly}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Escribe aquí tu comentario…"
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              resize: 'vertical'
            }}
          />
        </div>
      </div>
    );
  }
);

export default TotalesBlock;
