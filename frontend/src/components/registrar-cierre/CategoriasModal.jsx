// src/components/registrar-cierre/CategoriasModal.jsx
import React, { useState } from 'react';

export default function CategoriasModal({ open, onClose, categorias, onChangeCategorias }) {
  const [editIdx, setEditIdx] = useState(null);
  const [editName, setEditName] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  if (!open) return null;

  const startEdit = (i) => {
    setEditIdx(i);
    setEditName(categorias[i]);
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const name = editName.trim();
    if (!name) return alert('Ingresa un nombre.');
    if (categorias.some((c, idx) => idx !== editIdx && c.toLowerCase() === name.toLowerCase())) {
      return alert('Ya existe una categoría con ese nombre.');
    }
    const updated = categorias.map((c, i) => (i === editIdx ? name : c));
    onChangeCategorias(updated, categorias[editIdx], name);
    setEditIdx(null);
    setEditName('');
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditName('');
  };

  const deleteCat = (i) => {
    const removed = categorias[i];
    const updated = categorias.filter((_, idx) => idx !== i);
    onChangeCategorias(updated, removed, null);
  };

  const saveNew = () => {
    const name = newCatName.trim();
    if (!name) return alert('Ingresa un nombre.');
    if (categorias.some((c) => c.toLowerCase() === name.toLowerCase())) {
      return alert('Ya existe una categoría con ese nombre.');
    }
    onChangeCategorias([...categorias, name], null, name);
    setAddMode(false);
    setNewCatName('');
  };

  return (
    <div className="rc-modal-mask" role="dialog" aria-modal="true">
      <div className="rc-modal-card">
        <div className="rc-modal-hd">
          <h4>Categorías de gastos</h4>
          <div className="rc-modal-actions">
            {addMode ? (
              <>
                <input
                  className="rc-input rc-input-sm"
                  placeholder="Nombre de categoría"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button className="rc-btn rc-btn-primary" onClick={saveNew}>Guardar</button>
                <button className="rc-btn" onClick={() => { setAddMode(false); setNewCatName(''); }}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="rc-btn" onClick={() => setAddMode(true)}>Agregar</button>
            )}
            <button className="rc-btn rc-btn-outline" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div className="rc-modal-body">
          <table className="rc-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>#</th>
                <th>Categoría</th>
                <th style={{ width: '220px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat, i) => (
                <tr key={cat + i}>
                  <td>{i + 1}</td>
                  <td>
                    {editIdx === i ? (
                      <input
                        className="rc-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      cat
                    )}
                  </td>
                  <td className="rc-td-actions">
                    {editIdx === i ? (
                      <>
                        <button className="rc-btn rc-btn-primary" onClick={saveEdit}>Guardar</button>
                        <button className="rc-btn" onClick={cancelEdit}>Cancelar</button>
                      </>
                    ) : (
                      <>
                        <button className="rc-btn" onClick={() => startEdit(i)}>Editar</button>
                        <button className="rc-btn rc-btn-ghost danger" onClick={() => deleteCat(i)}>Eliminar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!categorias.length && (
                <tr>
                  <td colSpan={3} className="rc-empty">Sin categorías</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
