// src/RegistrarCierre.jsx

import React, { useState, useRef, useEffect } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  query,
  where,
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import 'sweetalert2/dist/sweetalert2.min.css';

import ArqueoBlock from './ArqueoBlock';
import CierreBlock from './CierreBlock';
import GastosBlock from './GastosBlock';
import DiferenciasTable from './DiferenciasTable';
import TotalesBlock from './TotalesBlock';

import './RegistrarCierre.css';

const todayISO = new Date().toISOString().split('T')[0];

export default function RegistrarCierre() {
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursal, setSelectedSucursal] = useState('');
  const [balanceCajaChica, setBalanceCajaChica] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasSavedClosure, setHasSavedClosure] = useState(false);

  // Estados para los bloques (se actualizan vía onDataChange)
  const [arqueoData, setArqueoData] = useState([{}, {}, {}]);
  const [cierreData, setCierreData] = useState([{}, {}, {}]);
  const [gastosData, setGastosData] = useState([]);

  // Referencias para getData() si el usuario no ha “propagado” el último cambio
  const arqueoRefs = [useRef(), useRef(), useRef()];
  const cierreRefs = [useRef(), useRef(), useRef()];
  const gastosRef = useRef();
  const totalesRef = useRef();

  // -----------------------------------
  //  Función para formatear fechas
  // -----------------------------------
  const formatDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // -----------------------------------
  //  1) Carga inicial de sucursales
  // -----------------------------------
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSucursales(list);
        if (list.length && !selectedSucursal) {
          setSelectedSucursal(list[0].id);
        }
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar sucursales', 'error');
      }
    })();
  }, []);

  // -----------------------------------
  //  2) Cuando cambie la sucursal, obtener SALDO de CAJA CHICA
  // -----------------------------------
  useEffect(() => {
    const fetchCajaChica = async () => {
      if (!selectedSucursal) {
        setBalanceCajaChica(0);
        return;
      }
      try {
        const sucRef = doc(db, 'sucursales', selectedSucursal);
        const snap = await getDoc(sucRef);
        if (snap.exists()) {
          const datos = snap.data();
          setBalanceCajaChica(parseFloat(datos.cajaChica) || 0);
        } else {
          setBalanceCajaChica(0);
        }
      } catch (err) {
        console.error(err);
        setBalanceCajaChica(0);
      }
    };
    fetchCajaChica();
  }, [selectedSucursal]);

  // -----------------------------------
  //  3) Verificar si ya hay un cierre para esta fecha y sucursal
  // -----------------------------------
  useEffect(() => {
    const checkClosure = async () => {
      if (!selectedSucursal) {
        setHasSavedClosure(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'cierres'),
          where('fecha', '==', selectedDate),
          where('sucursalId', '==', selectedSucursal)
        );
        const snap = await getDocs(q);
        setHasSavedClosure(!snap.empty);
      } catch {
        setHasSavedClosure(false);
      }
    };
    checkClosure();
  }, [selectedDate, selectedSucursal]);

  // -----------------------------------
  //  4) Sumar campos numéricos (helper)
  // -----------------------------------
  const sumField = (arr, field) =>
    arr.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);

  // -----------------------------------
  //  5) Calcular diferencia de efectivo
  //     (uso directo en TotalesBlock)
  // -----------------------------------
  const diferenciaEfectivo = () => sumField(cierreData, 'efectivo') - sumField(arqueoData, 'efectivo');

  // -----------------------------------
  //  6) Callbacks para “onDataChange” de cada bloque
  // -----------------------------------

  // Cuando ArqueoBlock notifica un cambio, actualizamos ese índice en arqueoData
  const handleArqueoChange = index => data => {
    setArqueoData(prev => {
      const copy = [...prev];
      copy[index] = data;
      return copy;
    });
  };

  // Cuando CierreBlock notifica un cambio, actualizamos ese índice en cierreData
  const handleCierreChange = index => data => {
    setCierreData(prev => {
      const copy = [...prev];
      copy[index] = data;
      return copy;
    });
  };

  // Cuando GastosBlock notifica un cambio, actualizamos gastosData completo
  const handleGastosChange = data => {
    // data debería tener la forma { title, gastos: [...] }
    setGastosData(data.gastos || []);
  };

  // -----------------------------------
  //  7) Función para “Cubrir con Caja Chica”
  // -----------------------------------
  const handleCoverWithCajaChica = async montoFaltante => {
    if (!selectedSucursal) {
      Swal.fire('Error', 'Primero selecciona una sucursal.', 'warning');
      return;
    }
    try {
      const sucRef = doc(db, 'sucursales', selectedSucursal);
      const snap = await getDoc(sucRef);
      if (!snap.exists()) {
        Swal.fire('Error', 'Sucursal no encontrada.', 'error');
        return;
      }
      const datos = snap.data();
      const saldoActual = parseFloat(datos.cajaChica) || 0;
      if (saldoActual < montoFaltante) {
        Swal.fire(
          'Saldo insuficiente',
          `Tu saldo de caja chica es Q${saldoActual.toFixed(
            2
          )}, no puedes cubrir Q${montoFaltante.toFixed(2)}.`,
          'warning'
        );
        return;
      }
      // Actualizar Firestore restando el faltante
      await updateDoc(sucRef, {
        cajaChica: saldoActual - montoFaltante
      });
      // Actualizar estado local
      setBalanceCajaChica(saldoActual - montoFaltante);

      Swal.fire(
        'Hecho',
        `Q${montoFaltante.toFixed(2)} cubiertos con Caja Chica.`,
        'success'
      );
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo usar caja chica.', 'error');
    }
  };

  // -----------------------------------
  //  8) Guardar el cuadre en Firestore
  // -----------------------------------
  const handleGuardar = async () => {
    if (!auth.currentUser) {
      return Swal.fire('No autenticado', 'Inicia sesión para guardar.', 'warning');
    }
    if (!selectedSucursal) {
      return Swal.fire('Selección requerida', 'Elige una sucursal.', 'warning');
    }

    // Validar que no exista ya un cierre para esta fecha y sucursal
    try {
      const qCheck = query(
        collection(db, 'cierres'),
        where('fecha', '==', selectedDate),
        where('sucursalId', '==', selectedSucursal)
      );
      const snapCheck = await getDocs(qCheck);
      if (!snapCheck.empty) {
        return Swal.fire(
          'Ya existe un cuadre',
          'Solo puedes realizar un cuadre por sucursal por día.',
          'warning'
        );
      }
    } catch {
      return Swal.fire('Error', 'No se pudo verificar cuadres existentes.', 'error');
    }

    // Obtener datos “al momento” de cada ref, por si no se propagó el último cambio
    const arqueo = arqueoRefs.map(r => r.current?.getData() || {});
    const cierre = cierreRefs.map(r => r.current?.getData() || {});
    const gastos = gastosRef.current?.getData()?.gastos || [];

    // Obtener comentario desde TotalesBlock
    const comentario = totalesRef.current?.getData()?.comentario?.trim() || '';

    // Validar datos numéricos
    const validBoxes = [...arqueo, ...cierre].every(b =>
      ['efectivo', 'tarjeta', 'motorista'].every(
        f => b[f] !== undefined && !isNaN(parseFloat(b[f]))
      )
    );
    const validGastos = gastos.every(g => !isNaN(parseFloat(g.cantidad)));

    if (!validBoxes || !validGastos) {
      return Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'cierres'), {
        fecha: selectedDate,
        sucursalId: selectedSucursal,
        arqueo,
        cierre,
        gastos,
        diferenciaEfectivo: diferenciaEfectivo(),
        comentario,
        creado: serverTimestamp(),
        uid: auth.currentUser.uid
      });
      setHasSavedClosure(true);

      // Si hay gastos de “Caja chica”, sumarlos al campo cajaChica de la sucursal
      const totalCajaChica = gastos
        .filter(g => g.categoria === 'Caja chica')
        .reduce((s, g) => s + parseFloat(g.cantidad || 0), 0);
      if (totalCajaChica > 0) {
        const sucRef = doc(db, 'sucursales', selectedSucursal);
        const snapRef = await getDoc(sucRef);
        if (snapRef.exists()) {
          await updateDoc(sucRef, {
            cajaChica: (parseFloat(snapRef.data().cajaChica) || 0) + totalCajaChica
          });
          // Actualizar estado local para ver inmediatamente el nuevo saldo
          setBalanceCajaChica(
            (prev) => prev + totalCajaChica
          );
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: `Cuadre del ${formatDate(selectedDate)} registrado.`,
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------
  //  9) Descargar PDF (igual que antes)
  // -----------------------------------
  const handleDescargarPDF = async () => {
    if (!hasSavedClosure) {
      return Swal.fire(
        'No hay cierres guardados para descargar',
        'Guarda un cuadre primero.',
        'info'
      );
    }
    try {
      const snap = await getDocs(
        query(
          collection(db, 'cierres'),
          where('fecha', '==', selectedDate),
          where('sucursalId', '==', selectedSucursal)
        )
      );
      const data = snap.docs[0].data();
      const arqueo = data.arqueo || [];
      const cierre = data.cierre || [];
      const gastos = data.gastos || [];
      const suc = sucursales.find(s => s.id === selectedSucursal) || {};
      const cajaChica = parseFloat(suc.cajaChica) || 0;
      const comentario = data.comentario || '';

      const sumFieldLocal = (arr, field) =>
        arr.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);

      const sumCol = idx =>
        ['efectivo', 'tarjeta', 'motorista'].reduce(
          (s, f) => s + (parseFloat(arqueo[idx]?.[f]) || 0),
          0
        );
      const sumColCi = idx =>
        ['efectivo', 'tarjeta', 'motorista'].reduce(
          (s, f) => s + (parseFloat(cierre[idx]?.[f]) || 0),
          0
        );
      const totalGastos = gastos.reduce((s, g) => s + parseFloat(g.cantidad || 0), 0);
      const totalEfectivoSist = sumFieldLocal(arqueo, 'efectivo');
      const totalTarjetaSist = sumFieldLocal(arqueo, 'tarjeta');
      const totalMotoristaSist = sumFieldLocal(arqueo, 'motorista');
      const totalSist = totalEfectivoSist + totalTarjetaSist;
      const totalEfectivoCi = sumFieldLocal(cierre, 'efectivo');
      const totalMotoristaCi = sumFieldLocal(cierre, 'motorista');
      const diferencia = totalEfectivoCi - totalEfectivoSist;
      const aDepositar = totalEfectivoCi - totalGastos;

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      pdf.setFontSize(14);
      pdf.text(`Cuadre - ${formatDate(selectedDate)}`, w / 2, 30, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Sucursal: ${suc.ubicacion}`, w / 2, 45, { align: 'center' });
      let y = 60;

      // Arqueo Físico
      pdf.setFontSize(12);
      pdf.text('Arqueo físico', 40, y);
      y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto', 'Caja 1', 'Caja 2', 'Caja 3', 'Total']],
        body: [
          ['Efectivo', sumCol(0), sumCol(1), sumCol(2), totalEfectivoSist],
          ['Tarjeta', sumCol(0), sumCol(1), sumCol(2), totalTarjetaSist],
          ['Motorista', sumCol(0), sumCol(1), sumCol(2), totalMotoristaSist],
          ['Totales', sumCol(0), sumCol(1), sumCol(2), totalSist]
        ],
        margin: { left: 30, right: 30 },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Cierre de Sistema
      pdf.setFontSize(12);
      pdf.text('Cierre de Sistema', 40, y);
      y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto', 'Caja 1', 'Caja 2', 'Caja 3', 'Total']],
        body: [
          ['Efectivo', sumColCi(0), sumColCi(1), sumColCi(2), totalEfectivoCi],
          ['Tarjeta', sumColCi(0), sumColCi(1), sumColCi(2), sumFieldLocal(cierre, 'tarjeta')],
          ['Motorista', sumColCi(0), sumColCi(1), sumColCi(2), totalMotoristaCi],
          [
            'Totales',
            sumColCi(0),
            sumColCi(1),
            sumColCi(2),
            totalEfectivoCi + sumFieldLocal(cierre, 'tarjeta') + totalMotoristaCi
          ]
        ],
        margin: { left: 30, right: 30 },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Gastos
      pdf.setFontSize(12);
      pdf.text('Gastos', 40, y);
      y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Descripción', 'Categoría', 'Total']],
        body: [
          ...gastos.map(g => [g.descripcion || '', g.categoria, parseFloat(g.cantidad) || 0]),
          [
            { content: 'Totales', colSpan: 2, styles: { fontStyle: 'bold', halign: 'right' } },
            totalGastos
          ]
        ],
        margin: { left: 30, right: 30 },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = pdf.lastAutoTable.finalY + 20;

      // Ventas Total Sistema
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Ventas Total Sistema', 40, y);
      pdf.setFont(undefined, 'normal');
      y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto', 'Total']],
        body: [
          ['Venta Efectivo', totalEfectivoSist],
          ['Venta Tarjeta', totalTarjetaSist],
          ['Venta Motorista', totalMotoristaSist],
          [{ content: 'Total Sistema', styles: { fontStyle: 'bold' } }, totalSist]
        ],
        margin: { left: 30, right: 30 },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = pdf.lastAutoTable.finalY + 20;

      // Control Administración
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('Control Administración', 40, y);
      pdf.setFont(undefined, 'normal');
      y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto', 'Total']],
        body: [
          ['Caja chica', cajaChica],
          ['Venta Efectivo', totalEfectivoCi],
          ['Venta Motorista', totalMotoristaCi],
          ['Gastos', totalGastos],
          [
            {
              content: 'Sobrante/Faltante',
              styles: { textColor: diferencia < 0 ? [255, 0, 0] : [0, 128, 0] }
            },
            Math.abs(diferencia)
          ],
          [{ content: 'Total a Depositar', styles: { fontStyle: 'bold' } }, aDepositar]
        ],
        margin: { left: 30, right: 30 },
        styles: { fontSize: 9, cellPadding: 3 }
      });
      y = pdf.lastAutoTable.finalY + 20;

      // Comentario
      if (comentario) {
        pdf.setFontSize(10);
        pdf.text(`Comentario: ${comentario}`, 40, y);
      }

      pdf.save(`Cuadre_${selectedDate}.pdf`);
    } catch {
      Swal.fire('Error', 'No se pudo generar el PDF.', 'error');
    }
  };

  return (
    <div className="container-principal">
      <div className="encabezado-cuadre">
        <h2>Cuadre</h2>
        <div className="selector-group">
          <div className="date-selector">
            <label htmlFor="fecha">Fecha:</label>
            <input
              id="fecha"
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="sucursal-selector">
            <label htmlFor="sucursal">Sucursal:</label>
            <select
              id="sucursal"
              value={selectedSucursal}
              onChange={e => setSelectedSucursal(e.target.value)}
            >
              <option value="" disabled>Selecciona...</option>
              {sucursales.map(s => (
                <option key={s.id} value={s.id}>{s.ubicacion}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ============================= */}
      {/*  Sección: Arqueo Físico       */}
      {/* ============================= */}
      <Section title="Arqueo Físico">
        {arqueoRefs.map((r, i) => (
          <ArqueoBlock
            key={i}
            ref={r}
            title={`Caja ${i + 1}`}
            onDataChange={handleArqueoChange(i)}
          />
        ))}
      </Section>

      {/* ============================= */}
      {/*  Sección: Cierre de Sistema    */}
      {/* ============================= */}
      <Section title="Cierre de Sistema">
        {cierreRefs.map((r, i) => (
          <CierreBlock
            key={i}
            ref={r}
            title={`Caja ${i + 1}`}
            onDataChange={handleCierreChange(i)}
          />
        ))}
      </Section>

      {/* ============================= */}
      {/*  Sección: Gastos              */}
      {/* ============================= */}
      <Section title="Gastos">
        <GastosBlock
          ref={gastosRef}
          title="Gastos"
          onDataChange={handleGastosChange}
        />
      </Section>

      {/* ============================= */}
      {/*  Sección: Diferencias y Totales */}
      {/* ============================= */}
      <div className="cuadre">
        <div className="footer-section">
          <div className="section diferencias">
            <DiferenciasTable arqueoData={arqueoData} cierreData={cierreData} />
          </div>
          <div className="section totales">
            <TotalesBlock
              ref={totalesRef}
              arqueoData={arqueoData}
              cierreData={cierreData}
              gastosData={gastosData}
              sumDifEfectivo={diferenciaEfectivo()}
              sucursalId={selectedSucursal}
              balanceCajaChica={balanceCajaChica}
              onCoverWithCajaChica={handleCoverWithCajaChica}
            />
          </div>
        </div>
      </div>

      {/* ============================= */}
      {/*  Botones: Guardar / Descargar PDF */}
      {/* ============================= */}
      <div className="guardar-cuadre">
        <button onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar Cuadre'}
        </button>
        <button onClick={handleDescargarPDF}>Descargar PDF</button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="panel">
      <div className="toggle-header">
        <div className="line" />
        <div className="header-center">
          <span className="panel-title">{title}</span>
        </div>
        <div className="line" />
      </div>
      <div className="grid">{children}</div>
    </div>
  );
}
