# Progetto.io

Sistema di gestione progetti con Gantt chart, gestione tecnici, PWA mobile e tracciamento attività.

## Stack

- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL 15
- **Reverse proxy**: Caddy (HTTPS automatico)

## Requisiti

- Docker >= 24.0
- Docker Compose >= 2.20
- Un dominio puntato al server (per HTTPS automatico)

## Installazione

### 1. Clona il repository
```bash
git clone https://github.com/tuoutente/progetto.io.git
cd progetto.io
```

### 2. Configura le variabili d'ambiente
```bash
cp .env.example .env
nano .env
```

Modifica almeno:
- `DB_PASSWORD` → password sicura
- `JWT_SECRET` → stringa casuale lunga (es. `openssl rand -hex 32`)
- `CADDY_DOMAIN` → il tuo dominio (es. `progetto.miodominio.com`)

### 3. Avvia
```bash
docker compose --profile standalone up -d
```

Caddy otterrà automaticamente il certificato SSL. Apri `https://tuodominio.com`.

## Profili

| Profilo | Comando | Uso |
|---|---|---|
| `standalone` | `--profile standalone` | Server dedicato, Caddy gestisce 80/443 |
| _(nessuno)_ | _(senza profilo)_ | Hai già un reverse proxy (nginx, Traefik, ecc.) |

### Uso senza profilo (proxy esterno)

I servizi frontend e backend sono sulla rete interna Docker.
Punta il tuo reverse proxy a:
- Frontend: `progetto_frontend:80`
- API: `progetto_backend:5000`

## Credenziali default

Al primo avvio viene creato un utente amministratore:

- **Email**: `admin@progetto.io`
- **Password**: `admin123`

⚠️ Cambia la password al primo accesso.

## Backup database
```bash
docker exec progetto_db pg_dump -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql
```

## Aggiornamento
```bash
docker compose --profile standalone pull
docker compose --profile standalone up -d --build
```

## Autore

**Roberto Benassi**
[robertobenassi.com](https://robertobenassi.com)

## Licenza

Uso non commerciale: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.it)

Per uso commerciale contatta: [robertobenassi.com](https://robertobenassi.com)
