require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // 👈 para controlar maxHeaderSize

const app = express();

// Usa 3001 para que coincida con tu frontend que llama a :3001
const PORT = process.env.PORT || 3001;

/**
 * CORS:
 * - Si NO usas cookies en el login, deja credentials: false (recomendado).
 * - Si necesitas cookies en otras rutas, puedes cambiar a true,
 *   pero asegúrate de que las cookies sean pequeñas (<4KB) y con path acotado.
 */
const corsOptions = {
  origin: (process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:3000']),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false, // 👈 evita negociación de cookies si no las usas
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' })); // body parser (1MB es más que suficiente para el login)

// 👉 Rutas
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Ruta simple de prueba
app.get('/', (req, res) => {
  res.send('Bienvenido a SistemaFinanzas API');
});

/**
 * Servidor HTTP con header size aumentado (solo DEV).
 * Por defecto Node limita a ~8–16KB. Aquí lo subimos a 64KB para que no te tire 431
 * mientras detectas la causa (normalmente, cookies enormes).
 */
const server = http.createServer({ maxHeaderSize: 65536 }, app);

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
