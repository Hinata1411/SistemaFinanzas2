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
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [cajaChica, setCajaChica] = useState('');
  const [sucursales, setSucursales] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  const sucursalRef = collection(db, 'sucursales');

  const obtenerSucursales = async () => {
    const data = await getDocs(sucursalRef);
    setSucursales(data.docs.map(doc => ({ ...doc.data(), id: doc.id })));
  };

  useEffect(() => {
    obtenerSucursales();
  }, []);

  const handleAgregar = async () => {
    if (!nombre || !empresa || !ubicacion || cajaChica === '') {
      Swal.fire('Error', 'Todos los campos son requeridos', 'warning');
      return;
    }

    try {
      await addDoc(sucursalRef, { nombre, empresa, ubicacion, cajaChica: parseFloat(cajaChica) });
      setNombre('');
      setEmpresa('');
      setUbicacion('');
      setCajaChica('');
      obtenerSucursales();
      Swal.fire('Agregado', 'Sucursal registrada exitosamente', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo registrar', 'error');
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

    if (confirm.isConfirmed) {
      await deleteDoc(doc(db, 'sucursales', id));
      obtenerSucursales();
    }
  };

  const handleEditar = (sucursal) => {
    setEditandoId(sucursal.id);
    setNombre(sucursal.nombre);
    setEmpresa(sucursal.empresa);
    setUbicacion(sucursal.ubicacion);
    setCajaChica(sucursal.cajaChica?.toString() || '');
  };

  const handleActualizar = async () => {
    if (!nombre || !empresa || !ubicacion || cajaChica === '') return;

    try {
      const docRef = doc(db, 'sucursales', editandoId);
      await updateDoc(docRef, { nombre, empresa, ubicacion, cajaChica: parseFloat(cajaChica) });
      setEditandoId(null);
      setNombre('');
      setEmpresa('');
      setUbicacion('');
      setCajaChica('');
      obtenerSucursales();
      Swal.fire('Actualizado', 'Sucursal modificada', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo actualizar', 'error');
    }
  };

  return (
    <div className="sucursales-container">
      <h2>Sucursales</h2>

      <div className="formulario-sucursal">
        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <input
          type="text"
          placeholder="Empresa"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        />
        <input
          type="text"
          placeholder="Ubicación"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
        />
        <input
          type="number"
          placeholder="Caja Chica (Q)"
          value={cajaChica}
          onChange={(e) => setCajaChica(e.target.value)}
          min="0"
          step="0.01"
        />
        {editandoId ? (
          <button onClick={handleActualizar}>Actualizar</button>
        ) : (
          <button onClick={handleAgregar}>Agregar</button>
        )}
      </div>

      <table className="tabla-sucursales">
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
          {sucursales.map((sucursal) => (
            <tr key={sucursal.id}>
              <td>{sucursal.nombre}</td>
              <td>{sucursal.empresa}</td>
              <td>{sucursal.ubicacion}</td>
              <td>{sucursal.cajaChica?.toFixed(2)}</td>
              <td>
                <button onClick={() => handleEditar(sucursal)}>Editar</button>
                <button onClick={() => handleEliminar(sucursal.id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
