const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
// CORS limitato alle origini dichiarate. Con cors() senza opzioni qualsiasi
// sito poteva chiamare l'API dal browser di un utente autenticato.
// Vuoto = nessuna origine esterna ammessa (frontend e API stanno sullo stesso host).
const originiAmmesse = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);            // stesso host o strumenti da riga di comando
    if (!originiAmmesse.length) return cb(null, false);
    return cb(null, originiAmmesse.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
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

// Aree assegnate a un editor. Gli admin non hanno righe in user_countries:
// per loro il controllo non si applica.
const getUserCountries = async (userId) => {
  const r = await pool.query('SELECT country FROM user_countries WHERE user_id = $1', [userId]);
  return r.rows.map(x => x.country);
};

// Verifica che l'utente possa scrivere su una certa nazione.
// Va nel backend e non solo nell'interfaccia: nascondere un pulsante non
// impedisce a nessuno di chiamare l'API a mano.
const canWriteCountry = async (user, country) => {
  if (user.role === 'admin') return true;
  if (user.role !== 'editor') return false;
  const areas = await getUserCountries(user.id);
  if (areas.length === 0) return false; // editor senza aree: nessuna scrittura
  return areas.includes(country);
};

const countryOfProject = async (projectId) => {
  const r = await pool.query('SELECT country FROM projects WHERE id = $1', [projectId]);
  return r.rows[0]?.country || null;
};

const countryOfActivity = async (activityId) => {
  const r = await pool.query(
    'SELECT p.country FROM activities a JOIN projects p ON p.id = a.project_id WHERE a.id = $1',
    [activityId]
  );
  return r.rows[0]?.country || null;
};

// Scrive nel registro senza mai far fallire l'operazione principale:
// un problema nel log non deve impedire di salvare un progetto.
const logAudit = async (req, { action, entityType, entityId, entityLabel, country, details }) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, user_name, user_email, action, entity_type, entity_id, entity_label, country, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [req.user?.id || null, req.user?.name || null, req.user?.email || null,
       action, entityType, entityId || null, entityLabel || null, country || null,
       details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    console.error('Audit log non scritto:', e.message);
  }
};

// Confronta prima e dopo, tenendo solo i campi cambiati
const diffFields = (before, after, fields) => {
  const d = {};
  fields.forEach(f => {
    const b = before?.[f];
    const a = after?.[f];
    const norm = (v) => (v instanceof Date ? v.toISOString().split('T')[0] : v);
    if (String(norm(b) ?? '') !== String(norm(a) ?? '')) d[f] = [norm(b) ?? null, norm(a) ?? null];
  });
  return Object.keys(d).length ? d : null;
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

    // --- Migrazioni idempotenti ---
    // users.technician_id non e' nella CREATE TABLE ma viene letta dal login:
    // senza questa ALTER ogni installazione pulita fallisce con "column does not exist".
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS technician_id INTEGER REFERENCES technicians(id);
    `);

    // Multi-country: nazione del progetto, base del tecnico, aree assegnate agli editor.
    // Il backfill di projects.country dal prefisso del codice (es. "ES-0117" -> "ES")
    // gira SOLO alla creazione della colonna, per non sovrascrivere modifiche manuali.
    const hasCountry = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'projects' AND column_name = 'country'
    `);
    if (hasCountry.rows.length === 0) {
      await pool.query(`ALTER TABLE projects ADD COLUMN country CHAR(2) DEFAULT 'IT'`);
      await pool.query(`
        UPDATE projects
        SET country = UPPER(SUBSTRING(code FROM 1 FOR 2))
        WHERE code ~ '^[A-Za-z]{2}-'
      `);
      console.log('Migrazione: projects.country creata e popolata dal prefisso del codice');
    }

    await pool.query(`
      ALTER TABLE technicians ADD COLUMN IF NOT EXISTS home_country CHAR(2) DEFAULT 'IT';
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_countries (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        country CHAR(2) NOT NULL,
        PRIMARY KEY (user_id, country)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_projects_country ON projects(country);
    `);

    // Registro delle modifiche. Una riga per operazione di scrittura: pesa
    // circa 260 byte, quindi anche con uso intenso resta nell'ordine dei MB/anno.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        action VARCHAR(20) NOT NULL,
        entity_type VARCHAR(30) NOT NULL,
        entity_id INTEGER,
        entity_label VARCHAR(500),
        country CHAR(2),
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Assenze dei tecnici. Tabella separata dalle attivita': un'assenza non ha
    // progetto ne' avanzamento, e va trattata diversamente nei conflitti.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS technician_absences (
        id SERIAL PRIMARY KEY,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE CASCADE,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_half CHAR(2) DEFAULT 'AM',
        end_half CHAR(2) DEFAULT 'PM',
        type VARCHAR(20) NOT NULL DEFAULT 'vacation',
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Accesso dei tecnici senza password: un invito monouso attiva il dispositivo,
    // che da quel momento conserva un token. Niente password significa niente
    // recupero password, che senza un server di posta sarebbe impraticabile.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS technician_invites (
        id SERIAL PRIMARY KEY,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE CASCADE,
        code_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS technician_devices (
        id SERIAL PRIMARY KEY,
        technician_id INTEGER REFERENCES technicians(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        device_name VARCHAR(120),
        activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP,
        revoked_at TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token_hash);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_devices_tech  ON technician_devices(technician_id);
      CREATE INDEX IF NOT EXISTS idx_devices_token ON technician_devices(token_hash);
      CREATE INDEX IF NOT EXISTS idx_invites_tech  ON technician_invites(technician_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_absences_tech  ON technician_absences(technician_id);
      CREATE INDEX IF NOT EXISTS idx_absences_dates ON technician_absences(start_date, end_date);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_log(entity_type, entity_id);
    `);

    // Mezze giornate: start_half AM/PM indica se l'attivita' parte a inizio mattina
    // o dopo pranzo; end_half AM/PM se termina a mezzogiorno o a fine giornata.
    // Default = giornata intera, cosi' i dati esistenti restano validi.
    await pool.query(`
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_half CHAR(2) DEFAULT 'AM';
      ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_half CHAR(2) DEFAULT 'PM';
    `);

    // Indici: necessari con centinaia di progetti e migliaia di attivita'
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activities_project  ON activities(project_id);
      CREATE INDEX IF NOT EXISTS idx_activities_dates    ON activities(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_act_tech_technician ON activity_technicians(technician_id);
      CREATE INDEX IF NOT EXISTS idx_act_tech_activity   ON activity_technicians(activity_id);
    `);

    // Create default admin user if not exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', ['admin@progetto.io']);
    if (userCheck.rows.length === 0) {
      // La password iniziale si puo' impostare da .env. Senza, resta il valore
      // storico: il primo accesso avvisa comunque di cambiarla.
      const passwordIniziale = process.env.ADMIN_PASSWORD || 'admin123';
      const hashedPassword = await bcrypt.hash(passwordIniziale, 10);
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

// Validazione date attivita': il form e' cosmetico, l'API va protetta comunque.
// Tutto il calcolo avviene in unita' di MEZZA GIORNATA: un giorno vale 2 unita'.
// Cosi' un intervento che finisce martedi' mattina e uno che inizia martedi'
// pomeriggio non risultano sovrapposti.
const halfDayUnit = (dateStr, half, isEnd) => {
  const days = Math.floor(new Date(dateStr).getTime() / 86400000);
  if (isEnd) return days * 2 + (half === 'AM' ? 0 : 1);
  return days * 2 + (half === 'PM' ? 1 : 0);
};

const validateActivityDates = (start_date, end_date, start_half, end_half) => {
  if (!start_date || !end_date) return 'Data di inizio e data di fine sono obbligatorie';
  const s = new Date(start_date);
  const e = new Date(end_date);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 'Formato data non valido';

  const sh = start_half === 'PM' ? 'PM' : 'AM';
  const eh = end_half === 'AM' ? 'AM' : 'PM';
  if (halfDayUnit(end_date, eh, true) < halfDayUnit(start_date, sh, false)) {
    return 'La fine non puo\' precedere l\'inizio';
  }
  return null;
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Senza un limite, la password predefinita si indovina in pochi minuti.
  // Il conteggio e' per indirizzo IP e si azzera dopo un accesso riuscito.
  const chiave = 'login:' + (req.ip || 'x');
  if (tooManyAttempts(chiave, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ message: 'Troppi tentativi. Riprova fra qualche minuto.' });
  }

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
    
    clearAttempts(chiave);

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
    
    const me = result.rows[0];
    const areas = await getUserCountries(me.id);
    res.json({ ...me, countries: areas });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Errore durante il recupero dell\'utente' });
  }
});

// PROJECTS
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY country, code');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Errore durante il recupero dei progetti' });
  }
});

app.post('/api/projects', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { code, name, color, country } = req.body;
  const cc = (country || 'IT').toUpperCase();

  if (!(await canWriteCountry(req.user, cc))) {
    return res.status(403).json({ message: `Non puoi creare progetti per la nazione ${cc}` });
  }

  try {
    const result = await pool.query(
      'INSERT INTO projects (code, name, color, country) VALUES ($1, $2, $3, $4) RETURNING *',
      [code, name, color || '#3b82f6', cc]
    );
    const p = result.rows[0];
    await logAudit(req, {
      action: 'create', entityType: 'project', entityId: p.id,
      entityLabel: `${p.code} - ${p.name}`, country: p.country,
    });
    res.status(201).json(p);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Errore durante la creazione del progetto' });
  }
});

app.put('/api/projects/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { code, name, color, country } = req.body;

  try {
    const prev = (await pool.query('SELECT * FROM projects WHERE id = $1', [id])).rows[0];
    if (!prev) return res.status(404).json({ message: 'Progetto non trovato' });

    // Serve il permesso sia sulla nazione attuale sia su quella di destinazione:
    // altrimenti si potrebbe spostare un progetto fuori dalla propria area.
    if (!(await canWriteCountry(req.user, prev.country))) {
      return res.status(403).json({ message: `Non puoi modificare progetti della nazione ${prev.country}` });
    }
    const newCC = country ? country.toUpperCase() : prev.country;
    if (newCC !== prev.country && !(await canWriteCountry(req.user, newCC))) {
      return res.status(403).json({ message: `Non puoi spostare il progetto nella nazione ${newCC}` });
    }

    const result = await pool.query(
      'UPDATE projects SET code = $1, name = $2, color = $3, country = COALESCE($4, country) WHERE id = $5 RETURNING *',
      [code, name, color, country ? country.toUpperCase() : null, id]
    );
    const p = result.rows[0];
    const details = diffFields(prev, p, ['code', 'name', 'color', 'country']);
    await logAudit(req, {
      action: 'update', entityType: 'project', entityId: p.id,
      entityLabel: `${p.code} - ${p.name}`, country: p.country, details,
    });
    res.json(p);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento del progetto' });
  }
});

app.delete('/api/projects/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;

  try {
    const prev = (await pool.query('SELECT * FROM projects WHERE id = $1', [id])).rows[0];
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (prev) {
      await logAudit(req, {
        action: 'delete', entityType: 'project', entityId: prev.id,
        entityLabel: `${prev.code} - ${prev.name}`, country: prev.country,
      });
    }
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
  const { name, project_id, technician_ids, start_date, end_date, progress, start_half, end_half } = req.body;
  const sHalf = start_half === 'PM' ? 'PM' : 'AM';
  const eHalf = end_half === 'AM' ? 'AM' : 'PM';

  const dateError = validateActivityDates(start_date, end_date, sHalf, eHalf);
  if (dateError) {
    return res.status(400).json({ message: dateError });
  }

  const cc = await countryOfProject(project_id);
  if (!(await canWriteCountry(req.user, cc))) {
    return res.status(403).json({ message: `Non puoi creare attività per la nazione ${cc || '—'}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Crea l'attività
    const result = await client.query(
      'INSERT INTO activities (name, project_id, start_date, end_date, progress, start_half, end_half) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, project_id, start_date, end_date, progress || 0, sHalf, eHalf]
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
    await logAudit(req, {
      action: 'create', entityType: 'activity', entityId: activity.id,
      entityLabel: activity.name, country: cc,
      details: { start_date, end_date, technicians: (technician_ids || []).length },
    });
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
  const { name, project_id, technician_ids, start_date, end_date, progress, start_half, end_half } = req.body;
  const sHalf = start_half === 'PM' ? 'PM' : 'AM';
  const eHalf = end_half === 'AM' ? 'AM' : 'PM';

  const dateError = validateActivityDates(start_date, end_date, sHalf, eHalf);
  if (dateError) {
    return res.status(400).json({ message: dateError });
  }

  // Serve il permesso sia sul progetto attuale sia su quello di destinazione
  const prevCC = await countryOfActivity(id);
  const newCC = await countryOfProject(project_id);
  if (!(await canWriteCountry(req.user, prevCC))) {
    return res.status(403).json({ message: `Non puoi modificare attività della nazione ${prevCC || '—'}` });
  }
  if (newCC !== prevCC && !(await canWriteCountry(req.user, newCC))) {
    return res.status(403).json({ message: `Non puoi spostare l'attività nella nazione ${newCC || '—'}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Aggiorna l'attività
    const result = await client.query(
      'UPDATE activities SET name = $1, project_id = $2, start_date = $3, end_date = $4, progress = $5, start_half = $6, end_half = $7 WHERE id = $8 RETURNING *',
      [name, project_id, start_date, end_date, progress, sHalf, eHalf, id]
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
    const upd = result.rows[0];
    await logAudit(req, {
      action: 'update', entityType: 'activity', entityId: upd.id,
      entityLabel: upd.name, country: newCC,
      details: { start_date: upd.start_date, end_date: upd.end_date, progress: upd.progress },
    });
    res.json(upd);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating activity:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'attività' });
  } finally {
    client.release();
  }
});

app.delete('/api/activities/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;

  try {
    const prev = (await pool.query(
      `SELECT a.*, p.country, p.code AS project_code
       FROM activities a LEFT JOIN projects p ON p.id = a.project_id
       WHERE a.id = $1`, [id])).rows[0];
    if (!prev) return res.status(404).json({ message: 'Attività non trovata' });

    if (!(await canWriteCountry(req.user, prev.country))) {
      return res.status(403).json({ message: `Non puoi eliminare attività della nazione ${prev.country}` });
    }

    await pool.query('DELETE FROM activities WHERE id = $1', [id]);
    await logAudit(req, {
      action: 'delete', entityType: 'activity', entityId: prev.id,
      entityLabel: `${prev.project_code || '—'} / ${prev.name}`, country: prev.country,
      details: { start_date: prev.start_date, end_date: prev.end_date },
    });
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
    // Password provvisoria diversa per ogni utente creato: una uguale per tutti
    // e' nota a chiunque abbia visto il codice.
    const defaultPassword = crypto.randomBytes(9).toString('base64url');
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
// ---------------------------------------------------------------------------
// Posta elettronica (facoltativa)
// Senza SMTP_HOST la funzione resta spenta e l'interfaccia non mostra il
// recupero password: meglio un'opzione assente che una che fallisce.
// ---------------------------------------------------------------------------
const mailEnabled = Boolean(process.env.SMTP_HOST);

const mailer = mailEnabled ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: String(process.env.SMTP_SECURE) === 'true',   // true solo per la porta 465
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
}) : null;

const sendMail = async ({ to, subject, text }) => {
  if (!mailer) throw new Error('SMTP non configurato');
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to, subject, text,
  });
};

const APP_VERSION = require('./package.json').version;

app.get('/api/config', (req, res) => {
  // L'interfaccia usa questo per sapere quali funzioni mostrare e per
  // confrontare la versione installata con l'ultima pubblicata.
  res.json({ mailEnabled, version: APP_VERSION });
});

// ---------------------------------------------------------------------------
// Limite ai tentativi
// In memoria: al riavvio i contatori si azzerano, ed e' accettabile. Bloccare
// un attacco a forza bruta non richiede di ricordarlo per sempre.
// ---------------------------------------------------------------------------
const attempts = new Map();

const tooManyAttempts = (key, max, windowMs) => {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now - e.first > windowMs) {
    attempts.set(key, { n: 1, first: now });
    return false;
  }
  e.n += 1;
  return e.n > max;
};

const clearAttempts = (key) => attempts.delete(key);

// Pulizia periodica: senza, la mappa crescerebbe indefinitamente
setInterval(() => {
  const now = Date.now();
  attempts.forEach((v, k) => { if (now - v.first > 3600000) attempts.delete(k); });
}, 600000).unref();

// ---------------------------------------------------------------------------
// Recupero password
// ---------------------------------------------------------------------------
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!mailEnabled) return res.status(503).json({ message: 'Recupero password non disponibile' });

  if (tooManyAttempts('forgot:' + (req.ip || 'x'), 5, 3600000)) {
    return res.status(429).json({ message: 'Troppe richieste, riprova più tardi' });
  }

  // La risposta e' sempre la stessa, anche se l'indirizzo non esiste:
  // altrimenti questa pagina direbbe a chiunque chi ha un account.
  const risposta = { message: 'Se l\'indirizzo è registrato, riceverai un\'email con le istruzioni' };

  try {
    const u = (await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND active = true', [email])).rows[0];
    if (!u) return res.json(risposta);

    const token = crypto.randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + 3600 * 1000);   // un'ora
    await pool.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND used_at IS NULL', [u.id]);
    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
      [u.id, sha256(token), expires]);

    const base = process.env.APP_URL || '';
    await sendMail({
      to: u.email,
      subject: 'Progetto.io — reimposta la password',
      text: `Ciao ${u.name || ''},\n\n`
          + `hai chiesto di reimpostare la password di Progetto.io.\n`
          + `Apri questo indirizzo entro un'ora:\n\n${base}/?reset=${token}\n\n`
          + `Se non sei stato tu, ignora questo messaggio: la password resta invariata.\n`,
    });
    res.json(risposta);
  } catch (error) {
    console.error('Errore invio recupero password:', error.message);
    // Anche in caso di errore la risposta non cambia
    res.json(risposta);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ message: 'Dati mancanti' });
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'La password deve avere almeno 8 caratteri' });
  }
  try {
    const r = (await pool.query(
      `SELECT * FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [sha256(token)])).rows[0];
    if (!r) return res.status(400).json({ message: 'Link non valido o scaduto' });

    await pool.query('UPDATE users SET password = $1 WHERE id = $2',
      [await bcrypt.hash(password, 10), r.user_id]);
    await pool.query('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [r.id]);

    res.json({ message: 'Password aggiornata' });
  } catch (error) {
    console.error('Errore reset password:', error);
    res.status(500).json({ message: 'Errore durante il reimposta password' });
  }
});

// ---------------------------------------------------------------------------
// Accesso dei tecnici (PWA)
// Il codice e il token viaggiano in chiaro una sola volta e sul database
// restano solo gli hash: chi legge le tabelle non puo' impersonare nessuno.
// ---------------------------------------------------------------------------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const INVITE_HOURS = 72;

// Genera un invito monouso per un tecnico
app.post('/api/technicians/:id/invite', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  try {
    const tech = (await pool.query('SELECT id, name FROM technicians WHERE id = $1', [id])).rows[0];
    if (!tech) return res.status(404).json({ message: 'Tecnico non trovato' });

    // Gli inviti precedenti non ancora usati decadono: uno solo valido per volta
    await pool.query(
      'UPDATE technician_invites SET used_at = CURRENT_TIMESTAMP WHERE technician_id = $1 AND used_at IS NULL',
      [id]);

    const code = crypto.randomBytes(24).toString('base64url');
    const expires = new Date(Date.now() + INVITE_HOURS * 3600 * 1000);
    await pool.query(
      'INSERT INTO technician_invites (technician_id, code_hash, expires_at, created_by) VALUES ($1,$2,$3,$4)',
      [id, sha256(code), expires, req.user.id]);

    await logAudit(req, {
      action: 'create', entityType: 'invite', entityId: Number(id),
      entityLabel: tech.name, details: { expires_at: expires.toISOString() },
    });

    // Il codice in chiaro esiste solo in questa risposta
    res.status(201).json({ code, expires_at: expires, technician: tech.name });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ message: 'Errore durante la creazione dell\'invito' });
  }
});

// Invio dell'invito per email. Il link copiabile resta comunque disponibile:
// funziona sempre, anche senza SMTP.
app.post('/api/technicians/:id/invite-email', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  if (!mailEnabled) return res.status(503).json({ message: 'Invio email non disponibile' });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ message: 'Codice mancante' });

  try {
    const tech = (await pool.query('SELECT name, email FROM technicians WHERE id = $1', [req.params.id])).rows[0];
    if (!tech) return res.status(404).json({ message: 'Tecnico non trovato' });
    if (!tech.email) return res.status(400).json({ message: 'Il tecnico non ha un indirizzo email' });

    const base = process.env.APP_URL || '';
    await sendMail({
      to: tech.email,
      subject: 'Progetto.io — attiva l\'app sul telefono',
      text: `Ciao ${tech.name},\n\n`
          + `apri questo indirizzo dal telefono per attivare l'app con le tue attività:\n\n`
          + `${base}/technician/#${code}\n\n`
          + `Il link vale 72 ore e può essere usato una sola volta.\n`
          + `Dopo l'attivazione potrai aggiungere l'app alla schermata iniziale.\n`,
    });
    await logAudit(req, {
      action: 'create', entityType: 'invite', entityId: Number(req.params.id),
      entityLabel: `${tech.name} (email)`,
    });
    res.json({ message: 'Invito inviato a ' + tech.email });
  } catch (error) {
    console.error('Errore invio invito:', error.message);
    res.status(500).json({ message: 'Invio non riuscito: ' + error.message });
  }
});

// Dispositivi attivi di un tecnico
app.get('/api/technicians/:id/devices', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, device_name, activated_at, last_seen, revoked_at
       FROM technician_devices WHERE technician_id = $1 ORDER BY activated_at DESC`,
      [req.params.id]);
    res.json(r.rows);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ message: 'Errore durante il recupero dei dispositivi' });
  }
});

// Revoca di un dispositivo: il telefono smarrito perde subito l'accesso
app.delete('/api/tech-devices/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  try {
    const d = (await pool.query(
      `SELECT d.*, t.name AS technician_name FROM technician_devices d
       JOIN technicians t ON t.id = d.technician_id WHERE d.id = $1`, [req.params.id])).rows[0];
    if (!d) return res.status(404).json({ message: 'Dispositivo non trovato' });
    await pool.query('UPDATE technician_devices SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    await logAudit(req, {
      action: 'delete', entityType: 'device', entityId: d.id,
      entityLabel: `${d.technician_name} — ${d.device_name || 'dispositivo'}`,
    });
    res.json({ message: 'Dispositivo revocato' });
  } catch (error) {
    console.error('Error revoking device:', error);
    res.status(500).json({ message: 'Errore durante la revoca' });
  }
});

// --- Endpoint pubblici usati dalla PWA ---

// Attivazione: scambia il codice dell'invito con un token di dispositivo
app.post('/api/tech/activate', async (req, res) => {
  const { code, device_name } = req.body || {};
  if (!code) return res.status(400).json({ message: 'Codice mancante' });

  try {
    const inv = (await pool.query(
      `SELECT * FROM technician_invites
       WHERE code_hash = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP`,
      [sha256(code)])).rows[0];
    if (!inv) return res.status(401).json({ message: 'Codice non valido o scaduto' });

    const token = crypto.randomBytes(32).toString('base64url');
    const dev = (await pool.query(
      'INSERT INTO technician_devices (technician_id, token_hash, device_name) VALUES ($1,$2,$3) RETURNING id',
      [inv.technician_id, sha256(token), (device_name || '').slice(0, 120) || 'Dispositivo'])).rows[0];

    await pool.query('UPDATE technician_invites SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [inv.id]);

    const tech = (await pool.query(
      'SELECT id, name, home_country FROM technicians WHERE id = $1', [inv.technician_id])).rows[0];

    res.json({ token, technician: tech, device_id: dev.id });
  } catch (error) {
    console.error('Error activating device:', error);
    res.status(500).json({ message: 'Errore durante l\'attivazione' });
  }
});

// Riconosce il dispositivo dal token
const authenticateDevice = async (req, res, next) => {
  const token = req.headers['x-device-token'];
  if (!token) return res.status(401).json({ message: 'Dispositivo non riconosciuto' });
  try {
    const d = (await pool.query(
      `SELECT d.*, t.name, t.home_country, t.color
       FROM technician_devices d JOIN technicians t ON t.id = d.technician_id
       WHERE d.token_hash = $1 AND d.revoked_at IS NULL`, [sha256(token)])).rows[0];
    if (!d) return res.status(401).json({ message: 'Accesso revocato' });
    // Traccia l'ultimo accesso senza bloccare la risposta
    pool.query('UPDATE technician_devices SET last_seen = CURRENT_TIMESTAMP WHERE id = $1', [d.id])
      .catch(() => {});
    req.device = d;
    next();
  } catch (error) {
    console.error('Device auth error:', error);
    res.status(500).json({ message: 'Errore di autenticazione' });
  }
};

// Agenda personale: solo lettura, solo le proprie attivita'
app.get('/api/tech/agenda', authenticateDevice, async (req, res) => {
  const { from, to } = req.query;
  const params = [req.device.technician_id];
  let range = '';
  if (from && to) {
    params.push(to, from);
    range = `AND a.start_date <= $${params.length - 1} AND a.end_date >= $${params.length}`;
  }
  try {
    const acts = await pool.query(
      `SELECT a.id, a.name, a.start_date, a.end_date, a.start_half, a.end_half, a.progress,
              p.code AS project_code, p.name AS project_name, p.color AS project_color, p.country
       FROM activities a
       JOIN activity_technicians at ON at.activity_id = a.id
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE at.technician_id = $1 ${range}
       ORDER BY a.start_date`, params);

    const abs = await pool.query(
      `SELECT id, start_date, end_date, start_half, end_half, type, note
       FROM technician_absences WHERE technician_id = $1 ORDER BY start_date`,
      [req.device.technician_id]);

    // I colleghi assegnati alle stesse attivita': serve sapere con chi si lavora
    const mates = await pool.query(
      `SELECT DISTINCT at2.activity_id, t.name, t.color
       FROM activity_technicians at1
       JOIN activity_technicians at2 ON at2.activity_id = at1.activity_id
       JOIN technicians t ON t.id = at2.technician_id
       WHERE at1.technician_id = $1 AND at2.technician_id <> $1`,
      [req.device.technician_id]);

    const byAct = {};
    mates.rows.forEach(m => {
      (byAct[m.activity_id] = byAct[m.activity_id] || []).push({ name: m.name, color: m.color });
    });

    res.json({
      technician: { id: req.device.technician_id, name: req.device.name,
                    home_country: req.device.home_country, color: req.device.color },
      activities: acts.rows.map(a => ({ ...a, mates: byAct[a.id] || [] })),
      absences: abs.rows,
    });
  } catch (error) {
    console.error('Error fetching agenda:', error);
    res.status(500).json({ message: 'Errore durante il recupero dell\'agenda' });
  }
});

// ---------------------------------------------------------------------------
// Assenze dei tecnici
// I tecnici sono un pool globale, quindi le assenze non seguono il vincolo di
// nazione: chiunque possa scrivere (admin o editor) puo' registrarle.
// ---------------------------------------------------------------------------
app.get('/api/absences', authenticateToken, async (req, res) => {
  const { technician_id, from, to } = req.query;
  const where = [];
  const params = [];
  if (technician_id) { params.push(technician_id); where.push(`a.technician_id = $${params.length}`); }
  if (from && to) {
    params.push(to, from);
    where.push(`a.start_date <= $${params.length - 1} AND a.end_date >= $${params.length}`);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  try {
    const r = await pool.query(
      `SELECT a.*, t.name AS technician_name, t.color AS technician_color, t.home_country
       FROM technician_absences a
       JOIN technicians t ON t.id = a.technician_id
       ${clause}
       ORDER BY a.start_date DESC`, params);
    res.json(r.rows);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({ message: 'Errore durante il recupero delle assenze' });
  }
});

app.post('/api/absences', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { technician_id, start_date, end_date, start_half, end_half, type, note } = req.body;
  const sHalf = start_half === 'PM' ? 'PM' : 'AM';
  const eHalf = end_half === 'AM' ? 'AM' : 'PM';

  const dateError = validateActivityDates(start_date, end_date, sHalf, eHalf);
  if (dateError) return res.status(400).json({ message: dateError });
  if (!technician_id) return res.status(400).json({ message: 'Tecnico obbligatorio' });

  try {
    const r = await pool.query(
      `INSERT INTO technician_absences (technician_id, start_date, end_date, start_half, end_half, type, note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [technician_id, start_date, end_date, sHalf, eHalf, type || 'vacation', note || null, req.user.id]
    );
    const a = r.rows[0];
    const tech = (await pool.query('SELECT name FROM technicians WHERE id = $1', [technician_id])).rows[0];
    await logAudit(req, {
      action: 'create', entityType: 'absence', entityId: a.id,
      entityLabel: `${tech?.name || '—'} — ${a.type}`,
      details: { start_date: a.start_date, end_date: a.end_date, type: a.type },
    });
    res.status(201).json(a);
  } catch (error) {
    console.error('Error creating absence:', error);
    res.status(500).json({ message: 'Errore durante la creazione dell\'assenza' });
  }
});

app.put('/api/absences/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { technician_id, start_date, end_date, start_half, end_half, type, note } = req.body;
  const sHalf = start_half === 'PM' ? 'PM' : 'AM';
  const eHalf = end_half === 'AM' ? 'AM' : 'PM';

  const dateError = validateActivityDates(start_date, end_date, sHalf, eHalf);
  if (dateError) return res.status(400).json({ message: dateError });

  try {
    const r = await pool.query(
      `UPDATE technician_absences
       SET technician_id = $1, start_date = $2, end_date = $3, start_half = $4, end_half = $5, type = $6, note = $7
       WHERE id = $8 RETURNING *`,
      [technician_id, start_date, end_date, sHalf, eHalf, type || 'vacation', note || null, id]
    );
    if (!r.rows.length) return res.status(404).json({ message: 'Assenza non trovata' });
    const a = r.rows[0];
    await logAudit(req, {
      action: 'update', entityType: 'absence', entityId: a.id,
      entityLabel: `#${a.id}`,
      details: { start_date: a.start_date, end_date: a.end_date, type: a.type },
    });
    res.json(a);
  } catch (error) {
    console.error('Error updating absence:', error);
    res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'assenza' });
  }
});

app.delete('/api/absences/:id', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  try {
    const prev = (await pool.query(
      `SELECT a.*, t.name AS technician_name FROM technician_absences a
       JOIN technicians t ON t.id = a.technician_id WHERE a.id = $1`, [id])).rows[0];
    if (!prev) return res.status(404).json({ message: 'Assenza non trovata' });
    await pool.query('DELETE FROM technician_absences WHERE id = $1', [id]);
    await logAudit(req, {
      action: 'delete', entityType: 'absence', entityId: prev.id,
      entityLabel: `${prev.technician_name} — ${prev.type}`,
      details: { start_date: prev.start_date, end_date: prev.end_date },
    });
    res.json({ message: 'Assenza eliminata' });
  } catch (error) {
    console.error('Error deleting absence:', error);
    res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'assenza' });
  }
});

// Duplica un progetto con tutte le sue attivita', traslate di N giorni.
// Gli interventi si somigliano fra loro: rifare a mano dieci attivita' ogni
// volta e' il tipo di lavoro che fa abbandonare uno strumento.
app.post('/api/projects/:id/duplicate', authenticateToken, authorize(['admin', 'editor']), async (req, res) => {
  const { id } = req.params;
  const { code, name, shift_days, country } = req.body;
  const shift = parseInt(shift_days) || 0;

  const client = await pool.connect();
  try {
    const src = (await client.query('SELECT * FROM projects WHERE id = $1', [id])).rows[0];
    if (!src) return res.status(404).json({ message: 'Progetto non trovato' });

    const newCC = (country || src.country || 'IT').toUpperCase();
    if (!(await canWriteCountry(req.user, src.country))) {
      return res.status(403).json({ message: `Non puoi duplicare progetti della nazione ${src.country}` });
    }
    if (!(await canWriteCountry(req.user, newCC))) {
      return res.status(403).json({ message: `Non puoi creare progetti per la nazione ${newCC}` });
    }

    await client.query('BEGIN');

    const np = (await client.query(
      'INSERT INTO projects (code, name, color, country) VALUES ($1,$2,$3,$4) RETURNING *',
      [code || `${src.code}-COPY`, name || `${src.name} (copia)`, src.color, newCC]
    )).rows[0];

    const acts = (await client.query(
      'SELECT * FROM activities WHERE project_id = $1 ORDER BY start_date', [id])).rows;

    for (const a of acts) {
      const na = (await client.query(
        `INSERT INTO activities (name, project_id, start_date, end_date, progress, start_half, end_half)
         VALUES ($1,$2,$3::date + $4::int,$5::date + $4::int,0,$6,$7) RETURNING id`,
        [a.name, np.id, a.start_date, shift, a.end_date, a.start_half, a.end_half]
      )).rows[0];

      // I tecnici si copiano: chi ha fatto l'intervento la volta scorsa e'
      // il candidato piu' probabile anche stavolta, e si cambia in un clic.
      const techs = (await client.query(
        'SELECT technician_id FROM activity_technicians WHERE activity_id = $1', [a.id])).rows;
      for (const tt of techs) {
        await client.query(
          'INSERT INTO activity_technicians (activity_id, technician_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [na.id, tt.technician_id]);
      }
    }

    await client.query('COMMIT');
    await logAudit(req, {
      action: 'create', entityType: 'project', entityId: np.id,
      entityLabel: `${np.code} - ${np.name}`, country: np.country,
      details: { duplicated_from: src.code, activities: acts.length, shift_days: shift },
    });
    res.status(201).json({ project: np, activities: acts.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error duplicating project:', error);
    res.status(500).json({ message: 'Errore durante la duplicazione' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// Backup e ripristino
// Formato JSON invece di pg_dump: non richiede il client PostgreSQL nel
// container del backend, ed e' leggibile e verificabile prima di ripristinarlo.
// ---------------------------------------------------------------------------
// L'ordine e' quello di inserimento: le dipendenze prima di chi le usa.
// user_countries non ha una colonna id (la chiave e' la coppia utente/nazione),
// quindi l'ordinamento va dichiarato tabella per tabella.
const BACKUP_TABLES = [
  { name: 'users',                orderBy: 'id' },
  { name: 'user_countries',       orderBy: 'user_id, country' },
  { name: 'technicians',          orderBy: 'id' },
  { name: 'projects',             orderBy: 'id' },
  { name: 'activities',           orderBy: 'id' },
  { name: 'activity_technicians', orderBy: 'id' },
  { name: 'technician_absences',  orderBy: 'id' },
];

app.get('/api/admin/backup', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const data = {};
    for (const { name, orderBy } of BACKUP_TABLES) {
      const r = await pool.query(`SELECT * FROM ${name} ORDER BY ${orderBy}`);
      data[name] = r.rows;
    }
    const payload = {
      format: 'progetto.io-backup',
      version: 1,
      created_at: new Date().toISOString(),
      created_by: req.user.email,
      counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
      data,
    };
    await logAudit(req, {
      action: 'backup', entityType: 'database', entityLabel: 'backup',
      details: payload.counts,
    });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader('Content-Disposition', `attachment; filename="progetto-backup-${stamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ message: 'Errore durante la creazione del backup' });
  }
});

app.post('/api/admin/restore', authenticateToken, authorize(['admin']), async (req, res) => {
  const payload = req.body;
  if (!payload || payload.format !== 'progetto.io-backup' || !payload.data) {
    return res.status(400).json({ message: 'File di backup non valido' });
  }

  // Non si ripristina sopra i dati vivi senza rete di sicurezza: prima si salva
  // lo stato attuale, cosi' un ripristino sbagliato resta rimediabile.
  const safety = {};
  try {
    for (const { name, orderBy } of BACKUP_TABLES) {
      safety[name] = (await pool.query(`SELECT * FROM ${name} ORDER BY ${orderBy}`)).rows;
    }
  } catch (e) {
    return res.status(500).json({ message: 'Impossibile salvare lo stato attuale, ripristino annullato' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ordine inverso per le dipendenze
    for (const { name } of [...BACKUP_TABLES].reverse()) {
      await client.query(`DELETE FROM ${name}`);
    }

    let inserted = 0;
    for (const { name: t } of BACKUP_TABLES) {
      const rows = payload.data[t] || [];
      for (const row of rows) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        const ph = cols.map((_, i) => `$${i + 1}`).join(',');
        await client.query(
          `INSERT INTO ${t} (${cols.map(x => `"${x}"`).join(',')}) VALUES (${ph})`,
          cols.map(x => row[x])
        );
        inserted++;
      }
      // Riallinea la sequenza, altrimenti i nuovi inserimenti collidono
      if (rows.length && 'id' in rows[0]) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`
        );
      }
    }

    await client.query('COMMIT');
    await logAudit(req, {
      action: 'restore', entityType: 'database', entityLabel: 'restore',
      details: { from: payload.created_at, rows: inserted },
    });
    res.json({ message: 'Ripristino completato', rows: inserted });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error restoring backup:', error);
    res.status(500).json({ message: 'Ripristino fallito, nessuna modifica applicata: ' + error.message });
  } finally {
    client.release();
  }
});

// Registro modifiche — solo admin, paginato
app.get('/api/audit', authenticateToken, authorize(['admin']), async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = parseInt(req.query.offset) || 0;
  const { entity_type, user_id, country } = req.query;

  const where = [];
  const params = [];
  if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
  if (user_id)     { params.push(user_id);     where.push(`user_id = $${params.length}`); }
  if (country)     { params.push(country);     where.push(`country = $${params.length}`); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const total = await pool.query(`SELECT COUNT(*)::int AS n FROM audit_log ${clause}`, params);
    params.push(limit, offset);
    const rows = await pool.query(
      `SELECT * FROM audit_log ${clause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ total: total.rows[0].n, rows: rows.rows });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ message: 'Errore durante il recupero del registro' });
  }
});

app.get('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, u.role, u.phone, u.active, u.created_at,
             COALESCE(ARRAY_AGG(uc.country) FILTER (WHERE uc.country IS NOT NULL), '{}') AS countries
      FROM users u
      LEFT JOIN user_countries uc ON uc.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Errore durante il recupero degli utenti' });
  }
});

app.post('/api/users', authenticateToken, authorize(['admin']), async (req, res) => {
  const { email, password, name, role, phone, countries } = req.body;

  if (!password || String(password).length < 8) {
    return res.status(400).json({ message: 'La password deve avere almeno 8 caratteri' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role, phone, active, created_at',
      [email, hashedPassword, name, role, phone]
    );
    const u = result.rows[0];
    if (Array.isArray(countries) && countries.length) {
      for (const cc of countries) {
        await pool.query('INSERT INTO user_countries (user_id, country) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [u.id, String(cc).toUpperCase()]);
      }
    }
    await logAudit(req, {
      action: 'create', entityType: 'user', entityId: u.id,
      entityLabel: `${u.name} (${u.email})`,
      details: { role: u.role, countries: countries || [] },
    });
    res.status(201).json({ ...u, countries: countries || [] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Errore durante la creazione dell\'utente' });
  }
});

app.put('/api/users/:id', authenticateToken, authorize(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, role, countries } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, phone = $3, role = $4 WHERE id = $5 RETURNING id, email, name, role, phone, active, created_at',
      [name, email, phone, role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    // Le aree si riscrivono per intero: piu' semplice e senza stati intermedi
    if (Array.isArray(countries)) {
      await pool.query('DELETE FROM user_countries WHERE user_id = $1', [id]);
      for (const cc of countries) {
        await pool.query('INSERT INTO user_countries (user_id, country) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [id, String(cc).toUpperCase()]);
      }
    }

    const u = result.rows[0];
    await logAudit(req, {
      action: 'update', entityType: 'user', entityId: u.id,
      entityLabel: `${u.name} (${u.email})`,
      details: { role: u.role, countries: countries || null },
    });
    res.json({ ...u, countries: countries || [] });
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
