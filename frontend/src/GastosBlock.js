import React, { useState, forwardRef, useImperativeHandle } from 'react';
import './GastosBlock.css';

const defaultCategories = [
  "Varios",
  "Mantenimiento",
  "Coca-cola",
  "Servicios",
  "Santa Lucia",
  "Gasolina",
  "Transporte",
  "Lavado de Horno",
  "Caja chica"
];

const GastosBlock = forwardRef(({ title }, ref) => {
  const [gastos, setGastos] = useState([
    { cantidad: '', descripcion: '', categoria: defaultCategories[0], hasNIT: false, nitReference: '' },
    { cantidad: '', descripcion: '', categoria: defaultCategories[0], hasNIT: false, nitReference: '' }
  ]);
  const [categories, setCategories] = useState(defaultCategories);

  const handleChange = (index, field, value) => {
    const newGastos = [...gastos];
    newGastos[index][field] = value;
    setGastos(newGastos);
  };

  const handleCategoryChange = (index, value) => {
    if (value === 'agregar') {
      const nuevaCat = window.prompt('Ingrese la nueva categoría:');
      if (nuevaCat) {
        setCategories(prev => [...prev, nuevaCat]);
        handleChange(index, 'categoria', nuevaCat);
      }
    } else {
      handleChange(index, 'categoria', value);
    }
  };

  const handleAddGasto = () => {
    setGastos(prev => [
      ...prev,
      { cantidad: '', descripcion: '', categoria: defaultCategories[0], hasNIT: false, nitReference: '' }
    ]);
  };

  const handleRemoveGasto = index => {
    setGastos(prev => prev.filter((_, i) => i !== index));
  };

  const totalGastos = gastos.reduce((sum, item) => sum + (parseFloat(item.cantidad) || 0), 0);

  useImperativeHandle(ref, () => ({
    getData: () => ({ title, gastos })
  }));

  return (
    <div className="gastos-block">
      <table className="gastos-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Cantidad</th>
            <th>Descripción</th>
            <th>Categoría</th>
            <th>NIT</th>
            <th>Referencia</th>
            <th>Eliminar</th>
          </tr>
        </thead>
        <tbody>
          {gastos.map((item, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="number"
                  value={item.cantidad}
                  onChange={e => handleChange(index, 'cantidad', e.target.value)}
                  placeholder="0"
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.descripcion}
                  onChange={e => handleChange(index, 'descripcion', e.target.value)}
                  placeholder="Descripción"
                />
              </td>
              <td>
                <select
                  value={item.categoria}
                  onChange={e => handleCategoryChange(index, e.target.value)}
                >
                  {categories.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                  <option value="agregar">Agregar categoría</option>
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={item.hasNIT}
                  onChange={e => handleChange(index, 'hasNIT', e.target.checked)}
                />
              </td>
              <td>
                {item.hasNIT && (
                  <input
                    type="text"
                    value={item.nitReference}
                    onChange={e => handleChange(index, 'nitReference', e.target.value)}
                    placeholder="Ref"
                  />
                )}
              </td>
              <td>
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => handleRemoveGasto(index)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="gastos-total">
        <button type="button" onClick={handleAddGasto} className="add-gasto-btn">
          + Agregar Gasto
        </button>
        <strong>Total Gastos: Q. {totalGastos.toFixed(2)}</strong>
      </div>
    </div>
  );
});

export default GastosBlock;
