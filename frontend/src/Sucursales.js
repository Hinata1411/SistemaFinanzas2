import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Swal from 'sweetalert2';
import './Sucursales.css';

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);

  // Perfil del usuario logueado
  const [me, setMe] = useState({ role: null, sucursalId: null, loaded: false });

  // Modal + formulario
  const [modalOpen, setModalOpen] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cajaChica, setCajaChica] = useState('');

  // Extras (checks)
  const [extrasPedidosYa, setExtrasPedidosYa] = useState(false);
  const [extrasAmex, setExtrasAmex] = useState(false);

  const sucursalRef = collection(db, 'sucursales');

  // Perfil usuario
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMe({ role: 'viewer', sucursalId: null, loaded: true });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        const data = snap.exists() ? snap.data() : {};
        setMe({
          role: data.role || 'viewer',
          sucursalId: data.sucursalId || null,
          loaded: true,
        });
      } catch (e) {
        console.error(e);
        setMe({ role: 'viewer', sucursalId: null, loaded: true });
      }
    });
    return () => unsub();
  }, []);

  const canManage = me.role === 'admin';

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

  const visibleSucursales = useMemo(() => {
    if (!me.loaded) return [];
    if (me.role === 'admin') return sucursales;
    return sucursales.filter((s) => s.id === me.sucursalId);
  }, [sucursales, me]);

  const openNewModal = () => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes crear sucursales.', 'info');
    setEditandoId(null);
    setNombre('');
    setEmpresa('');
    setUbicacion('');
    setCajaChica('');
    setExtrasPedidosYa(false);
    setExtrasAmex(false);
    setModalOpen(true);
  };

  const openEditModal = (s) => {
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes editar sucursales.', 'info');
    setEditandoId(s.id);
    setNombre(s.nombre || '');
    setEmpresa(s.empresa || '');
    setUbicacion(s.ubicacion || '');
    setCajaChica(typeof s.cajaChica === 'number' ? s.cajaChica.toString() : (s.cajaChica || ''));
    const ex = s.extras || {};
    setExtrasPedidosYa(Boolean(ex.pedidosYa));
    setExtrasAmex(Boolean(ex.americanExpress));
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

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
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes guardar cambios.', 'info');
    if (!validar()) return;

    try {
      const payload = {
        nombre: nombre.trim(),
        empresa: empresa.trim(),
        ubicacion: ubicacion.trim(),
        cajaChica: parseFloat(cajaChica),
        extras: {
          pedidosYa: Boolean(extrasPedidosYa),
          americanExpress: Boolean(extrasAmex),
        },
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
    if (!canManage) return Swal.fire('Sin permisos', 'No puedes eliminar sucursales.', 'info');
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
          {canManage && <button className="btn btn-primary" onClick={openNewModal}>Nueva sucursal</button>}
        </div>
      </header>

      {!me.loaded ? (
        <div className="tabla-wrap">
          <table className="tabla"><thead><tr>
            <th>Nombre</th><th>Empresa</th><th>Ubicación</th><th>Caja Chica (Q)</th>{canManage && <th>Acciones</th>}
          </tr></thead><tbody><tr><td colSpan={canManage ? 5 : 4} className="empty">Cargando perfil…</td></tr></tbody></table>
        </div>
      ) : (
        <div className="tabla-wrap">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>Ubicación</th>
                <th>Caja Chica (Q)</th>
                {canManage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canManage ? 5 : 4} className="empty">Cargando…</td></tr>
              ) : visibleSucursales.length ? (
                visibleSucursales.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td>{s.empresa}</td>
                    <td>{s.ubicacion}</td>
                    <td>{typeof s.cajaChica === 'number' ? s.cajaChica.toFixed(2) : '0.00'}</td>
                    {canManage && (
                      <td>
                        <div className="acciones">
                          <button className="btn-min" onClick={() => openEditModal(s)}>Editar</button>
                          <button className="btn-min danger" onClick={() => handleEliminar(s.id)}>Eliminar</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="empty">
                    {me.role === 'viewer' ? 'No tienes una sucursal asignada.' : 'Sin sucursales'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && canManage && (
        <div className="modal-mask" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">{editandoId ? 'Editar sucursal' : 'Nueva sucursal'}</h3>

            <div className="form-sucursal">
              <div className="form-row">
                <label>Nombre</label>
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la sucursal" />
              </div>
              <div className="form-row">
                <label>Empresa</label>
                <input type="text" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa" />
              </div>
              <div className="form-row">
                <label>Ubicación</label>
                <input type="text" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} placeholder="Dirección o zona" />
              </div>
              <div className="form-row">
                <label>Caja Chica (Q)</label>
                <input type="number" min="0" step="0.01" value={cajaChica} onChange={(e) => setCajaChica(e.target.value)} placeholder="0.00" />
              </div>

              <div className="form-row">
                <label>Extras</label>
                <div className="extras-group" style={{ display: 'grid', gap: 6 }}>
                  <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" className="form-check-input" checked={extrasPedidosYa} onChange={(e) => setExtrasPedidosYa(e.target.checked)} />
                    <span>Pedidos Ya</span>
                  </label>

                  <label className="form-check" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" className="form-check-input" checked={extrasAmex} onChange={(e) => setExtrasAmex(e.target.checked)} />
                    <span>American Express</span>
                  </label>
                </div>
                <small className="form-hint" style={{ color: '#6b7280' }}>
                  Estas opciones muestran botones adicionales en Registrar Cierre.
                </small>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar}>{editandoId ? 'Actualizar' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
