require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // para maxHeaderSize
const { db, auth } = require('./firebaseAdmin'); // 👈 importa tu Firebase Admin ya inicializado

const app = express();

// Usa 3001 o el que Render te asigne
const PORT = process.env.PORT || 3001;

// Configuración de CORS
const corsOptions = {
  origin: (process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:3000']),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// 👉 Rutas
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Ejemplo: prueba Firestore
app.get('/api/health', async (req, res) => {
  try {
    const snap = await db.collection('users').limit(1).get();
    res.json({ ok: true, foundUsers: snap.size });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Ruta base
app.get('/', (req, res) => {
  res.send('Bienvenido a SistemaFinanzas API');
});

// Servidor HTTP con maxHeaderSize aumentado
const server = http.createServer({ maxHeaderSize: 65536 }, app);

server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
