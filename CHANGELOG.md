*[English version below](#english)*

# Novità / Changelog

---

## Italiano

### 1.2.0 — 14 ottobre 2026

#### Giorni lavorati

- Un periodo di lavoro non vale più tutti i giorni dal primo all'ultimo:
  contano solo i giorni lavorati. I giorni di riposo della nazione del
  progetto (di norma sabato e domenica) e i suoi festivi restano riposo anche
  dentro un periodo.
- Ogni attività può avere la sua settimana lavorativa, per esempio dal lunedì
  al sabato, e lavorare anche nei festivi.
- Un giorno di riposo lavorato da un tecnico si segna nella griglia delle
  presenze. Un'attività fatta solo di giorni di riposo, come un intervento nel
  fine settimana, si lavora senza bisogno di altro.
- Le assenze tolgono i loro giorni, anche a mezza giornata: chi è in ferie non
  risulta al lavoro e la copertura mostra chi manca. Non sono più conflitti,
  ma un'informazione per chi pianifica.

#### Gantt

- La barra è piena solo nei giorni lavorati; nei riposi resta il contorno, così
  un sabato lavorato si vede a colpo d'occhio.
- I giorni persi per un'assenza sono tratteggiati in arancione; le righe del
  conflitto compaiono solo nei giorni di doppia assegnazione.
- Il carico di ogni tecnico si confronta con i suoi giorni lavorativi.
- I festivi si colorano anche senza filtro quando tutti i progetti sono della
  stessa nazione.

#### Finestra dell'attività

- Pulsanti dei giorni di lavoro e casella "Si lavora anche nei festivi".
- Giorni uomo pianificati al netto delle assenze; senza tecnici, la stima dai
  tecnici richiesti.
- La durata in giorni lavorativi segue la settimana dell'attività.
- Nella griglia delle presenze i riposi restano spenti finché non li si accende
  uno per uno; un trascinamento iniziato su un giorno feriale non accende il
  fine settimana che attraversa.
- Cambiando progetto, festivi e riposi seguono la nazione del nuovo progetto.

#### Report

- Tutti i report contano i giorni lavorati; le attività senza tecnici contano i
  tecnici richiesti.
- Venduto e svolto confronta sempre l'intero progetto alla data di oggi. Lo
  svolto sono i giorni già trascorsi; il progresso dichiarato resta a parte.
  Le attività sono in ordine di data.
- Carico tecnici: i disponibili sono i giorni lavorativi del tecnico meno le
  assenze.
- Fabbisogno salta i giorni di riposo e conta mezzo tecnico per chi ha mezza
  giornata di permesso.

#### Conflitti

- Si cercano solo nei giorni lavorati: un fine settimana di riposo o un giorno
  di ferie non sono un conflitto.
- Il dettaglio mostra i giorni in cui gli impegni coincidono davvero.

#### App dei tecnici

- Mostra solo i giorni lavorati. Nei giorni di ferie resta la sola assenza, e i
  colleghi sono quelli presenti quel giorno.

#### Installazione e aggiornamento

- Due campi nuovi sulle attività, creati da soli all'avvio del backend. I dati
  esistenti non cambiano, ma i conteggi sì: i fine settimana dentro le attività
  esistenti diventano riposo, quindi giorni uomo e carico possono scendere. Se
  in un'attività si lavorava davvero di sabato, va segnato nella griglia o con
  il pulsante "sab".
- I festivi vanno caricati per ogni anno e per ogni nazione in uso: senza, un
  festivo dell'anno successivo risulta lavorativo.
- Per aggiornare: `pg_dump` del database, poi `git pull` e
  `docker compose up -d --build`.

### 1.1.0 — 6 ottobre 2026

#### Nuove funzioni

- **Assegnazioni con date proprie.** Un tecnico può lavorare solo su una parte
  di un'attività, anche in più periodi separati: per esempio la prima e la
  terza settimana di una fase di test, mentre nella seconda lo sostituisce un
  collega. Le assegnazioni create con la 1.0.0 valgono per tutta la durata e
  continuano a funzionare senza conversioni.
- **Griglia delle presenze** nella finestra dell'attività: una riga per
  tecnico e una colonna per giorno. Un clic accende o spegne un giorno,
  trascinando se ne cambiano molti insieme, con il mouse o con il dito. La
  griglia mostra le assenze del tecnico (anche di mezza giornata), i giorni in
  cui è già impegnato altrove, la copertura giorno per giorno e i giorni uomo
  pianificati.
- **Tecnici richiesti** per ogni attività e nuovo report **Fabbisogno**: elenca
  i periodi in cui un'attività ha meno tecnici presenti di quelli richiesti,
  con i giorni uomo mancanti, a partire dalle scoperture più vicine.
- **Giorni uomo venduti** per progetto o per singola fase, e report **Venduto e
  svolto** con venduto, previsto, svolto e residuo (positivo se restano giorni
  da fare, negativo se si è sforato).
- **App dei tecnici**: ognuno vede il proprio periodo di lavoro, la fascia di
  ogni giorno ("solo mattina", "solo pomeriggio"), i colleghi presenti quel
  giorno e la fascia delle assenze di mezza giornata.

#### Calcoli

- Conflitti, carico, report e agenda ragionano sul periodo di ciascun tecnico,
  non più sull'attività intera.
- Carico tecnici e Disponibili contano una volta sola i giorni con impegni
  sovrapposti: prima un tecnico con due attività contemporanee risultava
  occupato il doppio dei giorni reali. I conflitti restano segnalati nella
  vista Conflitti.
- Venduto e svolto ragiona in giorni uomo, come il report Giorni uomo.
- Situazione del giorno (prima "Oggi") distingue mattina e pomeriggio: un
  permesso pomeridiano non nasconde più la mattina di lavoro.

#### Correzioni

- Il ripristino dei backup dall'interfaccia funziona di nuovo, anche per i
  backup creati con la 1.0.0.
- I tecnici si possono eliminare; l'account creato in automatico per loro viene
  rimosso insieme.
- La duplicazione di un progetto conserva la fascia (solo mattine o solo
  pomeriggi), i giorni venduti, i tecnici richiesti e i periodi dei tecnici.
- L'agenda dell'app dei tecnici esclude le attività archiviate.
- Vista Conflitti: plurali corretti, fascia delle assenze e periodo di ciascun
  tecnico.
- Gantt: le assenze di mezza giornata occupano mezza cella; le barre compatte
  della vista per tecnico sono cliccabili.
- Finestra dell'attività: la durata indica correttamente giorni di calendario,
  giorni lavorativi e, per le mezze giornate, i giorni di lavoro equivalenti.
- Report: colonne dimensionate sul contenuto; cambiando la data iniziale la
  finale si sposta con lei; avviso quando il periodo è rovesciato.
- Traduzioni: etichette duplicate e accenti mancanti.

#### Installazione e aggiornamento

- Le migrazioni del database si applicano da sole all'avvio del backend.
  Prima di aggiornare conviene comunque un `pg_dump` del database.
- Per aggiornare un'installazione 1.0.0: `git pull`, poi
  `docker compose up -d --build`.
- La compilazione del frontend non genera più le source map: richiede meno
  memoria e non pubblica il codice sorgente leggibile. Su server con 2 GB di
  memoria o meno conviene comunque attivare uno swap prima di compilare.

---

<a name="english"></a>

## English

### 1.2.0 — 14 October 2026

#### Worked days

- A work period no longer counts every day from the first to the last: only
  the days actually worked count. The rest days of the project's country
  (usually Saturday and Sunday) and its public holidays stay rest days, even
  inside a period.
- Each activity can have its own working week, for example Monday to
  Saturday, and can also work on public holidays.
- A rest day worked by a technician is marked on the presence grid. An
  activity made only of rest days, such as a weekend intervention, is worked
  with no further steps.
- Absences remove their days, half days included: someone on holiday is not
  counted as working and the coverage shows who is missing. They are no longer
  conflicts, but information for whoever plans.

#### Gantt

- The bar is filled only on worked days; on rest days only the outline
  remains, so a worked Saturday stands out at a glance.
- Days lost to an absence are hatched in orange; conflict stripes appear only
  on double-booked days.
- Each technician's workload is compared with their working days.
- Holidays are shaded even without a filter when all projects are in the same
  country.

#### Activity window

- Working-day buttons and a "Work on public holidays too" checkbox.
- Planned man-days net of absences; with no technicians, an estimate from the
  required technicians.
- The duration in working days follows the activity's working week.
- On the presence grid, rest days stay off until switched on one by one; a
  drag started on a weekday does not switch on the weekend it crosses.
- Changing the project, holidays and rest days follow the new project's
  country.

#### Reports

- All reports count worked days; activities with no technicians count the
  required technicians.
- Sold vs done always compares the whole project as of today. Done means the
  days already past; the declared progress is kept separate. Activities are
  in date order.
- Workload: available days are the technician's working days minus absences.
- Staffing gaps skips rest days and counts half a technician for someone on a
  half-day leave.

#### Conflicts

- They are looked for only on worked days: a weekend off or a day of holiday
  is not a conflict.
- The details show the days when the assignments really overlap.

#### Technician app

- Shows only the days worked. On holiday only the absence remains, and
  colleagues are those present that day.

#### Installation and upgrade

- Two new activity fields, created automatically when the backend starts.
  Existing data does not change, but the counts do: weekends inside existing
  activities become rest days, so man-days and workload may go down. If an
  activity really worked on Saturdays, mark it on the grid or with the "Sat"
  button.
- Holidays must be loaded for each year and each country in use: otherwise a
  holiday of the following year counts as a working day.
- To upgrade: `pg_dump` the database, then `git pull` and
  `docker compose up -d --build`.

### 1.1.0 — 6 October 2026

#### New features

- **Assignments with their own dates.** A technician can work on just part of
  an activity, even in several separate periods: for example the first and
  third week of a test phase, while a colleague covers the second. Assignments
  created with 1.0.0 cover the whole duration and keep working without any
  conversion.
- **Presence grid** in the activity window: one row per technician and one
  column per day. A click switches a day on or off, dragging changes many at
  once, with a mouse or a finger. The grid shows the technician's absences
  (half days included), the days they are already booked elsewhere, the
  day-by-day coverage and the planned man-days.
- **Required technicians** for each activity and a new **Staffing gaps**
  report: it lists the periods where an activity has fewer technicians than
  required, with the missing man-days, nearest gaps first.
- **Sold man-days** per project or per phase, and a **Sold vs done** report
  with sold, planned, done and remaining days (positive when days are left,
  negative when the budget is exceeded).
- **Technician app**: everyone sees their own work period, the part of each
  day ("mornings only", "afternoons only"), the colleagues present that day
  and the part of the day covered by half-day absences.

#### Calculations

- Conflicts, workload, reports and agenda work on each technician's period
  instead of the whole activity.
- Workload and Available count days with overlapping assignments only once:
  before, a technician with two simultaneous activities appeared busy twice
  the real number of days. Conflicts are still flagged in the Conflicts view.
- Sold vs done works in man-days, like the Man-days report.
- Daily status (formerly "Today") tells mornings and afternoons apart: an
  afternoon leave no longer hides a morning of work.

#### Fixes

- Restoring a backup from the interface works again, including backups made
  with 1.0.0.
- Technicians can be deleted; the account created automatically for them is
  removed with them.
- Duplicating a project keeps the part of the day (mornings or afternoons
  only), sold days, required technicians and technician periods.
- The technician app's agenda leaves out archived activities.
- Conflicts view: correct singular and plural forms, absence half days and
  each technician's period.
- Gantt: half-day absences take half a cell; compact bars in the
  by-technician view can be clicked.
- Activity window: the duration correctly shows calendar days, working days
  and, for half days, the equivalent working days.
- Reports: column widths follow their content; changing the start date moves
  the end date with it; a warning appears when the period is reversed.
- Translations: duplicate labels and missing accents.

#### Installation and upgrade

- Database migrations run automatically when the backend starts. A
  `pg_dump` of the database before upgrading is still recommended.
- To upgrade a 1.0.0 installation: `git pull`, then
  `docker compose up -d --build`.
- The frontend build no longer generates source maps: it needs less memory
  and no longer publishes readable source code. On servers with 2 GB of memory
  or less, enabling swap before building is still recommended.
