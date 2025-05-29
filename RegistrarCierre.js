import React, { useState, useRef, useEffect } from 'react';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

  const [arqueoData, setArqueoData] = useState([]);
  const [cierreData, setCierreData] = useState([]);
  const [gastosData, setGastosData] = useState([]);

  const arqueoRefs = [useRef(), useRef(), useRef()];
  const cierreRefs = [useRef(), useRef(), useRef()];
  const gastosRef = useRef();

  // Formatea la fecha a DD/MM/YYYY
  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Trae datos de sucursales
  const fetchSucursales = async () => {
    try {
      const snap = await getDocs(collection(db, 'sucursales'));
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSucursales(list);
      if (list.length && !selectedSucursal) {
        setSelectedSucursal(list[0].id);
      }
    } catch (err) {
      console.error('Error cargando sucursales:', err);
      Swal.fire('Error', 'No se pudieron cargar sucursales', 'error');
    }
  };

  useEffect(() => {
    fetchSucursales();
  }, []);

  // Recoge datos de bloques
  const getArqueoData = () => arqueoRefs.map(r => r.current?.getData() || {});
  const getCierreData = () => cierreRefs.map(r => r.current?.getData() || {});
  const getGastosData = () => gastosRef.current?.getData()?.gastos || [];

  useEffect(() => {
    const interval = setInterval(() => {
      setArqueoData(getArqueoData());
      setCierreData(getCierreData());
      setGastosData(getGastosData());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const sumDifEfectivo = (arqueo, cierre) =>
    arqueo.reduce((acc, a, i) => {
      const c = cierre[i] || {};
      if (!a.active || !c.active) return acc;
      return acc + ((a.efectivo || 0) - (c.efectivo || 0));
    }, 0);

  const isNumeric = v => v === '' || !isNaN(parseFloat(v));

  // Guarda en Firestore
  const handleGuardar = async () => {
    if (!auth.currentUser) {
      Swal.fire('No autenticado', 'Inicia sesión para guardar.', 'warning');
      return;
    }

    const arqueo = getArqueoData();
    const cierre = getCierreData();
    const gastos = getGastosData();

    // Validaciones
    const allBoxes = [...arqueo, ...cierre];
    const validBoxes = allBoxes.every(b =>
      ['efectivo','tarjeta','motorista'].every(f => isNumeric(b[f]))
    );
    const validGastos = gastos.every(g => isNumeric(g.cantidad));

    if (!validBoxes || !validGastos) {
      Swal.fire('Datos inválidos', 'Revisa montos y gastos.', 'warning');
      return;
    }
    if (!selectedSucursal) {
      Swal.fire('Selección requerida', 'Elige una sucursal.', 'warning');
      return;
    }

    const cuadre = {
      fecha: selectedDate,
      sucursalId: selectedSucursal,
      arqueo,
      cierre,
      gastos,
      diferenciaEfectivo: sumDifEfectivo(arqueo, cierre),
      creado: serverTimestamp(),
      uid: auth.currentUser.uid,
    };

    setSaving(true);
    try {
      await addDoc(collection(db, 'cierres'), cuadre);
      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: `Cuadre del ${formatDate(selectedDate)} registrado.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error('Error guardando cuadre:', err);
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Genera PDF simplificado
  const handleDescargarPDF = () => {
    const arqueo = getArqueoData();
    const cierre = getCierreData();
    const gastos = getGastosData();
    const sucursalObj = sucursales.find(s => s.id === selectedSucursal);
    const sucursalName = sucursalObj ? sucursalObj.ubicacion : '';

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();

    // Encabezado
    pdf.setFontSize(16);
    pdf.text(`Cuadre - ${formatDate(selectedDate)}`, pageWidth / 2, 40, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(`Sucursal: ${sucursalName}`, pageWidth / 2, 60, { align: 'center' });

    let currentY = 80;
    const denom = [100, 50, 20, 10, 5, 1];

    // Arqueo Físico
    pdf.setFontSize(14);
    pdf.text('Arqueo Físico', 40, currentY);
    pdf.autoTable({
      startY: currentY + 10,
      head: [['Denominación', 'Caja 1', 'Caja 2', 'Caja 3']],
      body: denom.map(d => [
        `$${d}`,
        arqueo[0]?.billetes?.[d] ?? 0,
        arqueo[1]?.billetes?.[d] ?? 0,
        arqueo[2]?.billetes?.[d] ?? 0,
      ]),
      margin: { left: 40, right: 40 },
    });
    currentY = pdf.lastAutoTable.finalY + 20;

    // Cierre de Sistema
    pdf.setFontSize(14);
    pdf.text('Cierre de Sistema', 40, currentY);
    pdf.autoTable({
      startY: currentY + 10,
      head: [['Denominación', 'Caja 1', 'Caja 2', 'Caja 3']],
      body: denom.map(d => [
        `$${d}`,
        cierre[0]?.billetes?.[d] ?? 0,
        cierre[1]?.billetes?.[d] ?? 0,
        cierre[2]?.billetes?.[d] ?? 0,
      ]),
      margin: { left: 40, right: 40 },
    });
    currentY = pdf.lastAutoTable.finalY + 20;

    // Gastos
    pdf.setFontSize(14);
    pdf.text('Gastos', 40, currentY);
    pdf.autoTable({
      startY: currentY + 10,
      head: [['Concepto', 'Cantidad']],
      body: gastos.map(g => [g.concepto || '', g.cantidad || 0]),
      margin: { left: 40, right: 40 },
    });
    currentY = pdf.lastAutoTable.finalY + 20;

    // Totales
    pdf.setFontSize(14);
    pdf.text('Totales', 40, currentY);
    const diff = sumDifEfectivo(arqueo, cierre);
    const totalG = gastos.reduce((sum, g) => sum + (g.cantidad || 0), 0);
    pdf.autoTable({
      startY: currentY + 10,
      head: [['Concepto', 'Total']],
      body: [
        ['Diferencia Efectivo', diff],
        ['Total Gastos', totalG],
      ],
      margin: { left: 40, right: 40 },
    });

    // Descargar
    pdf.save(`Cuadre_${selectedDate}.pdf`);
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
        {arqueoRefs.map((ref, i) => (
          <ArqueoBlock key={i} ref={ref} title={`Caja ${i+1}`} />
        ))}
      </Section>

      <Section title="Cierre de Sistema">
        {cierreRefs.map((ref, i) => (
          <CierreBlock key={i} ref={ref} title={`Caja ${i+1}`} />
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
              arqueoData={arqueoData}
              cierreData={cierreData}
              gastosData={gastosData}
              sumDifEfectivo={sumDifEfectivo(arqueoData, cierreData)}
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

// Secciones sin toggle
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
