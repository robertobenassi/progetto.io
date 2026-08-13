# Manuale d'uso / User manual

*[English below](#english)*

---

## Italiano

### Indice

1. [Licenza d'uso](#licenza)
2. [Concetti di base](#concetti)
3. [Primo avvio](#primo-avvio)
4. [Progetti](#progetti)
5. [Attività](#attivita)
6. [Tecnici](#tecnici)
7. [Assenze](#assenze)
8. [Il diagramma di Gantt](#gantt)
9. [Conflitti](#conflitti)
10. [Report](#report)
11. [App per i tecnici](#app-tecnici)
12. [Utenti e permessi](#utenti)
13. [Manutenzione](#manutenzione)
14. [Domande frequenti](#faq)

---

<a name="licenza"></a>
### 1. Licenza d'uso

#### In breve

| Uso | Cosa serve |
|---|---|
| Personale, studio, valutazione | Nulla, è libero |
| Associazioni e enti senza scopo di lucro | Nulla, è libero |
| **Attività professionale o d'impresa** | **Licenza commerciale** |

Il software è distribuito con licenza
[Creative Commons BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.it):
si può usare, copiare, modificare e ridistribuire liberamente **purché non a
fini commerciali**, citando l'autore.

#### Cosa significa "non commerciale"

Non riguarda il fatto di pagare o meno, ma **l'uso che se ne fa**. Usare il
programma per organizzare il lavoro di un'azienda è uso commerciale, anche se
l'azienda non lo rivende e non ci guadagna direttamente: il software sostiene
un'attività economica.

Sono usi liberi, senza bisogno di licenza:

- provarlo per valutarne l'acquisto
- usarlo per sé, per un progetto personale o per studiare come è fatto
- modificarlo e ridistribuirlo, sempre per usi non commerciali
- usarlo in un'associazione o un ente senza scopo di lucro

Serve invece una licenza commerciale per:

- pianificare il lavoro di un'impresa, di uno studio o di un professionista
- installarlo per un cliente nell'ambito di un servizio a pagamento
- includerlo in un prodotto o servizio venduto a terzi

In caso di dubbio conviene chiedere: la licenza esiste per mettere in regola
chi vuole esserlo, non per creare incertezza.

#### Come si ottiene

Si contatta l'autore ([robertobenassi.com](https://robertobenassi.com)). Viene
consegnata una chiave da registrare in **Manutenzione → Licenza**.

La chiave è firmata crittograficamente e la verifica avviene **in locale**: il
programma non contatta alcun server, non trasmette dati e funziona anche su una
macchina isolata da Internet.

#### Cosa cambia senza licenza

**Nulla viene limitato.** Tutte le funzioni restano attive e i dati sono
sempre i vostri. Compare soltanto un'indicazione discreta "uso non
commerciale" accanto al nome dell'applicazione, e un richiamo alla licenza
nella pagina Manutenzione.

Lo stesso vale per una **licenza scaduta**: viene segnalata, ma il programma
continua a funzionare. Bloccare il lavoro di un'azienda per un rinnovo in
ritardo danneggerebbe chi lavora più di quanto tuteli l'autore.

Questa scelta si regge sulla correttezza reciproca: il software non impone
barriere tecniche, e chi ne trae beneficio economico contribuisce a mantenerlo.

#### I vostri dati

La licenza riguarda il software, non i dati. Progetti, attività, tecnici e
tutto il resto **restano di chi installa il programma**, sul proprio server.
L'autore non vi ha accesso, non riceve statistiche d'uso e non fornisce alcun
servizio in cloud.

Chi installa il programma è il titolare del trattamento dei dati personali che
vi inserisce. Le verifiche che ne conseguono sono descritte in
[PRIVACY.md](PRIVACY.md).

#### Garanzia

Il software è fornito "così com'è", senza garanzie. La licenza commerciale dà
diritto all'uso e al supporto concordato, non a un'assicurazione sui risultati.
Prima di affidargli la pianificazione di un'attività reale conviene provarlo
con i propri dati e **verificare che i backup funzionino**.

---

<a name="concetti"></a>
### 2. Concetti di base

Il programma organizza il lavoro su tre livelli.

Un **progetto** è un cantiere, un impianto, un intervento: ha un codice, un
nome, un colore e una **nazione**. La nazione non è un dettaglio anagrafico —
determina quali festivi valgono e chi può modificarlo.

Un'**attività** è una fase di quel progetto: sopralluogo, installazione,
collaudo. Ha date di inizio e fine, un avanzamento in percentuale e uno o più
**tecnici** assegnati.

Un **tecnico** è una persona. I tecnici sono un elenco unico, non divisi per
nazione: hanno una **nazione di base** che serve solo a distinguere le
trasferte, ma chiunque può essere assegnato a qualsiasi progetto.

Da questa struttura discende tutto il resto: i conflitti nascono quando la
stessa persona è su due attività insieme, i giorni uomo si contano sommando le
assegnazioni, le trasferte sono le attività fuori dalla nazione di base.

---

<a name="primo-avvio"></a>
### 3. Primo avvio

Dopo l'installazione, quattro passaggi nell'ordine indicato.

**Cambiare la password.** L'utente iniziale è `admin@progetto.io` con password
`admin123`, nota a chiunque abbia letto la documentazione.

**Abilitare le nazioni** (Manutenzione → Nazioni abilitate). Il programma
conosce 185 paesi, ma nessuno lavora ovunque: si scelgono quelli dove
l'azienda opera davvero, e solo quelli compariranno creando un progetto. Si
abilita un'area intera con un clic o si scelgono i singoli stati.

**Caricare i festivi** (Manutenzione → Festivi). Per ogni nazione abilitata si
sceglie l'anno e si preme *Importa calendario*: il programma calcola le
festività nazionali. Poi si aggiungono a mano ponti e chiusure aziendali, che
nessun calendario conosce.

**Inserire i tecnici** e infine creare gli **utenti** che useranno il
programma.

---

<a name="progetti"></a>
### 4. Progetti

**Progetti → Nuovo Progetto.**

| Campo | Note |
|---|---|
| Codice | Identificativo breve, compare sulle barre del Gantt |
| Nome | Descrizione estesa |
| Nazione | Determina festivi e permessi di modifica |
| Colore | Distingue le barre nel diagramma |

Il **codice** conviene sceglierlo con criterio, perché è ciò che si legge nel
Gantt quando lo spazio è poco: `IT-0042` o `MI-DC-01` funzionano meglio di
`Progetto 42`.

**Duplicare un progetto** (pulsante ⧉) ricrea il progetto con tutte le sue
attività, spostate di un numero di giorni a scelta e con l'avanzamento
azzerato. I tecnici assegnati vengono copiati: chi ha fatto l'intervento la
volta scorsa è il candidato più probabile anche stavolta, e si cambia in un
clic. È il modo più rapido per impostare un intervento ricorrente.

Eliminare un progetto elimina anche tutte le sue attività, ed è riservato agli
amministratori.

---

<a name="attivita"></a>
### 5. Attività

Si creano dal pulsante **Nuova Attività** o cliccando su una barra del Gantt
per modificarle.

#### Le date

Ci sono due modi per definire il periodo.

**Indicando la durata**: si compila la data di inizio e il campo *Giorni lav.*,
e la data di fine viene calcolata saltando i giorni di riposo e i festivi della
nazione del progetto. Cinque giorni lavorativi dal 21 dicembre finiscono il 28,
perché Natale, Santo Stefano e il fine settimana non contano.

**Indicando la fine**: si scrive direttamente la data di fine. Così il vincolo
dei giorni lavorativi decade ed è possibile pianificare un intervento in un
fine settimana o in un giorno festivo — normale quando si lavora su impianti
che devono restare in servizio.

Sotto i campi compaiono i giorni di calendario, i giorni lavorativi e un avviso
arancione quando il periodo comprende giorni non lavorativi. È una
segnalazione, mai un blocco.

#### Mezze giornate

Le caselle **Solo mattina** e **Solo pomeriggio** valgono per tutta la durata
dell'attività, non per il primo o l'ultimo giorno. Cinque giorni con "solo
mattina" significano cinque mattine, e contano 2,5 giorni uomo.

È il modo in cui si organizzano i collaudi, e permette di assegnare la stessa
persona a due cantieri diversi nello stesso periodo — uno la mattina, uno il
pomeriggio — senza che il programma segnali un conflitto.

Nel Gantt la barra mostra mezze celle allineate alla griglia.

#### I tecnici

Il riquadro a destra ha un campo di ricerca che filtra per nome e
specializzazione. I tecnici selezionati restano visibili in alto come etichette
colorate, rimovibili con un clic, e compaiono per primi nell'elenco anche
mentre si cerca.

---

<a name="tecnici"></a>
### 6. Tecnici

Nome ed email bastano. La **specializzazione** è utile perché si può cercare
per quella quando si assegna un'attività. La **nazione di base** serve al
report Trasferte: chi lavora fuori dalla propria nazione risulta in trasferta.

Il **colore** distingue la persona nella vista per tecnico del Gantt.

Due pulsanti accanto a ogni tecnico: 🏖 per le assenze e 📱 per l'accesso da
telefono.

---

<a name="assenze"></a>
### 7. Assenze

Dal pulsante 🏖 nella scheda Tecnici. Quattro tipi: **ferie, indisponibile,
permesso, formazione**, con possibilità di mezza giornata e una nota libera.

Non esiste un tipo "malattia", ed è deliberato: il motivo di un'assenza per
ragioni di salute è un dato sanitario, e per pianificare basta sapere che la
persona non è disponibile. Per la stessa ragione **il campo nota non va usato**
per annotare certificati o diagnosi.

Le assenze compaiono nel Gantt come fasce tratteggiate nella vista per tecnico,
e un'attività assegnata durante un'assenza viene segnalata — senza essere
impedita, perché capita di richiamare qualcuno dalle ferie.

Il report **Carico** sconta le assenze: chi è in ferie metà mese non risulta
scarico, ma assente.

---

<a name="gantt"></a>
### 8. Il diagramma di Gantt

#### Le due viste

**Per Progetto** mostra i progetti con le loro attività: risponde a "a che
punto è il cantiere di Milano?".

**Per Tecnico** mostra le persone con i loro impegni: risponde a "dove sarà
Marco a maggio?" e rende i conflitti immediatamente visibili — due barre
sovrapposte sulla stessa riga sono una doppia assegnazione.

#### I filtri

Le pillole in alto filtrano per nazione, il campo di ricerca per nome, e si
può filtrare per singolo tecnico.

**I filtri agiscono sulla visualizzazione, mai sul calcolo dei conflitti.**
Filtrando per Italia, un tecnico impegnato in Spagna risulta comunque occupato:
altrimenti il filtro nasconderebbe proprio i problemi che si cercano.

#### Giorni non lavorativi

Con **una sola nazione filtrata** si vedono i giorni di riposo in grigio e i
festivi in rosso tenue, con il nome della festa nell'intestazione.

Con **più nazioni** restano solo i giorni di riposo: un festivo che vale per un
paese solo si leggerebbe come "qui non si lavora" e indurrebbe in errore.

L'interruttore *Giorni non lavorativi* nasconde tutto, utile a chi pianifica
proprio nei fermi macchina.

I giorni di riposo seguono la nazione: per Arabia Saudita ed Egitto sono
venerdì e sabato.

---

<a name="conflitti"></a>
### 9. Conflitti

Una barra a **righe diagonali** segnala un problema. Il bordo distingue i due
casi:

- **rosso** — la persona è assegnata altrove nello stesso periodo
- **arancione** — la persona è assente in quel periodo

Nessuno dei due impedisce di salvare. Il programma segnala, decide chi
pianifica.

Il rilevamento tiene conto delle mezze giornate: chi lavora le mattine a Milano
e i pomeriggi a Bologna **non** è in conflitto.

La scheda **Conflitti** raccoglie tutti i casi raggruppati per tecnico, con in
cima un riquadro separato per le attività assegnate durante un'assenza.

---

<a name="report"></a>
### 10. Report

Otto report, tutti con periodo selezionabile, filtri per nazione, progetto e
tecnico, esportabili in **CSV** e stampabili in **PDF**.

| Report | A cosa serve |
|---|---|
| **Oggi** | Chi è al lavoro, chi è assente, chi è libero |
| **Agenda tecnico** | Dove va ciascuno e quando — si stampa e si consegna |
| **Carico** | Saturazione sui giorni realmente disponibili |
| **Giorni uomo** | Svolti e previsti, per progetto e per persona |
| **Trasferte** | Chi lavora fuori dalla propria nazione |
| **Per nazione** | Riepilogo di progetti, attività e giorni uomo |
| **In ritardo** | Attività scadute e non completate |
| **Assenze** | Elenco per periodo |

**Oggi** usa la data di inizio periodo, non necessariamente la giornata
corrente: serve anche a chiedersi "chi è libero venerdì prossimo?" prima di
assegnare un intervento. Cliccando un'attività si apre direttamente la modale
di modifica.

**Giorni uomo** distingue fra svolti e previsti. Selezionando un progetto e il
periodo *Tutto* si vede il consuntivo completo e quanto resta da fare.

I report **ritagliano le attività al periodo**: un intervento dal 28 luglio al
4 agosto conta 4 giorni se si chiede agosto, non 8.

---

<a name="app-tecnici"></a>
### 11. App per i tecnici

Ogni tecnico può vedere le proprie attività dal telefono, all'indirizzo
`/technician/`. Non serve una password.

**Per attivarla:**

1. Scheda Tecnici → pulsante 📱 accanto alla persona
2. *Genera link di attivazione*
3. Inviare il link (o usare *Invia per email* se configurato)
4. Il tecnico lo apre dal telefono e conferma
5. Può aggiungere l'app alla schermata iniziale

Il link vale **72 ore**, si usa **una sola volta** e **compare una sola volta**:
sul server ne resta solo l'impronta. Se va perso se ne genera un altro, e il
precedente decade.

Dalla stessa finestra si vedono i dispositivi attivi con data di attivazione e
ultimo accesso, e si possono **revocare** — utile con un telefono smarrito o
quando qualcuno lascia l'azienda. L'accesso cade immediatamente.

I tecnici vedono **solo le proprie attività, in sola lettura**. L'app funziona
anche senza rete, mostrando l'ultima agenda scaricata.

---

<a name="utenti"></a>
### 12. Utenti e permessi

| | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Lettura di tutto | ✅ | ✅ | ✅ |
| Progetti e attività | ovunque | proprie nazioni | ❌ |
| Eliminare progetti | ✅ | ❌ | ❌ |
| Tecnici, assenze, festivi | ✅ | ✅ | ❌ |
| Utenti, nazioni, licenza | ✅ | ❌ | ❌ |
| Backup e ripristino | ✅ | ❌ | ❌ |

**La lettura è sempre completa per tutti.** Non è una svista: senza vedere i
progetti di altri paesi non si vedrebbero i conflitti dei tecnici in trasferta.
La nazione limita solo la modifica.

**Le aree di un editor** si assegnano modificando l'utente: comparendo il
riquadro con le nazioni abilitate, si spuntano quelle di competenza. Un editor
**senza aree assegnate non può modificare nulla** — è la condizione di ogni
editor appena creato, ed è segnalata in rosso nella tabella utenti.

Un editor può usare tecnici di qualsiasi nazione: sono un elenco unico.

---

<a name="manutenzione"></a>
### 13. Manutenzione

Riservata agli amministratori.

**Licenza.** L'uso non commerciale è libero (CC BY-NC 4.0). Per l'uso
commerciale si registra qui la chiave ricevuta. La verifica avviene in locale,
senza contattare alcun server. Senza licenza nulla viene limitato: compare solo
un'indicazione discreta accanto al nome.

**Aggiornamenti.** Mostra la versione installata e se ne esiste una più
recente, con il comando da eseguire sul server. Il controllo avviene una volta
al giorno.

**Backup.** Scarica un file JSON con tutti i dati. Va fatto regolarmente e
conservato in luogo protetto: contiene dati personali e password cifrate.

**Ripristino.** Sostituisce **tutti** i dati attuali e richiede di digitare
`RESTORE` per confermare. Avviene in una transazione unica: se qualcosa
fallisce non viene applicato nulla.

**Festivi.** Importazione del calendario per nazione e anno, più inserimento
manuale. Il riepilogo in cima mostra quali nazioni sono ancora senza festivi.

**Nazioni abilitate.** Quali paesi compaiono creando un progetto. Le nazioni
con progetti, editor o tecnici assegnati non si possono disattivare.

**Registro modifiche.** Chi ha fatto cosa e quando, con i valori prima e dopo.

---

<a name="faq"></a>
### 14. Domande frequenti

**Ho dimenticato la password dell'amministratore.**
Se è configurato un server di posta, usare "Password dimenticata". Altrimenti,
chi ha accesso al server esegue:
```bash
docker exec -it progetto_backend node reset-admin.js indirizzo@esempio.it
```

**Un editor non riesce a modificare nulla.**
Probabilmente non ha aree assegnate. Modificare l'utente e spuntare almeno una
nazione.

**Una nazione non compare creando un progetto.**
Va abilitata in Manutenzione → Nazioni abilitate.

**I giorni lavorativi non saltano i festivi.**
Vanno importati in Manutenzione → Festivi, per quella nazione e quell'anno. Il
riepilogo mostra quali sono ancora vuote.

**Un tecnico risulta in conflitto ma non lo è.**
Se lavora la mattina in un posto e il pomeriggio in un altro, vanno impostate
le caselle *Solo mattina* e *Solo pomeriggio* nelle due attività.

**Devo pianificare un intervento di domenica.**
Si può: basta scrivere direttamente la data di fine invece di usare il campo
giorni lavorativi. Comparirà un avviso, ma nulla viene impedito.

**Un tecnico ha perso il telefono.**
Scheda Tecnici → 📱 → *Revoca* sul dispositivo. L'accesso cade subito. Poi si
genera un nuovo link per il telefono sostitutivo.

**Le modifiche non si vedono dopo un aggiornamento.**
Ricaricare con CTRL+F5. Se persiste, provare in finestra anonima.

---

<a name="english"></a>

## English

### Contents

1. [Licence](#licence-en)
2. [Core concepts](#concepts)
3. [First run](#first-run)
4. [Projects](#projects-en)
5. [Activities](#activities-en)
6. [Technicians](#technicians-en)
7. [Absences](#absences-en)
8. [The Gantt chart](#gantt-en)
9. [Conflicts](#conflicts-en)
10. [Reports](#reports-en)
11. [Technician app](#tech-app-en)
12. [Users and permissions](#users-en)
13. [Maintenance](#maintenance-en)
14. [Frequently asked questions](#faq-en)

---

<a name="licence-en"></a>
### 1. Licence

#### In short

| Use | What you need |
|---|---|
| Personal, study, evaluation | Nothing, it is free |
| Non-profit organisations | Nothing, it is free |
| **Professional or business use** | **Commercial licence** |

The software is distributed under the
[Creative Commons BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
licence: you may use, copy, modify and redistribute it freely **provided the
purpose is not commercial**, crediting the author.

#### What "non-commercial" means

It is not about paying, it is about **what you use it for**. Running the
programme to organise a company's work is commercial use, even if the company
does not resell it and earns nothing from it directly: the software supports an
economic activity.

Free uses, no licence required:

- trying it out to decide whether to buy
- using it for yourself, a personal project, or to study how it is built
- modifying and redistributing it, again for non-commercial purposes
- using it in a non-profit organisation

A commercial licence is required to:

- plan the work of a company, a practice or a self-employed professional
- install it for a client as part of a paid service
- include it in a product or service sold to third parties

When in doubt, ask: the licence exists to let those who want to comply do so,
not to create uncertainty.

#### How to obtain one

Contact the author ([robertobenassi.com](https://robertobenassi.com)). You
receive a key to register under **Maintenance → Licence**.

The key is cryptographically signed and verified **locally**: the programme
contacts no server, transmits no data, and works on a machine with no Internet
access.

#### What changes without a licence

**Nothing is restricted.** Every feature stays available and the data is always
yours. Only a discreet "non-commercial" notice appears next to the application
name, along with a reference to the licence on the Maintenance page.

The same applies to an **expired licence**: it is flagged, but the programme
keeps working. Blocking a company's work over a late renewal would harm the
people working more than it protects the author.

This approach rests on mutual good faith: the software imposes no technical
barriers, and those who benefit economically contribute to maintaining it.

#### Your data

The licence covers the software, not the data. Projects, activities,
technicians and everything else **belong to whoever installs the programme**,
on their own server. The author has no access, receives no usage statistics and
provides no cloud service.

Whoever installs the programme is the controller of the personal data entered
into it. The resulting obligations are described in [PRIVACY.md](PRIVACY.md).

#### Warranty

The software is provided "as is", without warranty. A commercial licence grants
the right to use it and the agreed support, not insurance on outcomes. Before
entrusting it with real planning, try it with your own data and **verify that
backups work**.

---

<a name="concepts"></a>
### 2. Core concepts

The programme organises work on three levels.

A **project** is a site, a system, a job: it has a code, a name, a colour and a
**country**. The country is not just a label — it determines which holidays
apply and who may edit it.

An **activity** is a phase of that project: survey, installation,
commissioning. It has start and end dates, a percentage of progress and one or
more **technicians** assigned.

A **technician** is a person. Technicians form a single pool, not divided by
country: they have a **home country** used only to identify travel, but anyone
can be assigned to any project.

Everything else follows from this structure: conflicts arise when the same
person is on two activities at once, man-days are counted by summing
assignments, and travel means activities outside the home country.

---

<a name="first-run"></a>
### 3. First run

After installation, four steps in this order.

**Change the password.** The initial user is `admin@progetto.io` with password
`admin123`, known to anyone who has read the documentation.

**Enable countries** (Maintenance → Enabled countries). The programme knows 185
countries, but nobody works everywhere: pick the ones your company actually
operates in, and only those will appear when creating a project. Enable a whole
area with one click, or choose individual countries.

**Load holidays** (Maintenance → Holidays). For each enabled country choose the
year and press *Import calendar*: the programme computes national holidays.
Then add bridge days and company closures by hand — no calendar knows those.

**Add technicians**, and finally create the **users** who will work with the
programme.

---

<a name="projects-en"></a>
### 4. Projects

**Projects → New Project.**

| Field | Notes |
|---|---|
| Code | Short identifier, shown on the Gantt bars |
| Name | Full description |
| Country | Determines holidays and edit permissions |
| Colour | Distinguishes bars on the chart |

Choose the **code** carefully: it is what you read on the Gantt when space is
tight. `IT-0042` or `MI-DC-01` work better than `Project 42`.

**Duplicating a project** (⧉ button) recreates it with all its activities,
shifted by a chosen number of days and with progress reset. Assigned
technicians are copied: whoever did the job last time is the likeliest
candidate again, and can be changed in one click. It is the fastest way to set
up recurring work.

Deleting a project also deletes all its activities, and is restricted to
administrators.

---

<a name="activities-en"></a>
### 5. Activities

Create them with **New Activity**, or click a Gantt bar to edit.

#### Dates

There are two ways to define the period.

**By duration**: fill in the start date and the *Work days* field, and the end
date is calculated skipping rest days and holidays for the project's country.
Five working days from 21 December end on the 28th, because Christmas, Boxing
Day and the weekend do not count.

**By end date**: type the end date directly. This releases the working-days
constraint, allowing work to be scheduled on a weekend or public holiday —
routine when working on systems that must stay in service.

Below the fields you see calendar days, working days, and an orange warning
when the period includes non-working days. It is a notice, never a block.

#### Half days

The **Mornings only** and **Afternoons only** checkboxes apply to the whole
activity, not to the first or last day. Five days of "mornings only" means five
mornings, counting as 2.5 man-days.

This matches how commissioning is organised, and lets the same person be
assigned to two different sites in the same period — one in the morning, one in
the afternoon — without the programme flagging a conflict.

On the Gantt the bar shows half cells aligned to the grid.

#### Technicians

The panel on the right has a search field covering name and specialisation.
Selected technicians stay visible at the top as coloured chips, removable with
a click, and appear first in the list even while searching.

---

<a name="technicians-en"></a>
### 6. Technicians

Name and email are enough. **Specialisation** is useful because you can search
by it when assigning work. **Home country** feeds the Travel report: anyone
working outside their own country counts as travelling.

**Colour** identifies the person in the by-technician Gantt view.

Two buttons next to each technician: 🏖 for absences and 📱 for phone access.

---

<a name="absences-en"></a>
### 7. Absences

From the 🏖 button on the Technicians page. Four types: **holiday, unavailable,
leave, training**, with half-day support and a free note.

There is no "sick leave" type, and that is deliberate: the reason for a
health-related absence is health data, and planning only needs to know the
person is unavailable. For the same reason **the note field must not be used**
to record certificates or diagnoses.

Absences appear on the Gantt as hatched bands in the by-technician view, and an
activity assigned during an absence is flagged — without being prevented,
because people do get called back from holiday.

The **Workload** report discounts absences: someone on holiday for half the
month does not look underused, they look absent.

---

<a name="gantt-en"></a>
### 8. The Gantt chart

#### The two views

**By Project** shows projects with their activities: it answers "how is the
Milan site going?".

**By Technician** shows people with their assignments: it answers "where will
Marco be in May?" and makes conflicts immediately visible — two overlapping
bars on the same row mean a double booking.

#### Filters

The chips at the top filter by country, the search field by name, and you can
filter by individual technician.

**Filters affect the display, never conflict detection.** Filtering by Italy
still shows a technician as busy if they are working in Spain: otherwise the
filter would hide exactly the problems you are looking for.

#### Non-working days

With **a single country filtered** you see rest days in grey and holidays in
light red, with the holiday name in the header.

With **several countries**, only rest days remain: a holiday that applies to
one country alone would read as "no work here" and mislead.

The *Non-working days* switch hides all shading — useful when scheduling
precisely on shutdown days.

Rest days follow the country: for Saudi Arabia and Egypt they are Friday and
Saturday.

---

<a name="conflicts-en"></a>
### 9. Conflicts

A **hatched** bar signals a problem. The border tells the two cases apart:

- **red** — the person is assigned elsewhere in the same period
- **orange** — the person is away in that period

Neither prevents saving. The programme flags; the planner decides.

Detection accounts for half days: someone working mornings in Milan and
afternoons in Bologna is **not** in conflict.

The **Conflicts** page collects every case grouped by technician, with a
separate panel at the top for activities assigned during an absence.

---

<a name="reports-en"></a>
### 10. Reports

Eight reports, all with a selectable period, filters by country, project and
technician, exportable to **CSV** and printable to **PDF**.

| Report | What it answers |
|---|---|
| **Today** | Who is working, who is away, who is free |
| **Technician schedule** | Where each person goes and when — print and hand out |
| **Workload** | Utilisation against actually available days |
| **Man-days** | Done and planned, by project and by person |
| **Travel** | Who works outside their home country |
| **By country** | Summary of projects, activities and man-days |
| **Overdue** | Activities past their end date and incomplete |
| **Absences** | List for a period |

**Today** uses the period start date, not necessarily the current day: it also
answers "who is free next Friday?" before assigning a job. Clicking an activity
opens the edit dialog directly.

**Man-days** separates work done from work planned. Selecting a project and the
*All* period shows the full picture and what remains.

Reports **clip activities to the period**: a job from 28 July to 4 August
counts 4 days when you ask for August, not 8.

---

<a name="tech-app-en"></a>
### 11. Technician app

Each technician can see their own assignments from their phone at
`/technician/`. No password required.

**To activate it:**

1. Technicians page → 📱 button next to the person
2. *Generate activation link*
3. Send the link (or use *Send by email* if configured)
4. The technician opens it on their phone and confirms
5. They can add the app to their home screen

The link lasts **72 hours**, works **once**, and **is shown once**: only its
hash remains on the server. If lost, generate another and the previous one
lapses.

The same window lists active devices with activation date and last seen, and
lets you **revoke** them — useful for a lost phone or when someone leaves.
Access ends immediately.

Technicians see **only their own assignments, read-only**. The app also works
offline, showing the last agenda it downloaded.

---

<a name="users-en"></a>
### 12. Users and permissions

| | Admin | Editor | Viewer |
|---|:---:|:---:|:---:|
| Read everything | ✅ | ✅ | ✅ |
| Projects and activities | anywhere | own countries | ❌ |
| Delete projects | ✅ | ❌ | ❌ |
| Technicians, absences, holidays | ✅ | ✅ | ❌ |
| Users, countries, licence | ✅ | ❌ | ❌ |
| Backup and restore | ✅ | ❌ | ❌ |

**Reading is always global for everyone.** This is not an oversight: without
seeing other countries' projects you would not see conflicts for technicians
working abroad. The country restricts editing only.

**An editor's areas** are assigned by editing the user: a panel appears with
the enabled countries, and you tick the relevant ones. An editor **with no
areas assigned cannot change anything** — that is the state of every newly
created editor, and it is flagged in red on the users table.

An editor may use technicians from any country: they are a single pool.

---

<a name="maintenance-en"></a>
### 13. Maintenance

Administrators only.

**Licence.** Non-commercial use is free (CC BY-NC 4.0). For commercial use,
register the key you received here. Verification happens locally, without
contacting any server. Without a licence nothing is restricted: only a discreet
notice appears next to the name.

**Updates.** Shows the installed version and whether a newer one exists, with
the command to run on the server. The check runs once a day.

**Backup.** Downloads a JSON file with all data. Do it regularly and store it
securely: it contains personal data and hashed passwords.

**Restore.** Replaces **all** current data and requires typing `RESTORE` to
confirm. It runs in a single transaction: if anything fails, nothing is
applied.

**Holidays.** Calendar import per country and year, plus manual entry. The
summary at the top shows which countries still have none.

**Enabled countries.** Which countries appear when creating a project.
Countries with projects, editors or technicians assigned cannot be disabled.

**Change log.** Who did what and when, with before and after values.

---

<a name="faq-en"></a>
### 14. Frequently asked questions

**I forgot the administrator password.**
If a mail server is configured, use "Forgot your password?". Otherwise, someone
with server access runs:
```bash
docker exec -it progetto_backend node reset-admin.js address@example.com
```

**An editor cannot change anything.**
They probably have no areas assigned. Edit the user and tick at least one
country.

**A country does not appear when creating a project.**
Enable it under Maintenance → Enabled countries.

**Working days are not skipping holidays.**
They must be imported under Maintenance → Holidays, for that country and year.
The summary shows which ones are still empty.

**A technician is flagged as conflicting but is not.**
If they work mornings in one place and afternoons in another, set the *Mornings
only* and *Afternoons only* checkboxes on the two activities.

**I need to schedule work on a Sunday.**
You can: type the end date directly instead of using the work-days field. A
warning appears, but nothing is prevented.

**A technician lost their phone.**
Technicians page → 📱 → *Revoke* on the device. Access ends immediately. Then
generate a new link for the replacement phone.

**Changes do not show after an update.**
Reload with CTRL+F5. If it persists, try a private window.
