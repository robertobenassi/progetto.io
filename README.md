*[English version below](#english)*

# Progetto.io

Pianificazione di progetti e tecnici su più paesi: diagramma di Gantt,
rilevamento dei conflitti, report e app per i tecnici sul campo.

Nato per il lavoro su impianti e cantieri, dove le squadre si spostano fra sedi
e nazioni diverse e sapere chi è dove conta più di ogni altra cosa.

## Cosa fa

- **Gantt** per progetto o per tecnico, vista settimana o mese, con le barre piene solo nei giorni lavorati
- **Mezze giornate**: un'attività può occupare solo le mattine o solo i pomeriggi
- **Giorni lavorati**: riposi e festivi della nazione non si contano; ogni attività può avere la sua settimana lavorativa (per esempio dal lunedì al sabato) e un sabato lavorato si segna a parte
- **Festivi per nazione**, calcolati per 31 paesi o inseriti a mano
- **Conflitti** rilevati da soli sui giorni lavorati; le assenze tolgono i loro giorni e la copertura mostra chi manca
- **Assegnazioni a periodi**: un tecnico può lavorare solo su alcuni giorni di un'attività, anche in più periodi, impostati con una griglia delle presenze
- **Tecnici richiesti** per attività, con il fabbisogno dei giorni ancora scoperti
- **Giorni uomo venduti** per progetto o per fase, confrontati con quelli svolti
- **Assenze** dei tecnici, anche a mezza giornata
- **Multi-paese**: ogni progetto ha una nazione, gli editor lavorano sulle proprie
- **Undici report** esportabili in CSV e stampabili in PDF
- **App per i tecnici**: ognuno vede le proprie attività dal telefono, senza password
- **Archiviazione** dei lavori conclusi, che escono dal Gantt ma restano nei report
- **Manutenzione**: backup, ripristino, registro modifiche, aggiornamenti
- Interfaccia in italiano, inglese, francese, spagnolo, tedesco e portoghese
- Tema chiaro e scuro

## Stack

React · Node.js/Express · PostgreSQL 15 · Caddy · Docker

Non richiede abbonamenti né servizi di terze parti e non invia telemetria: i
dati restano sul server di chi installa. Oltre al server di posta, se lo si
configura, l'unico contatto esterno è il controllo giornaliero degli
aggiornamenti su GitHub, fatto dal browser dell'amministratore senza inviare
dati dell'applicazione. L'uso commerciale richiede una licenza: vedi
[Licenza](#licenza).

---

## Installazione

Due modi, a seconda di cosa avete già sul server.

| | Comando | Quando |
|---|---|---|
| **Autonomo** | `docker compose --profile standalone up -d` | Non avete un reverse proxy. Include Caddy, che ottiene e rinnova da sé il certificato HTTPS |
| **Con proxy esistente** | `docker compose up -d` | Avete già nginx, Traefik o Caddy. L'applicazione risponde su una porta locale, ci puntate il vostro proxy |

### Requisiti

- Docker >= 24 e Docker Compose >= 2.20, dal repository ufficiale Docker
  (i pacchetti delle distribuzioni sono spesso obsoleti e senza Compose v2)
- **2 GB di RAM**: servono a compilare il frontend durante l'installazione.
  A regime l'applicazione ne usa meno di 100 MB
- Architettura x86. Su ARM sostituire le immagini fissate per digest con i tag
  corrispondenti (`postgres:15-alpine`)

---

## Installazione autonoma

Per chi parte da un server pulito e vuole HTTPS senza configurare nulla.

### 1. Puntare il dominio

Nel pannello DNS del vostro dominio, creare un record `A` verso l'indirizzo IP
del server:

```
progetti.esempio.com    A    203.0.113.10
```

Con Cloudflare, per il primo rilascio del certificato lasciate il proxy
disattivato (nuvoletta grigia); potete riattivarlo dopo.

Le porte **80 e 443** devono essere raggiungibili da Internet: servono a
ottenere e rinnovare il certificato.

### 2. Scaricare e configurare

```bash
git clone https://github.com/robertobenassi/progetto.io.git
cd progetto.io
cp .env.example .env
nano .env
```

Impostare almeno:

| Variabile | Cosa metterci |
|---|---|
| `DB_PASSWORD` | una password qualsiasi, lunga |
| `JWT_SECRET` | una stringa casuale: `openssl rand -hex 32` |
| `ADMIN_EMAIL` | il vostro indirizzo, sarà il primo amministratore |
| `ADMIN_PASSWORD` | la password iniziale, almeno 8 caratteri |
| `DOMAIN` | il dominio scelto, per esempio `progetti.esempio.com` |
| `ACME_EMAIL` | un indirizzo per gli avvisi sul certificato |

Non esistono credenziali predefinite: senza `ADMIN_EMAIL` e `ADMIN_PASSWORD`
il programma si rifiuta di partire.

### 3. Avviare

```bash
docker compose --profile standalone up -d
```

La prima volta richiede qualche minuto: compila l'applicazione e ottiene il
certificato. Poi il sito risponde su `https://progetti.esempio.com`.

### 4. Entrare

Con le credenziali impostate nel `.env`. **Cambiare la password** cliccando sul
proprio nome in alto a destra.

---

## Installazione con un proxy esistente

### 1. Scaricare e configurare

```bash
git clone https://github.com/robertobenassi/progetto.io.git
cd progetto.io
cp .env.example .env
nano .env
```

Le stesse variabili, **senza** `DOMAIN` e `ACME_EMAIL`. In più:

| Variabile | Cosa metterci |
|---|---|
| `APP_PORT` | la porta locale, predefinita `8080` |
| `APP_URL` | l'indirizzo pubblico completo, `https://progetti.esempio.com` |

`APP_URL` costruisce i link nelle email (recupero password e inviti ai
tecnici). Senza, quei messaggi conterrebbero indirizzi incompleti: il server se
ne accorge e rifiuta l'invio.

### 2. Avviare

```bash
docker compose up -d
```

L'applicazione risponde su `http://localhost:8080`, **solo dal server stesso**.
È voluto: ascoltando su tutte le interfacce sarebbe raggiungibile in HTTP
sull'IP pubblico, scavalcando il proxy e HTTPS.

### 3. Configurare il proprio proxy

**Caddy**

```caddyfile
progetti.esempio.com {
    reverse_proxy localhost:8080
    request_body {
        max_size 60MB
    }
}
```

**nginx**

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

**Se il proxy gira in un container Docker**, `localhost` per lui è sé stesso.
Conviene collegare le reti con un `docker-compose.override.yml`:

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

e puntare il proxy a `progetto_frontend:80`.

### 4. Verificare l'indirizzo dei visitatori

Il limite ai tentativi di accesso conta gli errori per indirizzo IP. Se il
proxy non lo trasmette, il server attribuisce a tutti lo stesso indirizzo e
cinque errori bloccherebbero chiunque.

Da amministratore, aprire `/api/whoami`: se `clientIp` non è l'indirizzo reale
di chi si collega, correggere `TRUST_PROXY` nel `.env`.

---

## Configurazione iniziale

1. **Cambiare la password** cliccando sul proprio nome in alto
2. **Manutenzione → Nazioni abilitate**: scegliere i paesi dove si lavora. Il
   programma ne conosce 185, ma solo gli abilitati compaiono creando un progetto
3. **Manutenzione → Festivi**: importare il calendario per ogni nazione, poi
   aggiungere ponti e chiusure aziendali
4. **Tecnici** e **Utenti**: inserire le persone e creare gli account

---

## Posta elettronica (facoltativa)

Senza SMTP non compare il recupero password, e gli inviti ai tecnici si
condividono copiando il link. Impostando le variabili `SMTP_*` si abilitano
entrambi.

Serve una casella su un dominio proprio, con **SPF e DKIM** configurati: un
messaggio che finisce in spam è un utente bloccato fuori.

Se il dominio usa un servizio di inoltro (per esempio Cloudflare Email
Routing), verificare che il record SPF includa **anche** il server che invia:
i due meccanismi condividono lo stesso record e si escludono a vicenda se ne
manca uno.

---

## Ruoli

| | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Lettura di tutto | sì | sì | sì |
| Progetti e attività | ovunque | proprie nazioni | no |
| Eliminare progetti | sì | no | no |
| Tecnici, assenze, festivi | sì | sì | no |
| Archiviare | sì | proprie nazioni | no |
| Utenti, nazioni, licenza | sì | no | no |
| Backup e ripristino | sì | no | no |

La lettura è sempre completa per tutti: senza vedere i progetti di altri paesi
non si vedrebbero i conflitti dei tecnici in trasferta. La nazione limita solo
la modifica.

Un editor **senza nazioni assegnate non può modificare nulla**: è la condizione
di ogni editor appena creato.

---

## App per i tecnici

Raggiungibile su `/technician/`. I tecnici **non hanno una password**: si
attivano una volta e il dispositivo resta collegato.

1. Scheda **Tecnici**, pulsante 📱 accanto alla persona
2. **Genera link di attivazione** e inviarlo (vale 72 ore, si usa una volta)
3. Il tecnico lo apre dal telefono e conferma

Il link compare **una sola volta**: sul server ne resta solo l'impronta. Dalla
stessa finestra si vedono i dispositivi attivi e si possono **revocare**.

I tecnici vedono solo le proprie attività, in sola lettura. L'app funziona
anche senza rete, mostrando l'ultima agenda scaricata.

La PWA richiede **HTTPS** per installarsi sul telefono: in produzione il
certificato è necessario, non opzionale.

---

## Backup

Da **Manutenzione**, riservato agli amministratori. È un file JSON con
progetti, attività, tecnici, assenze, utenti e permessi: si può aprire e
controllare prima di usarlo.

Il ripristino **sostituisce tutti i dati** e avviene in una transazione unica:
se qualcosa fallisce non viene applicato nulla. Richiede di digitare `RESTORE`.

Il file contiene le password in forma cifrata: va trattato come materiale
riservato.

Per una copia automatica notturna:

```bash
0 2 * * * docker exec progetto_db pg_dump -U progetto_user progetto_db | gzip > /backup/progetto-$(date +\%F).sql.gz
```

## Se si perde l'accesso

Con SMTP configurato: "Password dimenticata" nella pagina di accesso.

Altrimenti, da riga di comando sul server:

```bash
docker exec -it progetto_backend node reset-admin.js --list
docker exec -it progetto_backend node reset-admin.js indirizzo@esempio.it
```

Stampa una password provvisoria. Con `--promote` la persona diventa
amministratore, utile se l'unico admin ha lasciato l'azienda.

---

## Prestazioni

Misurato con 200 progetti, 150 tecnici e 2.000 attività su 2 GB e 1 CPU:

| Editor simultanei | Attesa |
|---|---|
| 5 | circa 0,3 s |
| 20 | circa 1 s |

Nessun errore sotto carico. A regime i container usano meno di 100 MB di
memoria: i 2 GB richiesti servono alla compilazione iniziale.

Il limite non è il database ma la quantità di dati inviata al browser. Oltre il
migliaio di progetti attivi conviene archiviare i lavori conclusi, che escono
dal caricamento pur restando disponibili nei report.

L'interfaccia principale è pensata per schermi da portatile in su. Sul telefono
si usa la PWA dei tecnici.

---

## Aggiornamento

```bash
git pull
docker compose up -d --build
```

Aggiungere `--profile standalone` se si usa il proxy incluso. Le migrazioni
sono automatiche. **Consigliato un backup prima di aggiornare.**

In **Manutenzione → Aggiornamenti** si vede se esiste una versione più recente.

---

## Documentazione

| Documento | Contenuto |
|---|---|
| [MANUALE.md](MANUALE.md) | Manuale completo — italiano e inglese |
| [PRIVACY.md](PRIVACY.md) | Dati trattati e verifiche per chi installa |

## Autore

**Roberto Benassi** — [robertobenassi.com](https://robertobenassi.com)

## Licenza

Uso non commerciale: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.it)

Per l'uso commerciale contattare l'autore. La licenza si registra in
**Manutenzione → Licenza** e viene verificata in locale, senza alcun contatto
con server esterni. Senza licenza nulla viene limitato: compare solo
un'indicazione d'uso non commerciale.

---

<a name="english"></a>

# Progetto.io (English)

Planning projects and technicians across countries: Gantt chart, conflict
detection, reports and a field app for technicians.

Built for work on plants and construction sites, where teams move between
locations and countries and knowing who is where matters more than anything.

## What it does

- **Gantt** by project or by technician, week or month view, with bars filled only on worked days
- **Half days**: an activity can take mornings only or afternoons only
- **Worked days**: the country's rest days and holidays do not count; each activity can have its own working week (for example Monday to Saturday) and a worked Saturday is marked separately
- **Holidays per country**, computed for 31 countries or entered manually
- **Conflicts** detected automatically on worked days; absences remove their days and the coverage shows who is missing
- **Assignments by period**: a technician can work on just some days of an activity, even in several periods, set on a presence grid
- **Required technicians** per activity, with the staffing gaps still to fill
- **Sold man-days** per project or per phase, compared with those done
- **Absences**, down to half a day
- **Multi-country**: each project has a country, editors work on their own
- **Eleven reports**, exportable to CSV and printable to PDF
- **Technician app**: everyone sees their own assignments from their phone, no password
- **Archiving** of completed work: it leaves the Gantt but stays in reports
- **Maintenance**: backup, restore, change log, updates
- Interface in Italian, English, French, Spanish, German and Portuguese
- Light and dark themes

## Stack

React · Node.js/Express · PostgreSQL 15 · Caddy · Docker

It needs no subscriptions or third-party services and sends no telemetry:
data stays on the server of whoever installs it. Apart from the mail server, if
one is configured, the only external contact is the daily update check on
GitHub, made by the administrator's browser without sending any application
data. Commercial use requires a licence: see [Licence](#licence).

---

## Installation

Two ways, depending on what the server already runs.

| | Command | When |
|---|---|---|
| **Standalone** | `docker compose --profile standalone up -d` | No reverse proxy yet. Includes Caddy, which obtains and renews the HTTPS certificate by itself |
| **Existing proxy** | `docker compose up -d` | You already run nginx, Traefik or Caddy. The app answers on a local port; point your proxy at it |

### Requirements

- Docker >= 24 and Docker Compose >= 2.20, from the official Docker repository
- **2 GB RAM**, needed to build the frontend during installation. At runtime
  the application uses under 100 MB
- x86 architecture. On ARM, replace the digest-pinned images with the matching
  tags (`postgres:15-alpine`)

---

## Standalone installation

### 1. Point the domain

Create an `A` record pointing at the server's IP address:

```
projects.example.com    A    203.0.113.10
```

With Cloudflare, leave the proxy off (grey cloud) for the first certificate
issuance. Ports **80 and 443** must be reachable from the Internet.

### 2. Download and configure

```bash
git clone https://github.com/robertobenassi/progetto.io.git
cd progetto.io
cp .env.example .env
nano .env
```

Set at least:

| Variable | What to put |
|---|---|
| `DB_PASSWORD` | any long password |
| `JWT_SECRET` | a random string: `openssl rand -hex 32` |
| `ADMIN_EMAIL` | your address, it becomes the first administrator |
| `ADMIN_PASSWORD` | the initial password, at least 8 characters |
| `DOMAIN` | your chosen domain |
| `ACME_EMAIL` | an address for certificate notices |

There are no default credentials: without `ADMIN_EMAIL` and `ADMIN_PASSWORD`
the programme refuses to start.

### 3. Start

```bash
docker compose --profile standalone up -d
```

The first run takes a few minutes: it builds the application and obtains the
certificate. Then the site answers at `https://projects.example.com`.

### 4. Sign in

With the credentials set in `.env`. **Change the password** by clicking your
name at the top right.

---

## Installation with an existing proxy

### 1. Download and configure

Same as above, **without** `DOMAIN` and `ACME_EMAIL`. Plus:

| Variable | What to put |
|---|---|
| `APP_PORT` | the local port, default `8080` |
| `APP_URL` | the full public address |

`APP_URL` builds the links in emails (password recovery and technician
invitations). Without it those messages would contain incomplete addresses, so
the server refuses to send them.

### 2. Start

```bash
docker compose up -d
```

The application answers on `http://localhost:8080`, **from the server only**.
This is deliberate: listening on all interfaces would make it reachable over
plain HTTP on the public IP, bypassing the proxy and HTTPS.

### 3. Configure your proxy

**Caddy**

```caddyfile
projects.example.com {
    reverse_proxy localhost:8080
    request_body {
        max_size 60MB
    }
}
```

**nginx**

```nginx
server {
    server_name projects.example.com;
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

**If the proxy runs in a Docker container**, `localhost` means itself. Connect
the networks with a `docker-compose.override.yml`:

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

and point the proxy at `progetto_frontend:80`.

### 4. Check the visitor address

Login rate limiting counts failures per IP address. If the proxy does not pass
it along, the server attributes the same address to everyone and five failures
would lock out anybody.

As an administrator, open `/api/whoami`: if `clientIp` is not the real address
of the person connecting, adjust `TRUST_PROXY` in `.env`.

---

## Initial setup

1. **Change the password** by clicking your name at the top
2. **Maintenance → Enabled countries**: pick the countries you work in
3. **Maintenance → Holidays**: import the calendar per country, then add bridge
   days and company closures
4. **Technicians** and **Users**: add people and create accounts

---

## Email (optional)

Without SMTP, password recovery does not appear and technician invitations are
shared by copying the link. Setting the `SMTP_*` variables enables both.

You need a mailbox on your own domain, with **SPF and DKIM** configured: a
message that lands in spam is a user locked out.

If the domain uses a forwarding service (Cloudflare Email Routing, for
example), make sure the SPF record **also** includes the sending server: both
mechanisms share the same record and break each other if one is missing.

---

## Roles

| | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Read everything | yes | yes | yes |
| Projects and activities | anywhere | own countries | no |
| Delete projects | yes | no | no |
| Technicians, absences, holidays | yes | yes | no |
| Archive | yes | own countries | no |
| Users, countries, licence | yes | no | no |
| Backup and restore | yes | no | no |

Reading is always global: without seeing other countries' projects you would
not see conflicts for technicians working abroad. The country restricts editing
only.

An editor **with no countries assigned cannot change anything**.

---

## Technician app

Available at `/technician/`. Technicians **have no password**: they activate
once and the device stays paired.

1. **Technicians** page, 📱 button next to the person
2. **Generate activation link** and send it (valid 72 hours, single use)
3. The technician opens it on their phone and confirms

The link is shown **once**: only its hash remains on the server. The same
window lists active devices and lets you **revoke** them.

Technicians see only their own assignments, read-only. The app works offline,
showing the last agenda it downloaded.

The PWA requires **HTTPS** to install on a phone.

---

## Backup

From **Maintenance**, administrators only. A JSON file with projects,
activities, technicians, absences, users and permissions: you can open and
inspect it before using it.

Restoring **replaces all data** and runs in a single transaction: if anything
fails, nothing is applied. It requires typing `RESTORE`.

The file contains hashed passwords: treat it as confidential material.

For a nightly copy:

```bash
0 2 * * * docker exec progetto_db pg_dump -U progetto_user progetto_db | gzip > /backup/progetto-$(date +\%F).sql.gz
```

## If you lose access

With SMTP configured: "Forgot your password?" on the sign-in page.

Otherwise, from the command line on the server:

```bash
docker exec -it progetto_backend node reset-admin.js --list
docker exec -it progetto_backend node reset-admin.js address@example.com
```

It prints a temporary password. With `--promote` the person becomes an
administrator.

---

## Performance

Measured with 200 projects, 150 technicians and 2,000 activities on 2 GB and
1 CPU:

| Concurrent editors | Wait |
|---|---|
| 5 | about 0.3 s |
| 20 | about 1 s |

No errors under load. At runtime the containers use under 100 MB of memory:
the 2 GB requirement is for the initial build.

The limit is not the database but the amount of data sent to the browser.
Beyond roughly a thousand active projects, archive completed work: it leaves
the ordinary load while remaining available in reports.

The main interface targets laptop screens and up. On phones, use the technician
PWA.

---

## Upgrading

```bash
git pull
docker compose up -d --build
```

Add `--profile standalone` if you use the bundled proxy. Migrations are
automatic. **Take a backup before upgrading.**

---

## Documentation

| Document | Contents |
|---|---|
| [MANUALE.md](MANUALE.md) | Full manual — Italian and English |
| [PRIVACY.md](PRIVACY.md) | Data processed and checks for whoever installs |

## Author

**Roberto Benassi** — [robertobenassi.com](https://robertobenassi.com)

## Licence

Non-commercial use: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)

For commercial use, contact the author. The licence is registered under
**Maintenance → Licence** and verified locally, with no contact to external
servers. Without a licence nothing is restricted: only a non-commercial notice
appears.
