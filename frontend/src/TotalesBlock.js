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
  const [saving, setSaving] = useState(false);
  const [hasSavedClosure, setHasSavedClosure] = useState(false);

  const [arqueoData, setArqueoData] = useState([]);
  const [cierreData, setCierreData] = useState([]);
  const [gastosData, setGastosData] = useState([]);

  // Refs para cada bloque:
  const arqueoRefs = [useRef(), useRef(), useRef()];
  const cierreRefs = [useRef(), useRef(), useRef()];
  const gastosRef = useRef();
  // Ref para TotalesBlock:
  const totalesRef = useRef();

  // Si quisieras implementar edición, aquí podrías leer un query param "editar" y cargar:
  // const [docIdAEditar, setDocIdAEditar] = useState(null);
  // const [inicialComentario, setInicialComentario] = useState('');
  //
  // useEffect(() => {
  //   const params = new URLSearchParams(window.location.search);
  //   const id = params.get('editar');
  //   if (id) {
  //     setDocIdAEditar(id);
  //     // Luego harías getDoc(...) para precargar arqueoData, cierreData, gastosData y comentario.
  //   }
  // }, []);

  const formatDate = iso => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Carga inicial de sucursales
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'sucursales'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSucursales(list);
        if (list.length && !selectedSucursal) setSelectedSucursal(list[0].id);
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'No se pudieron cargar sucursales', 'error');
      }
    })();
  }, []);

  // Verifica existencia de cierre guardado para fecha y sucursal
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

  // Sincroniza datos de bloques cada medio segundo
  useEffect(() => {
    const iv = setInterval(() => {
      // Cada ref tiene un método getData()
      setArqueoData(arqueoRefs.map(r => r.current?.getData() || {}));
      setCierreData(cierreRefs.map(r => r.current?.getData() || {}));
      setGastosData(gastosRef.current?.getData()?.gastos || []);
    }, 500);
    return () => clearInterval(iv);
  }, []);

  const sumField = (arr, field) =>
    arr.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);

  const sumDifEfectivo = () =>
    sumField(arqueoData, 'efectivo') - sumField(cierreData, 'efectivo');

  // Guardar cuadre (solo uno por sucursal y día)
  const handleGuardar = async () => {
    if (!auth.currentUser) {
      return Swal.fire('No autenticado', 'Inicia sesión para guardar.', 'warning');
    }
    if (!selectedSucursal) {
      return Swal.fire('Selección requerida', 'Elige una sucursal.', 'warning');
    }
    // Regla: un cuadre por sucursal por día
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

    const arqueo = arqueoData;
    const cierre = cierreData;
    const gastos = gastosData;
    // *** Aquí extraemos el comentario del TotalesBlock:
    const comentario = totalesRef.current?.getData().comentario || '';

    // Validación de datos
    const validBoxes = [...arqueo, ...cierre].every(b =>
      ['efectivo', 'tarjeta', 'motorista'].every(f =>
        b[f] !== undefined && !isNaN(parseFloat(b[f]))
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
        diferenciaEfectivo: sumDifEfectivo(),
        comentario,                  // Aquí guardamos el comentario que vinó de TotalesBlock
        creado: serverTimestamp(),
        uid: auth.currentUser.uid
      });
      setHasSavedClosure(true);

      // Actualiza caja chica si hay gastos de 'Caja chica'
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

  // Descargar PDF
  const handleDescargarPDF = async () => {
    if (!hasSavedClosure) {
      return Swal.fire(
        'No hay cierres guardados para descargar',
        'Guarda un cuadre primero.',
        'info'
      );
    }
    try {
      // Recupera datos de Firestore
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
      const comentario = data.comentario || '';
      const suc = sucursales.find(s => s.id === selectedSucursal) || {};
      const cajaChica = parseFloat(suc.cajaChica) || 0;

      // Cálculos para el PDF…

      // (Tal como ya estaba en tu versión, sin cambios en el PDF)

      // 1) Arqueo
      // 2) Cierre de Sistema
      // 3) Gastos
      // 4) Totales y comentario
      // Lo coloco de modo resumido:

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
      const totalEfectivoSist  = sumField(arqueo, 'efectivo');
      const totalTarjetaSist   = sumField(arqueo, 'tarjeta');
      const totalMotoristaSist = sumField(arqueo, 'motorista');
      const totalSist          = totalEfectivoSist + totalTarjetaSist;
      const totalEfectivoCi  = sumField(cierre, 'efectivo');
      const totalMotoristaCi = sumField(cierre, 'motorista');
      const diferencia       = totalEfectivoCi - totalEfectivoSist;
      const aDepositar       = totalEfectivoCi - totalGastos;

      // Genera PDF…
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      pdf.setFontSize(14);
      pdf.text(`Cuadre - ${formatDate(selectedDate)}`, w/2, 30, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Sucursal: ${suc.ubicacion}`, w/2, 45, { align: 'center' });
      let y = 60;

      // Arqueo físico
      pdf.setFontSize(12); pdf.text('Arqueo físico', 40, y); y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto','Caja 1','Caja 2','Caja 3','Total']],
        body: [
          ['Efectivo',  sumCol(0),  sumCol(1),  sumCol(2),  totalEfectivoSist],
          ['Tarjeta',   sumCol(0),  sumCol(1),  sumCol(2),  totalTarjetaSist],
          ['Motorista', sumCol(0),  sumCol(1),  sumCol(2),  totalMotoristaSist],
          ['Totales',   sumCol(0),  sumCol(1),  sumCol(2),  totalSist]
        ],
        margin:{left:30,right:30}, styles:{fontSize:9,cellPadding:3}
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Cierre de Sistema
      pdf.setFontSize(12); pdf.text('Cierre de Sistema', 40, y); y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Concepto','Caja 1','Caja 2','Caja 3','Total']],
        body: [
          ['Efectivo',  sumColCi(0), sumColCi(1), sumColCi(2), totalEfectivoCi],
          ['Tarjeta',   sumColCi(0), sumColCi(1), sumColCi(2), sumField(cierre,'tarjeta')],
          ['Motorista', sumColCi(0), sumColCi(1), sumColCi(2), totalMotoristaCi],
          ['Totales',   sumColCi(0), sumColCi(1), sumColCi(2), totalEfectivoCi + sumField(cierre,'tarjeta') + totalMotoristaCi]
        ],
        margin:{left:30,right:30}, styles:{fontSize:9,cellPadding:3}
      });
      y = pdf.lastAutoTable.finalY + 10;

      // Gastos
      pdf.setFontSize(12); pdf.text('Gastos', 40, y); y += 14;
      autoTable(pdf, {
        startY: y,
        head: [['Descripción','Categoría','Total']],
        body: [
          ...gastos.map(g => [g.descripcion || g.concepto || '', g.categoria, parseFloat(g.cantidad) || 0]),
          [{content:'Totales',colSpan:2,styles:{fontStyle:'bold',halign:'right'}}, totalGastos]
        ],
        margin:{left:30,right:30}, styles:{fontSize:9,cellPadding:3}
      });
      y = pdf.lastAutoTable.finalY + 20;

      // Ventas Total Sistema
      pdf.setFontSize(12); pdf.setFont(undefined,'bold'); pdf.text('Ventas Total Sistema',40,y); pdf.setFont(undefined,'normal'); y += 14;
      autoTable(pdf,{
        startY:y,
        head:[['Concepto','Total']],
        body:[
          ['Venta Efectivo', totalEfectivoSist],
          ['Venta Tarjeta',  totalTarjetaSist],
          ['Venta Motorista',totalMotoristaSist],
          [{content:'Total Sistema',styles:{fontStyle:'bold'}}, totalSist]
        ],
        margin:{left:30,right:30}, styles:{fontSize:9,cellPadding:3}
      });
      y = pdf.lastAutoTable.finalY + 20;

      // Control Administración
      pdf.setFontSize(12); pdf.setFont(undefined,'bold'); pdf.text('Control Administración',40,y); pdf.setFont(undefined,'normal'); y += 14;
      autoTable(pdf,{
        startY:y,
        head:[['Concepto','Total']],
        body:[
          ['Caja chica',   cajaChica],
          ['Venta Efectivo',totalEfectivoCi],
          ['Venta Motorista',totalMotoristaCi],
          ['Gastos',         totalGastos],
          [{content:'Sobrante/Faltante',styles:{textColor:diferencia<0?[255,0,0]:[0,128,0]}},Math.abs(diferencia)],
          [{content:'Total a Depositar',styles:{fontStyle:'bold'}}, aDepositar]
        ],
        margin:{left:30,right:30}, styles:{fontSize:9,cellPadding:3}
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

      <Section title="Arqueo Físico">
        {arqueoRefs.map((r, i) => (
          <ArqueoBlock key={i} ref={r} title={`Caja ${i+1}`} />
        ))}
      </Section>
      <Section title="Cierre de Sistema">
        {cierreRefs.map((r, i) => (
          <CierreBlock key={i} ref={r} title={`Caja ${i+1}`} />
        ))}
      </Section>
      <Section title="Gastos">
        <GastosBlock ref={gastosRef} title="Gastos" />
      </Section>

      <div className="cuadre">
        <div className="footer-section">
          <div className="section diferencias">
            <DiferenciasTable arqueoData={arqueoData} cierreData={cierreData} />
          </div>
          <div className="section totales">
            <TotalesBlock
              ref={totalesRef}                       // <-- AÑADIDO: ref para TotalesBlock
              arqueoData={arqueoData}
              cierreData={cierreData}
              gastosData={gastosData}
              sumDifEfectivo={sumDifEfectivo()}
              sucursalId={selectedSucursal}
            />
          </div>
        </div>
      </div>

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
