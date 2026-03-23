-- Schema completo per progetto.io

-- Tabella Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    phone VARCHAR(20),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Technicians
CREATE TABLE technicians (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    color VARCHAR(7) DEFAULT '#3498db',
    specialization VARCHAR(100),
    active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Projects
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_manager VARCHAR(100),
    status VARCHAR(20) DEFAULT 'planning',
    priority VARCHAR(10) DEFAULT 'medium',
    color VARCHAR(7) DEFAULT '#3498db',
    start_date DATE,
    end_date DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Activities
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    technician_id INTEGER REFERENCES technicians(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status VARCHAR(20) DEFAULT 'todo',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserisci utenti (password: admin123)
INSERT INTO users (email, password, name, role, phone, active) VALUES 
('admin@progetto.io', '$2a$10$sE/84Mplfygctwf8jy0dD.Vc3kNfslk3DvukgSlPH9PZ6nsASXeBC', 'Admin User', 'admin', '+39 123 456 7890', true),
('editor@progetto.io', '$2a$10$sE/84Mplfygctwf8jy0dD.Vc3kNfslk3DvukgSlPH9PZ6nsASXeBC', 'Editor User', 'editor', '+39 098 765 4321', true),
('viewer@progetto.io', '$2a$10$sE/84Mplfygctwf8jy0dD.Vc3kNfslk3DvukgSlPH9PZ6nsASXeBC', 'Viewer User', 'viewer', '+39 555 123 4567', true);

-- Inserisci tecnici
INSERT INTO technicians (name, email, phone, color, specialization) VALUES 
('Mario Rossi', 'mario.rossi@progetto.io', '+39 333 111 2222', '#ef4444', 'Backend Development'),
('Anna Verdi', 'anna.verdi@progetto.io', '+39 333 333 4444', '#3b82f6', 'Frontend Development'),
('Luca Bianchi', 'luca.bianchi@progetto.io', '+39 333 555 6666', '#10b981', 'Database Management');

-- Inserisci progetti
INSERT INTO projects (code, name, description, project_manager, status, priority, color, start_date, end_date) VALUES 
('P001', 'Sistema ERP', 'Sviluppo sistema ERP aziendale', 'Giovanni Russo', 'active', 'high', '#3b82f6', '2025-01-10', '2025-03-31'),
('P002', 'App Mobile', 'Applicazione mobile iOS/Android', 'Maria Conti', 'active', 'medium', '#10b981', '2025-01-15', '2025-04-30'),
('P003', 'E-commerce', 'Piattaforma e-commerce B2C', 'Paolo Verdi', 'planning', 'high', '#8b5cf6', '2025-02-01', '2025-05-31');

-- Inserisci attività
INSERT INTO activities (project_id, technician_id, name, description, start_date, end_date, progress, status) VALUES 
(1, 1, 'Analisi requisiti', 'Analisi dei requisiti del sistema ERP', '2025-01-13', '2025-01-15', 30, 'in_progress'),
(1, 2, 'Sviluppo backend', 'Sviluppo API REST', '2025-01-14', '2025-01-18', 20, 'in_progress'),
(2, 3, 'Design UI/UX', 'Progettazione interfaccia utente', '2025-01-13', '2025-01-16', 60, 'in_progress'),
(2, 1, 'Test unitari', 'Scrittura test unitari', '2025-01-16', '2025-01-17', 0, 'todo'),
(3, 2, 'Setup database', 'Configurazione database PostgreSQL', '2025-01-15', '2025-01-20', 10, 'todo');
