import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import Swal from 'sweetalert2';
import './Sucursales.css';

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal + formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cajaChica, setCajaChica] = useState('');

  const sucursalRef = collection(db, 'sucursales');

  const obtenerSucursales = async () => {
    try {
      setLoading(true);
      const data = await getDocs(sucursalRef);
      setSucursales(data.docs.map((d) => ({ ...d.data(), id: d.id })));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudieron cargar las sucursales', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerSucursales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewModal = () => {
    setEditandoId(null);
    setNombre('');
    setEmpresa('');
    setUbicacion('');
    setCajaChica('');
    setModalOpen(true);
  };

  const openEditModal = (s) => {
    setEditandoId(s.id);
    setNombre(s.nombre || '');
    setEmpresa(s.empresa || '');
    setUbicacion(s.ubicacion || '');
    setCajaChica(
      typeof s.cajaChica === 'number' ? s.cajaChica.toString() : (s.cajaChica || '')
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const validar = () => {
    if (!nombre || !empresa || !ubicacion || cajaChica === '') {
      Swal.fire('Campos incompletos', 'Todos los campos son requeridos', 'warning');
      return false;
    }
    const val = parseFloat(cajaChica);
    if (Number.isNaN(val) || val < 0) {
      Swal.fire('Caja chica inválida', 'Ingresa un monto válido (>= 0)', 'warning');
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    try {
      const payload = {
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        ubicacion: ubicacion.trim(),
        cajaChica: parseFloat(cajaChica),
      };

      if (editandoId) {
        await updateDoc(doc(db, 'sucursales', editandoId), payload);
        Swal.fire('Actualizado', 'Sucursal modificada', 'success');
      } else {
        await addDoc(sucursalRef, payload);
        Swal.fire('Agregado', 'Sucursal registrada', 'success');
      }

      setModalOpen(false);
      await obtenerSucursales();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo guardar la sucursal', 'error');
    }
  };

  const handleEliminar = async (id) => {
    const confirm = await Swal.fire({
      title: '¿Eliminar?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
    });
    if (!confirm.isConfirmed) return;

    try {
      await deleteDoc(doc(db, 'sucursales', id));
      await obtenerSucursales();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo eliminar', 'error');
    }
  };

  return (
    <div className="sucursales-shell">
      <header className="sucursales-header">
        <h1>Sucursales</h1>
        <div className="sucursales-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            Nueva sucursal
          </button>
        </div>
      </header>

      <div className="tabla-wrap">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Empresa</th>
              <th>Ubicación</th>
              <th>Caja Chica (Q)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="empty">Cargando…</td>
              </tr>
            ) : sucursales.length ? (
              sucursales.map((s) => (
                <tr key={s.id}>
                  <td>{s.nombre}</td>
                  <td>{s.empresa}</td>
                  <td>{s.ubicacion}</td>
                  <td>{typeof s.cajaChica === 'number' ? s.cajaChica.toFixed(2) : '0.00'}</td>
                  <td>
                    <div className="acciones">
                      <button className="btn-min" onClick={() => openEditModal(s)}>
                        Editar
                      </button>
                      <button className="btn-min danger" onClick={() => handleEliminar(s.id)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="empty">Sin sucursales</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para nueva/editar sucursal */}
      {modalOpen && (
        <div className="modal-mask" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">
              {editandoId ? 'Editar sucursal' : 'Nueva sucursal'}
            </h3>

            <div className="form-sucursal">
              <div className="form-row">
                <label>Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre de la sucursal"
                />
              </div>
              <div className="form-row">
                <label>Empresa</label>
                <input
                  type="text"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Empresa"
                />
              </div>
              <div className="form-row">
                <label>Ubicación</label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Dirección o zona"
                />
              </div>
              <div className="form-row">
                <label>Caja Chica (Q)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cajaChica}
                  onChange={(e) => setCajaChica(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar}>
                {editandoId ? 'Actualizar' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
