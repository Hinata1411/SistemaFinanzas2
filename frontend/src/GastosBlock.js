// src/GastosBlock.jsx

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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

const GastosBlock = forwardRef(
  (
    {
      title = "Gastos",
      inicialData = null,   // Si viene, es un arreglo: [{ cantidad, descripcion, categoria, hasNIT, nitReference }, ...]
      readonly = false,
      onDataChange          // <-- callback que el padre debe pasar
    },
    ref
  ) => {
    // Estado interno de gastos (cada gasto: { cantidad, descripcion, categoria, hasNIT, nitReference })
    const [gastos, setGastos] = useState([
      { cantidad: "", descripcion: "", categoria: defaultCategories[0], hasNIT: false, nitReference: "" },
      { cantidad: "", descripcion: "", categoria: defaultCategories[0], hasNIT: false, nitReference: "" }
    ]);
    const [categories, setCategories] = useState(defaultCategories);

    // 1) Si llega `inicialData` y el componente está en modo readonly,
    //    pre-llenamos el estado con esos valores.
    useEffect(() => {
      if (Array.isArray(inicialData)) {
        const copia = inicialData.map((g) => ({
          cantidad: g.cantidad?.toString() || "",
          descripcion: g.descripcion || "",
          categoria: g.categoria || defaultCategories[0],
          hasNIT: !!g.hasNIT,
          nitReference: g.nitReference || ""
        }));
        setGastos(copia);
      }
    }, [inicialData]);

    // 2) NOTIFICAR AL PADRE cada vez que cambie `gastos`
    useEffect(() => {
      if (typeof onDataChange === "function") {
        onDataChange({ title, gastos });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gastos]);

    // 3) Manejo de cambios en cada gasto
    const handleChange = (index, field, value) => {
      const nuevaLista = [...gastos];
      nuevaLista[index][field] = value;
      setGastos(nuevaLista);
    };

    // 4) Manejo de cambio de categoría (con opción de “Agregar categoría”)
    const handleCategoryChange = (index, value) => {
      if (value === "agregar" && !readonly) {
        const nuevaCat = window.prompt("Ingrese la nueva categoría:");
        if (nuevaCat) {
          setCategories((prev) => [...prev, nuevaCat]);
          handleChange(index, "categoria", nuevaCat);
        }
      } else {
        handleChange(index, "categoria", value);
      }
    };

    // 5) Agregar nueva fila de gasto
    const handleAddGasto = () => {
      if (readonly) return;
      setGastos((prev) => [
        ...prev,
        { cantidad: "", descripcion: "", categoria: defaultCategories[0], hasNIT: false, nitReference: "" }
      ]);
    };

    // 6) Eliminar un gasto por índice
    const handleRemoveGasto = (index) => {
      if (readonly) return;
      setGastos((prev) => prev.filter((_, i) => i !== index));
    };

    // 7) Cálculo del total de todos los gastos
    const totalGastos = gastos.reduce(
      (sum, item) => sum + (parseFloat(item.cantidad) || 0),
      0
    );

    // 8) Exponer getData() al componente padre
    useImperativeHandle(ref, () => ({
      getData: () => ({
        title,
        gastos: gastos.map((g) => ({
          cantidad: parseFloat(g.cantidad) || 0,
          descripcion: g.descripcion,
          categoria: g.categoria,
          hasNIT: g.hasNIT,
          nitReference: g.nitReference
        }))
      })
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
              {!readonly && <th>Eliminar</th>}
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
                    onChange={(e) => handleChange(index, "cantidad", e.target.value)}
                    placeholder="0"
                    disabled={readonly}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.descripcion}
                    onChange={(e) => handleChange(index, "descripcion", e.target.value)}
                    placeholder="Descripción"
                    disabled={readonly}
                  />
                </td>
                <td>
                  <select
                    value={item.categoria}
                    onChange={(e) => handleCategoryChange(index, e.target.value)}
                    disabled={readonly}
                  >
                    {categories.map((cat, i) => (
                      <option key={i} value={cat}>
                        {cat}
                      </option>
                    ))}
                    {!readonly && <option value="agregar">Agregar categoría</option>}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={item.hasNIT}
                    onChange={(e) => handleChange(index, "hasNIT", e.target.checked)}
                    disabled={readonly}
                  />
                </td>
                <td>
                  {item.hasNIT ? (
                    <input
                      type="text"
                      value={item.nitReference}
                      onChange={(e) => handleChange(index, "nitReference", e.target.value)}
                      placeholder="Ref"
                      disabled={readonly}
                    />
                  ) : (
                    <span>—</span>
                  )}
                </td>
                {!readonly && (
                  <td>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveGasto(index)}
                    >
                      &times;
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="gastos-total" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          {!readonly && (
            <button
              type="button"
              onClick={handleAddGasto}
              className="add-gasto-btn"
              style={{
                padding: '0.3rem 0.6rem',
                backgroundColor: '#28a745',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              + Agregar Gasto
            </button>
          )}
          <strong>Total Gastos: Q {totalGastos.toFixed(2)}</strong>
        </div>
      </div>
    );
  }
);

export default GastosBlock;
