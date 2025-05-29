// src/MiComponente.js
import React, { useEffect } from 'react';
import './MiComponente.css'; // Importa el CSS específico

function MiComponente() {
  useEffect(() => {
    // Coloca aquí el código JavaScript que se debe ejecutar cuando se monta el componente
    // Puedes encapsular tu lógica en una función o importar módulos según sea necesario
    console.log("MiComponente montado");
  }, []);

  return (
    <div className="mi-componente">
      {/* Aquí coloca el HTML que necesitas */}
      <h1>Bienvenido a SistemaFinanzas</h1>
      <p>Este es mi contenido integrado en React.</p>
    </div>
    
  );
}

export default MiComponente;
