require('dotenv').config(); 
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
// Configuración de CORS:
const corsOptions = {
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000', // Define aquí tu dominio autorizado
  methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Headers permitidos
  credentials: true,  // Para permitir el envío de cookies (HttpOnly u otras)
};

app.use(cors(corsOptions));
app.use(express.json()); 

//Agregar COOKIE HTTPONLY
//app.use(cors({
 // origin: 'http://tu-dominio.com', // Configura el origen permitido en producción
  //credentials: true  // Permite el envío de cookies
//}));
//app.use(express.json());
//app.use(cookieParser());



const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Rutas de prueba
app.get('/', (req, res) => {
  res.send('Bienvenido a SistemaFinanzas API');
});


// Inicia el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
