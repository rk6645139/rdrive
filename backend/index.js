require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const app = express();

app.use(cors());
app.use(express.json());

// ... 
app.use('/files', fileRoutes);

app.use('/auth', authRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Backend is alive' });
});

app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const authMiddleware = require('./middleware/authMiddleware');

app.get('/protected-test', authMiddleware, (req, res) => {
  res.json({ message: `You are user #${req.userId}, and you're authenticated!` });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});