# Guida rapida / Quick guide

*[English below](#english)*

---

## Italiano

### Ruoli

| Ruolo | Cosa può fare |
|---|---|
| **Viewer** | Consulta tutto, non modifica nulla |
| **Editor** | Crea e modifica progetti e attività nelle nazioni assegnate |
| **Admin** | Tutto, più utenti, backup e manutenzione |

Tutti vedono tutti i progetti, anche di altri paesi: senza, non si vedrebbero i
conflitti dei tecnici che lavorano all'estero. La nazione limita solo la
modifica.

Un editor senza nazioni assegnate non può modificare nulla: assegnargliene
almeno una è il primo passo dopo averlo creato.

### Primi passi

1. **Cambia la password** dell'amministratore
2. **Crea i tecnici** (Tecnici → Nuovo Tecnico): nome ed email bastano
3. **Crea i progetti** (Progetti → Nuovo Progetto) scegliendo la nazione
4. **Aggiungi le attività** con date e tecnici assegnati
5. **Crea gli utenti** e assegna le aree agli editor

### Il diagramma

**Per Progetto** mostra i progetti con le loro attività; **Per Tecnico** mostra
le persone con i loro impegni. La seconda risponde a "dove sarà Marco a
maggio?" e rende i conflitti evidenti: due barre sovrapposte sulla stessa riga
sono una doppia assegnazione.

I filtri in alto agiscono sulla visualizzazione, mai sul calcolo dei conflitti:
filtrando per Italia, un tecnico impegnato in Spagna risulta comunque occupato.

**Mezze giornate**: un'attività può iniziare il pomeriggio o finire a
mezzogiorno. La barra si accorcia di mezza cella e i conflitti ne tengono
conto: chi finisce martedì mattina a Milano può iniziare martedì pomeriggio a
Bologna senza essere segnalato.

**Conflitti**: le barre a righe diagonali segnalano un problema. Bordo rosso =
la persona è assegnata altrove nello stesso periodo; bordo arancione = è
assente. Nessuno dei due impedisce di salvare: capita di richiamare qualcuno
dalle ferie.

### Attivare l'app di un tecnico

1. Tecnici → 📱 accanto alla persona
2. **Genera link di attivazione**
3. Invialo (o usa "Invia per email" se configurato)
4. Il tecnico lo apre dal telefono e conferma
5. Può aggiungere l'app alla schermata iniziale

Il link vale 72 ore, si usa una volta sola e **compare una volta sola**: se lo
perdi, ne generi un altro e il precedente decade.

Se un telefono viene smarrito, **revoca il dispositivo** dalla stessa finestra:
l'accesso cade subito.

I tecnici vedono solo le proprie attività, in sola lettura.

### Report

Otto report, tutti esportabili in CSV e stampabili in PDF, con periodo e filtri
selezionabili.

Il più usato è **Oggi**, che mostra chi è al lavoro, chi è assente e chi è
libero. Usa la data di inizio periodo, quindi serve anche a chiedersi "chi è
libero venerdì prossimo?" prima di assegnare un intervento.

**Giorni uomo** distingue fra svolti e previsti: con un progetto selezionato e
il periodo "Tutto" si vede il consuntivo completo e quanto resta.

### Manutenzione (solo admin)

**Backup**: scarica un file JSON con tutti i dati. Fallo regolarmente e
conservalo in un luogo sicuro — contiene dati personali.

**Ripristino**: sostituisce tutti i dati attuali. Richiede di digitare
`RESTORE` per confermare.

**Registro modifiche**: chi ha fatto cosa e quando.

**Aggiornamenti**: mostra se esiste una versione più recente e il comando da
eseguire sul server.

### Se hai perso la password

Se è configurato un server di posta, usa "Password dimenticata" nella pagina di
accesso. Altrimenti, chi ha accesso al server può eseguire:

```bash
docker exec -it progetto_backend node reset-admin.js indirizzo@esempio.it
```

Stampa una password provvisoria da cambiare al primo accesso.

---

<a name="english"></a>

## English

### Roles

| Role | What they can do |
|---|---|
| **Viewer** | Reads everything, changes nothing |
| **Editor** | Creates and edits projects and activities in assigned countries |
| **Admin** | Everything, plus users, backups and maintenance |

Everyone sees all projects, including other countries: otherwise conflicts for
technicians working abroad would be invisible. The country restricts editing
only.

An editor with no countries assigned cannot change anything: assigning at least
one is the first step after creating them.

### Getting started

1. **Change the administrator password**
2. **Create technicians** (Technicians → New Technician): name and email suffice
3. **Create projects** (Projects → New Project), choosing the country
4. **Add activities** with dates and assigned technicians
5. **Create users** and assign areas to editors

### The chart

**By Project** shows projects with their activities; **By Technician** shows
people with their assignments. The latter answers "where will Marco be in
May?" and makes conflicts obvious: two overlapping bars on the same row mean a
double booking.

The filters at the top affect the display only, never conflict detection:
filtering by Italy still shows a technician as busy if they are working in
Spain.

**Half days**: an activity can start in the afternoon or end at midday. The bar
shortens by half a cell and conflict detection accounts for it: someone
finishing Tuesday morning in Milan can start Tuesday afternoon in Bologna
without being flagged.

**Conflicts**: hatched bars indicate a problem. Red border = the person is
assigned elsewhere in the same period; orange border = they are away. Neither
prevents saving: people do get called back from holiday.

### Activating a technician's app

1. Technicians → 📱 next to the person
2. **Generate activation link**
3. Send it (or use "Send by email" if configured)
4. The technician opens it on their phone and confirms
5. They can add the app to their home screen

The link lasts 72 hours, works once, and **is shown once**: if you lose it,
generate another and the previous one lapses.

If a phone is lost, **revoke the device** from the same window: access ends
immediately.

Technicians see only their own assignments, read-only.

### Reports

Eight reports, all exportable to CSV and printable to PDF, with selectable
period and filters.

The most used is **Today**, showing who is working, who is away and who is
free. It uses the period start date, so it also answers "who is free next
Friday?" before assigning a job.

**Man-days** separates work done from work planned: with a project selected and
the "All" period, you see the full picture and what remains.

### Maintenance (admin only)

**Backup**: downloads a JSON file with all data. Do it regularly and store it
securely — it contains personal data.

**Restore**: replaces all current data. Requires typing `RESTORE` to confirm.

**Change log**: who did what and when.

**Updates**: shows whether a newer version exists and the command to run on the
server.

### If you lose your password

If a mail server is configured, use "Forgot your password?" on the sign-in
page. Otherwise, someone with server access can run:

```bash
docker exec -it progetto_backend node reset-admin.js address@example.com
```

It prints a temporary password to be changed at first sign-in.
