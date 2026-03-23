const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'progetto_db',
  user: process.env.DB_USER || 'progetto_user',
  password: process.env.DB_PASSWORD || 'progetto_password'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Token non fornito' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token non valido' });
    req.user = user;
    next();
  });
};

const authorize = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Non autorizzato' });
    }
    next();
  };
};

// Initialize database
const initDB = async () => {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        phone VARCHAR(50),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(7) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS technicians (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        specialization VARCHAR(255),
        color VARCHAR(7) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        progress INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS activity_technicians (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER REFERENCES activities(id) ON DELETE CASCADE,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(activity_id, technician_id)
      );
    `);

    // Create default admin user if not exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@progetto.io']);
    if (userCheck.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (email, password, name, role, phone) VALUES ($1, $2, $3, $4, $5)',
        ['admin@progetto.io', hashedPassword, 'Admin User', 'admin', '+39 123 456 7890']
      );
    }

    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, email, password, role, name, phone, technician_id FROM users WHERE email = $1 AND active = true',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Email o password non validi' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ message: 'Email o password non validi' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        technician_id: user.technician_id
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Errore durante il login' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, phone FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Errore durante il recupero dell\'utente' });
  }
});

// PROJECTS
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Errore durante il recupero dei progetti' });
  }
});

app.post('/api/projects', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { code, name, color } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO projects (code, name, color) VALUES ($1, $2, $3) RETURNING *',
      [code, name, color || '#3b82f6']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Errore durante la creazione del progetto' });
  }
});

app.put('/api/projects/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { code, name, color } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE projects SET code = $1, name = $2, color = $3 WHERE id = $4 RETURNING *',
      [code, name, color, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento del progetto' });
  }
});

app.delete('/api/projects/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    res.json({ message: 'Progetto eliminato' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Errore durante l\'eliminazione del progetto' });
  }
});

// ACTIVITIES - CON TECNICI MULTIPLI
app.get('/api/activities', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.*,
        COALESCE(
          json_agg(
            json_build_object('id', t.id, 'name', t.name)
          ) FILTER (WHERE t.id IS NOT NULL),
          '[]'
        ) as technicians
      FROM activities a
      LEFT JOIN activity_technicians at ON a.id = at.activity_id
      LEFT JOIN technicians t ON at.technician_id = t.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ message: 'Errore durante il recupero delle attività' });
  }
});

app.post('/api/activities', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { name, project_id, technician_ids, start_date, end_date, progress } = req.body;

console.log('POST /api/activities - Body:', req.body);
  console.log('Technician IDs:', technician_ids);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Crea l'attività
    const result = await client.query(
      'INSERT INTO activities (name, project_id, start_date, end_date, progress) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, project_id, start_date, end_date, progress || 0]
    );
    
    const activity = result.rows[0];
    
    // Associa i tecnici
    if (technician_ids && technician_ids.length > 0) {
      for (const tech_id of technician_ids) {
        await client.query(
          'INSERT INTO activity_technicians (activity_id, technician_id) VALUES ($1, $2)',
          [activity.id, tech_id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.status(201).json(activity);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating activity:', error);
    res.status(500).json({ message: 'Errore durante la creazione dell\'attività' });
  } finally {
    client.release();
  }
});

app.put('/api/activities/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { name, project_id, technician_ids, start_date, end_date, progress } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Aggiorna l'attività
    const result = await client.query(
      'UPDATE activities SET name = $1, project_id = $2, start_date = $3, end_date = $4, progress = $5 WHERE id = $6 RETURNING *',
      [name, project_id, start_date, end_date, progress, id]
    );
    
    // Rimuovi vecchie associazioni
    await client.query('DELETE FROM activity_technicians WHERE activity_id = $1', [id]);
    
    // Aggiungi nuove associazioni
    if (technician_ids && technician_ids.length > 0) {
      for (const tech_id of technician_ids) {
        await client.query(
          'INSERT INTO activity_technicians (activity_id, technician_id) VALUES ($1, $2)',
          [id, tech_id]
        );
      }
    }
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'attività' });
  } finally {
    client.release();
  }
});

app.delete('/api/activities/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM activities WHERE id = $1', [id]);
    res.json({ message: 'Attività eliminata' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'attività' });
  }
});

// TECHNICIANS
app.get('/api/technicians', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM technicians ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching technicians:', error);
    res.status(500).json({ message: 'Errore durante il recupero dei tecnici' });
  }
});

app.post('/api/technicians', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { name, email, phone, specialization, color } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Crea il tecnico
    const techResult = await client.query(
      'INSERT INTO technicians (name, email, phone, specialization, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, email, phone, specialization, color || '#3b82f6']
    );
    
    const technician = techResult.rows[0];
    
    // Crea automaticamente utente viewer associato
    const defaultPassword = 'password123'; // Password di default
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    await client.query(
      'INSERT INTO users (email, password, name, role, phone, technician_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [email, hashedPassword, name, 'viewer', phone, technician.id]
    );
    
    await client.query('COMMIT');
    res.status(201).json(technician);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating technician:', error);
    res.status(500).json({ message: 'Errore durante la creazione del tecnico' });
  } finally {
    client.release();
  }
});

app.put('/api/technicians/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, specialization, color } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE technicians SET name = $1, email = $2, phone = $3, specialization = $4, color = $5 WHERE id = $6 RETURNING *',
      [name, email, phone, specialization, color, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating technician:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento del tecnico' });
  }
});

app.delete('/api/technicians/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM technicians WHERE id = $1', [id]);
    res.json({ message: 'Tecnico eliminato' });
  } catch (error) {
    console.error('Error deleting technician:', error);
    res.status(500).json({ message: 'Errore durante l\'eliminazione del tecnico' });
  }
});

// USERS
app.get('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, phone, active, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Errore durante il recupero degli utenti' });
  }
});

app.post('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  const { email, password, name, role, phone } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, phone, active, created_at',
      [email, hashedPassword, name, role, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Errore durante la creazione dell\'utente' });
  }
});

app.put('/api/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, role } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, phone = $3, role = $4 WHERE id = $5 RETURNING id, email, name, role, phone, active, created_at',
      [name, email, phone, role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'utente' });
  }
});

app.delete('/api/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'Utente eliminato' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'utente' });
  }
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
