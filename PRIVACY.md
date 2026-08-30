# Protezione dei dati / Data protection

*[English below](#english)*

---

## Italiano

Questo documento descrive quali dati personali il software tratta e quali
verifiche competono a chi lo installa. **Non è una consulenza legale**: serve a
sapere quali domande porre a chi ne ha le competenze.

### Ruoli

Progetto.io è software auto-ospitato. Chi lo installa lo esegue sui propri
server, con i propri dati, senza che nulla venga trasmesso all'autore.

**Il titolare del trattamento è l'azienda che utilizza il software.** L'autore
non ha accesso ai dati, non riceve telemetria e non fornisce alcun servizio in
cloud. Non è quindi né titolare né responsabile del trattamento.

### Dati personali trattati

| Dato | Dove | Note |
|---|---|---|
| Nome, email, telefono dei tecnici | `technicians` | Il telefono è facoltativo |
| Specializzazione, nazione di base | `technicians` | Dati professionali |
| Nome, email, telefono, ruolo degli utenti | `users` | Password cifrata (bcrypt) |
| Assegnazioni ad attività e progetti | `activities` | Rivelano gli spostamenti |
| Periodi di assenza e tipo | `technician_absences` | Vedi nota sotto |
| Autore e momento di ogni modifica | `audit_log` | Vedi nota sotto |
| Dispositivi attivati, ultimo accesso | `technician_devices` | Nome del dispositivo, non posizione |

**Il software non tratta**: dati di geolocalizzazione, dati biometrici, dati
sanitari, opinioni, appartenenza sindacale, dati di pagamento.

### Assenze

I tipi previsti sono: **ferie, indisponibile, permesso, formazione**.

Non esiste un tipo "malattia": è una scelta deliberata. Il motivo di
un'assenza per ragioni di salute è un dato relativo alla salute, che l'art. 9
GDPR classifica fra le categorie particolari e sottopone a condizioni più
rigorose. Per pianificare il lavoro è sufficiente sapere che una persona non è
disponibile.

**Da non fare**: usare il campo "nota" per annotare motivi di salute,
certificati, diagnosi o vicende personali. Reintrodurrebbe nel sistema
esattamente il dato che è stato escluso.

### Registro delle modifiche

Il registro conserva, per ogni modifica: chi l'ha fatta, quando, su cosa e
quali valori sono cambiati. Serve alla sicurezza del sistema e a ricostruire
gli errori.

**Attenzione**: registrando autore e momento di ogni azione, il registro
permette indirettamente di ricostruire orari e ritmi di lavoro. In Italia il
controllo a distanza dell'attività dei lavoratori è disciplinato dall'art. 4
dello Statuto dei Lavoratori (L. 300/1970), che richiede accordo sindacale o
autorizzazione dell'Ispettorato del Lavoro, salvo che si tratti di strumenti
necessari a rendere la prestazione — condizione in cui questo registro
normalmente ricade.

Da verificare con il proprio consulente del lavoro:
- se il registro rientri fra gli strumenti di lavoro (art. 4 comma 2)
- che sia menzionato nell'informativa ai dipendenti
- che non venga usato per finalità disciplinari senza le tutele previste

### Verifiche a carico di chi installa

**Prima dell'uso**

- [ ] Redigere l'informativa privacy per tecnici e utenti (art. 13 GDPR),
      indicando finalità, base giuridica, conservazione e diritti
- [ ] Inserire il trattamento nel registro delle attività (art. 30)
- [ ] Verificare la base giuridica: di norma esecuzione del contratto di
      lavoro o legittimo interesse organizzativo
- [ ] Nominare responsabili eventuali fornitori (hosting, backup esterni)
- [ ] Definire per quanto tempo conservare i dati e chi li cancella
- [ ] Verificare l'art. 4 dello Statuto dei Lavoratori per il registro modifiche

**Se si opera in più paesi**

- [ ] I dati restano sul proprio server: non c'è trasferimento verso l'autore
- [ ] Se il server è fuori dallo Spazio economico europeo, verificare le
      garanzie per il trasferimento (capo V GDPR)
- [ ] Il Regno Unito ha una decisione di adeguatezza; per Medio Oriente e
      Africa verificare caso per caso

**Sul piano tecnico**

- [ ] HTTPS obbligatorio: la PWA non funziona senza, e le credenziali non
      devono viaggiare in chiaro
- [ ] Cambiare la password iniziale dell'amministratore
- [ ] Impostare `JWT_SECRET` con un valore casuale, mai quello di esempio
- [ ] Conservare i backup in luogo protetto: contengono dati personali e
      password cifrate
- [ ] Limitare gli amministratori alle persone che ne hanno davvero bisogno

### Diritti degli interessati

Il software non ha funzioni automatiche per rispondere alle richieste degli
interessati. Vanno gestite manualmente:

- **Accesso**: i dati di una persona si estraggono dal backup JSON o con una
  query sul database
- **Rettifica**: dall'interfaccia, schede Tecnici e Utenti
- **Cancellazione**: eliminando il tecnico si eliminano anche assenze e
  dispositivi; le attività restano ma senza assegnazione. Le voci del registro
  modifiche vanno rimosse separatamente, valutando l'interesse a conservarle
- **Portabilità**: il backup JSON è un formato leggibile e riutilizzabile

### Conservazione

Il software **non cancella nulla automaticamente**. Chi lo installa deve
stabilire i tempi e provvedere. Indicazioni ragionevoli, da adattare:

| Dato | Riferimento |
|---|---|
| Progetti e attività conclusi | Durata utile alla gestione, poi archiviazione |
| Assenze | Termini della normativa sul lavoro applicabile |
| Registro modifiche | 6–12 mesi salvo esigenze specifiche |
| Tecnici che hanno lasciato l'azienda | Rimozione dopo i termini contrattuali |

Per eliminare le voci del registro più vecchie di un anno:

```sql
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '12 months';
```

### Sicurezza applicata

Misure già presenti nel software: password cifrate con bcrypt, token di
sessione con scadenza, limite ai tentativi di accesso, permessi per ruolo e
area geografica, registro degli accessi ai dispositivi, intestazioni di
sicurezza, database non esposto sulla rete, codici di attivazione conservati
solo come impronta.

Misure che restano a carico di chi installa: HTTPS, backup, aggiornamenti,
sicurezza del server, gestione degli accessi.

---

<a name="english"></a>

## English

This document describes which personal data the software processes and which
checks fall to whoever installs it. **It is not legal advice**: it is meant to
help you ask the right questions to someone qualified.

### Roles

Progetto.io is self-hosted software. Whoever installs it runs it on their own
servers, with their own data, and nothing is transmitted to the author.

**The data controller is the company using the software.** The author has no
access to the data, receives no telemetry and provides no cloud service, and is
therefore neither controller nor processor.

### Personal data processed

| Data | Where | Notes |
|---|---|---|
| Technician name, email, phone | `technicians` | Phone is optional |
| Specialisation, home country | `technicians` | Professional data |
| User name, email, phone, role | `users` | Password hashed (bcrypt) |
| Assignments to activities and projects | `activities` | Reveal movements |
| Absence periods and type | `technician_absences` | See note below |
| Author and time of each change | `audit_log` | See note below |
| Activated devices, last seen | `technician_devices` | Device name, not location |

**The software does not process**: location data, biometric data, health data,
opinions, trade union membership, payment data.

### Absences

The available types are: **holiday, unavailable, leave, training**.

There is no "sick leave" type, and this is deliberate. The reason for a
health-related absence is health data, which Article 9 GDPR places among
special categories subject to stricter conditions. Planning work only requires
knowing that someone is unavailable.

**Do not** use the "note" field to record health reasons, certificates,
diagnoses or personal circumstances. Doing so would reintroduce exactly the
data that has been kept out.

### Change log

The log records, for each change: who made it, when, on what, and which values
changed. It serves system security and error investigation.

**Note**: by recording the author and timestamp of every action, the log
indirectly allows working hours and patterns to be reconstructed. In Italy,
remote monitoring of workers is governed by Article 4 of the Workers' Statute
(L. 300/1970), which requires a union agreement or authorisation from the
Labour Inspectorate, unless the tool is necessary to perform the work — which
is normally the case here. Other jurisdictions have comparable rules: check
locally.

### Checks for whoever installs

**Before use**

- [ ] Draft the privacy notice for technicians and users (Art. 13 GDPR),
      stating purposes, legal basis, retention and rights
- [ ] Add the processing to the record of processing activities (Art. 30)
- [ ] Confirm the legal basis: normally performance of the employment contract
      or legitimate organisational interest
- [ ] Appoint processors for any suppliers (hosting, external backups)
- [ ] Decide how long data is kept and who deletes it
- [ ] Check local rules on workplace monitoring for the change log

**If operating across countries**

- [ ] Data stays on your own server: nothing is transferred to the author
- [ ] If the server sits outside the European Economic Area, verify transfer
      safeguards (GDPR Chapter V)
- [ ] The United Kingdom has an adequacy decision; for the Middle East and
      Africa check case by case

**Technical**

- [ ] HTTPS is mandatory: the PWA will not work without it, and credentials
      must not travel in clear text
- [ ] Change the initial administrator password
- [ ] Set `JWT_SECRET` to a random value, never the example one
- [ ] Store backups securely: they contain personal data and hashed passwords
- [ ] Keep administrator accounts to the people who genuinely need them

### Data subject rights

The software has no automated functions for handling data subject requests.
They must be handled manually:

- **Access**: extract a person's data from the JSON backup or with a database
  query
- **Rectification**: from the interface, Technicians and Users pages
- **Erasure**: deleting a technician also deletes their absences and devices;
  activities remain but without assignment. Change log entries must be removed
  separately, weighing the interest in retaining them
- **Portability**: the JSON backup is a readable, reusable format

### Retention

The software **deletes nothing automatically**. Whoever installs it must set
retention periods and act on them. Reasonable starting points, to be adapted:

| Data | Guidance |
|---|---|
| Completed projects and activities | As long as operationally useful, then archive |
| Absences | As required by applicable employment law |
| Change log | 6–12 months unless specific needs apply |
| Technicians who have left | Remove after contractual periods |

To delete log entries older than one year:

```sql
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '12 months';
```

### Security in place

Measures already built into the software: bcrypt-hashed passwords, expiring
session tokens, login rate limiting, role and country-based permissions, device
access log, security headers, database not exposed to the network, activation
codes stored only as hashes.

Measures that remain with whoever installs: HTTPS, backups, updates, server
security, access management.
