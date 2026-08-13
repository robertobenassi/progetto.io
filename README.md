# Progetto.io

Pianificazione di progetti e tecnici su più paesi, con diagramma di Gantt,
rilevamento dei conflitti di assegnazione, report e app per i tecnici sul campo.

Nato per il lavoro su impianti e cantieri, dove le squadre si spostano fra
sedi e nazioni diverse e sapere chi è dove conta più di ogni altra cosa.

## Cosa fa

- **Gantt** con vista per progetto o per tecnico, zoom settimana/mese
- **Mezze giornate**: un'attività può occupare solo le mattine o solo i pomeriggi
- **Giorni lavorativi**: indicando una durata, la data di fine salta riposi e festivi
- **Festivi per nazione**, calcolati automaticamente per 31 paesi o inseriti a mano
- **Conflitti** rilevati da soli: doppie assegnazioni e attività durante le assenze
- **Assenze** dei tecnici, anche a mezza giornata
- **Multi-paese**: ogni progetto ha una nazione, gli editor lavorano solo sulle proprie
- **Otto report** esportabili in CSV e stampabili in PDF
- **App per i tecnici**: ognuno vede le proprie attività dal telefono, senza password
- **Manutenzione**: backup, ripristino, registro modifiche, aggiornamenti
- Interfaccia in italiano, inglese, francese, spagnolo, tedesco e portoghese
- Tema chiaro e scuro

## Stack

React · Node.js/Express · PostgreSQL 15 · Caddy · Docker

Nessun servizio a pagamento, nessuna chiamata a server esterni, nessuna
telemetria. I dati restano sul server di chi installa.

---

## Installazione

### Requisiti

- Docker >= 24 e Docker Compose >= 2.20 (dal repository ufficiale Docker:
  il pacchetto `docker.io` di Debian è spesso obsoleto e senza Compose v2)
- **2 GB di RAM**: la compilazione del frontend è il passaggio più pesante
- Architettura x86. Su ARM le immagini fissate per digest non funzionano:
  sostituirle con i tag (`postgres:15-alpine`)

### 1. Clona e configura

```bash
git clone https://github.com/robertobenassi/progetto.io.git
cd progetto.io
cp .env.example .env
nano .env
```

Impostare almeno:

| Variabile | Note |
|---|---|
| `DB_PASSWORD` | password del database |
| `JWT_SECRET` | stringa casuale: `openssl rand -hex 32` |
| `APP_PORT` | porta locale, predefinita `8080` |
| `APP_BIND` | interfaccia di ascolto, predefinita `127.0.0.1` |

### 2. Avvia

```bash
docker compose up -d --build
```

L'applicazione risponde su `http://localhost:8080`.
Migrazioni del database e indici vengono applicati da soli all'avvio.

### 3. Primo accesso

- Utente: `admin@progetto.io`
- Password: `admin123` (o quella impostata in `ADMIN_PASSWORD`)

**Cambiare la password al primo accesso.**

### 4. Configurazione iniziale

1. **Manutenzione → Nazioni abilitate**: scegliere i paesi dove si lavora.
   Solo questi compariranno creando un progetto.
2. **Manutenzione → Festivi**: importare il calendario per ogni nazione e
   aggiungere ponti e chiusure aziendali.
3. **Tecnici**: inserire le persone.
4. **Utenti**: creare gli account e assegnare le aree agli editor.

---

## Reverse proxy e HTTPS

Il progetto **non gestisce i certificati**: si integra con il reverse proxy
che già usate. Il container `frontend` è l'unico punto d'ingresso — serve
l'applicazione, la PWA dei tecnici e inoltra `/api` al backend — quindi è
sufficiente puntarci il proprio proxy.

Al suo interno il frontend usa Caddy in HTTP semplice (`auto_https off`):
non tenta di ottenere certificati, quel compito resta al proxy davanti.

### Caddy (HTTPS automatico)

```caddyfile
progetti.esempio.com {
    reverse_proxy localhost:8080
    request_body {
        max_size 60MB
    }
}
```

### nginx

```nginx
server {
    server_name progetti.esempio.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 60M;
    }
}
```

### Proxy già in Docker

Se il proxy gira in un container, `localhost` per lui è il container stesso.
Conviene collegare le reti creando `docker-compose.override.yml`:

```yaml
services:
  frontend:
    networks:
      - internal
      - proxy

networks:
  proxy:
    external: true
```

Poi puntare il proxy a `progetto_frontend:80`.

### Perché l'ascolto è su 127.0.0.1

Il frontend è in ascolto solo su localhost. È voluto: se ascoltasse su tutte
le interfacce, l'applicazione sarebbe raggiungibile in HTTP sull'IP pubblico
scavalcando il reverse proxy — e le credenziali viaggerebbero in chiaro.

Solo se si usa l'applicazione in rete locale **senza** alcun proxy va
impostato `APP_BIND=0.0.0.0`.

### Nota su HTTPS

La PWA dei tecnici richiede **HTTPS** per installarsi sul telefono e per
registrare il service worker (l'unica eccezione è `localhost`). In produzione
il certificato è quindi necessario, non opzionale.

---

## App per i tecnici

Raggiungibile su `/technician/`. I tecnici **non hanno una password**: si
attivano una volta e il dispositivo resta collegato.

1. Nella scheda **Tecnici**, premere 📱 accanto alla persona
2. **Genera link di attivazione** e inviarlo (il link vale 72 ore ed è monouso)
3. Il tecnico lo apre dal telefono e conferma; poi può aggiungere l'app alla
   schermata iniziale

Il link in chiaro compare **una sola volta**: sul server ne resta solo
l'impronta. Se va perso se ne genera un altro, e il precedente decade.

Dalla stessa finestra si vedono i dispositivi attivi e si possono **revocare**.
I tecnici vedono soltanto le proprie attività, **in sola lettura**.

L'app funziona anche senza rete, mostrando l'ultima agenda scaricata.

---

## Ruoli

| | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Lettura di tutto | ✅ | ✅ | ✅ |
| Progetti e attività | ovunque | proprie nazioni | ❌ |
| Eliminare progetti | ✅ | ❌ | ❌ |
| Tecnici, assenze, festivi | ✅ | ✅ | ❌ |
| Utenti, nazioni, licenza | ✅ | ❌ | ❌ |
| Backup e ripristino | ✅ | ❌ | ❌ |

La lettura è sempre completa, per tutti: senza vedere tutti i progetti non si
vedrebbero i conflitti dei tecnici in trasferta. Le nazioni di un editor si
assegnano dalla scheda **Utenti**; un editor senza nazioni non può modificare
nulla.

---

## Backup

Da **Manutenzione**, accessibile ai soli amministratori. Il backup è un file
JSON con progetti, attività, tecnici, assenze, utenti e permessi: si può
aprire e controllare prima di usarlo.

Il ripristino **sostituisce tutti i dati** e avviene in una transazione unica —
se qualcosa fallisce non viene applicato nulla. Richiede di digitare `RESTORE`
per confermare.

Il file contiene le password in forma cifrata: va trattato come materiale
riservato.

Per una copia automatica notturna:

```bash
0 2 * * * docker exec progetto_db pg_dump -U progetto_user progetto_db | gzip > /backup/progetto-$(date +\%F).sql.gz
```

## Recupero dell'accesso

Se è configurato un server SMTP, la pagina di accesso mostra "Password
dimenticata". Altrimenti, da riga di comando sul server:

```bash
docker exec -it progetto_backend node reset-admin.js --list
docker exec -it progetto_backend node reset-admin.js indirizzo@esempio.it
```

Stampa una password provvisoria da cambiare al primo accesso. Aggiungendo
`--promote` la persona diventa amministratore, utile se l'unico admin ha
lasciato l'azienda.

---

## Posta elettronica (facoltativa)

Senza SMTP configurato il recupero password non compare e gli inviti ai
tecnici si condividono copiando il link. Impostando le variabili `SMTP_*` nel
file `.env` si abilitano entrambi.

Serve un mittente su un dominio proprio, con SPF e DKIM configurati: un
messaggio che finisce in spam è un utente bloccato fuori.

---

## Limiti noti

Verificato con 200 progetti, 150 tecnici e 2.000 attività.

| Volume | Comportamento |
|---|---|
| fino a ~300 progetti | fluido |
| 300–1.000 progetti | usabile, primo caricamento più lento su rete lenta |
| oltre 1.000 progetti | serve un'API paginata per periodo |

Il limite non è il database — che a questi numeri occupa pochi MB — ma il
fatto che l'interfaccia carica l'intero insieme di dati in una volta.

L'interfaccia principale è pensata per schermi da portatile in su. Sul telefono
si usa la PWA dei tecnici.

---

## Aggiornamento

```bash
git pull
docker compose up -d --build
```

Le migrazioni sono automatiche. Consigliato un backup prima di aggiornare.

In **Manutenzione → Aggiornamenti** si vede se esiste una versione più recente.

---

## Documentazione

| Documento | Contenuto |
|---|---|
| [MANUALE.md](MANUALE.md) | Manuale completo — italiano e inglese |
| [GUIDA.md](GUIDA.md) | Guida rapida all'uso — italiano e inglese |
| [PRIVACY.md](PRIVACY.md) | Dati trattati e verifiche per chi installa |

## Autore

**Roberto Benassi** — [robertobenassi.com](https://robertobenassi.com)

## Licenza

Uso non commerciale: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.it)

Per l'uso commerciale contattare l'autore. La licenza si registra in
**Manutenzione → Licenza** e viene verificata in locale, senza alcun contatto
con server esterni.
