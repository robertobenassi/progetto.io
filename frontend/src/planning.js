// ---------------------------------------------------------------------------
// Calcoli di pianificazione: periodi di assegnazione, giorni lavorati,
// conflitti, occupazione, copertura del fabbisogno.
//
// Sono funzioni pure, senza React: le usano App.js e Reports.js, e lo script
// tools/verifica-calcoli.mjs le esegue fuori dal browser sui dati di prova.
// Per questo l'import porta l'estensione .js: il browser non ne ha bisogno,
// Node si'.
//
// L'idea su cui si regge tutto e' la "vista di assegnazione": un oggetto con
// la stessa forma di un'attivita' (start_date, end_date, day_part, ...) ma
// con le date ristrette al periodo di un tecnico. Le funzioni di dateUtils
// che lavorano sulle attivita' funzionano senza modifiche anche sulle viste.
// Quando un tecnico lavora per tutta la durata, la vista coincide con
// l'attivita', e i risultati sono quelli di sempre.
//
// Dalla 1.2.0 un periodo non e' piu' "tutti i giorni dal primo all'ultimo":
// e' fatto dei soli GIORNI LAVORATI. Le regole stanno nel calendario
// (makeCalendar, piu' sotto) e sono tre:
//   1. dentro un periodo i giorni di riposo dell'attivita' non si lavorano:
//      quelli fuori dalla sua settimana lavorativa (di norma il fine
//      settimana della nazione del progetto) e i festivi della nazione,
//      salvo le attivita' che lavorano anche nei festivi;
//   2. un periodo fatto SOLO di giorni di riposo si lavora tutto: e' cosi'
//      che si segna un sabato lavorato, e un intervento di sabato e
//      domenica non ha bisogno di altro;
//   3. le assenze del tecnico tolgono i giorni (o le mezze giornate) in cui
//      cadono.
// Tutto si conta in mezze giornate, come prima: 1 giorno = 2 unita'.
// ---------------------------------------------------------------------------
import { dayPartOf, isoDay, weekendDays } from './dateUtils.js';

// ---------------------------------------------------------------------------
// Giorni e mezze giornate
// ---------------------------------------------------------------------------

const GIORNO_MS = 86400000;

// Giorno successivo, sempre in AAAA-MM-GG. Si lavora in UTC: le stringhe
// si confrontano fra loro e il fuso del browser non deve entrarci.
const giornoDopo = (giorno) => {
  const d = new Date(giorno + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Numero del giorno dall'epoca e giorno della settimana (0 = domenica, come
// getDay e come i giorni di riposo salvati per nazione)
const numeroGiorno = (g) => Math.round(Date.parse(g + 'T00:00:00Z') / GIORNO_MS);
const giornoSettimana = (g) => new Date(g + 'T00:00:00Z').getUTCDay();

// Mezze giornate: l'unita' pari e' la mattina, la dispari il pomeriggio.
// Stessa numerazione di halfUnit in dateUtils.
export const morningUnit = (g) => numeroGiorno(g) * 2;
export const unitDay = (u) => new Date(Math.floor(u / 2) * GIORNO_MS).toISOString().slice(0, 10);

// Mezze giornate di una fascia: giornata intera, solo mattina, solo pomeriggio
const meta = (dp) => (dp === 'AM' ? [0] : dp === 'PM' ? [1] : [0, 1]);

// Tutti i giorni da un estremo all'altro, inclusi, in AAAA-MM-GG
export const dayList = (fromDate, toDate) => {
  const inizio = isoDay(fromDate);
  const fine = isoDay(toDate);
  const giorni = [];
  if (!inizio || !fine || inizio > fine) return giorni;
  for (let g = inizio; g <= fine; g = giornoDopo(g)) giorni.push(g);
  return giorni;
};

// I giorni lavorati di un intervallo secondo le regole 1 e 2: i giorni non di
// riposo; se sono tutti di riposo, tutti.
export const workedDayList = (fromDate, toDate, isRest) => {
  const tutti = dayList(fromDate, toDate);
  if (!isRest) return tutti;
  const utili = tutti.filter(g => !isRest(g));
  return utili.length ? utili : tutti;
};

// Data di fine partendo dall'inizio e da un numero di giorni lavorati: il
// primo giorno conta come uno. I giorni di riposo si saltano; se l'inizio
// cade in un giorno di riposo, quello conta (e' stato scelto apposta).
export const addWorkedDays = (startDate, n, isRest) => {
  const quanti = Math.max(1, Math.round(Number(n) || 1));
  let g = isoDay(startDate);
  if (!g) return g;
  let contati = 0;
  for (let guardia = 0; guardia < 3660; guardia++) {
    if (!isRest || !isRest(g) || guardia === 0) contati++;
    if (contati >= quanti) return g;
    g = giornoDopo(g);
  }
  return g;
};

// Tratti di un elenco ordinato di giorni lavorati, per i riepiloghi: due
// giorni separati solo da giorni di riposo stanno nello stesso tratto, cosi'
// due settimane dal lunedi' al venerdi' si leggono "dal 1 al 12".
export const workedRuns = (giorni, isRest = null) => {
  const out = [];
  giorni.forEach(g => {
    const ultimo = out[out.length - 1];
    if (ultimo) {
      let x = giornoDopo(ultimo.to);
      while (x < g && isRest && isRest(x)) x = giornoDopo(x);
      if (x === g) { ultimo.to = g; return; }
    }
    out.push({ from: g, to: g });
  });
  return out;
};

// Unita' di un elenco di giorni con una fascia
const unitaDiGiorni = (giorni, dp) => {
  const s = new Set();
  const m = meta(dp);
  giorni.forEach(g => {
    const u = morningUnit(g);
    m.forEach(h => s.add(u + h));
  });
  return s;
};

// Estremi di un intervallo in unita'; un estremo vuoto non limita
const limiti = (fromDate, toDate) => [
  fromDate ? morningUnit(isoDay(fromDate)) : -Infinity,
  toDate ? morningUnit(isoDay(toDate)) + 1 : Infinity,
];

// Giorni (meta' delle unita') compresi in un intervallo
export const countDays = (units, fromDate, toDate) => {
  const [u0, u1] = limiti(fromDate, toDate);
  let n = 0;
  units.forEach(u => { if (u >= u0 && u <= u1) n++; });
  return n / 2;
};

// Giorni gia' svolti (prima del giorno di riferimento) e da svolgere (dal
// giorno di riferimento in poi), dentro un intervallo. Il giorno corrente
// conta come da svolgere: l'attivita' non e' conclusa mentre la si guarda.
export const splitDone = (units, fromDate, toDate, refDate) => {
  const [u0, u1] = limiti(fromDate, toDate);
  const ref = morningUnit(isoDay(refDate));
  let fatte = 0;
  let restanti = 0;
  units.forEach(u => {
    if (u < u0 || u > u1) return;
    if (u < ref) fatte++; else restanti++;
  });
  return { done: fatte / 2, planned: restanti / 2 };
};

// ---------------------------------------------------------------------------
// Calendario di lavoro
//
// Raccoglie una volta sola tutto cio' che serve a decidere se un giorno e'
// lavorato: festivi per nazione, giorni di riposo per nazione, nazione dei
// progetti e dei tecnici, assenze. App.js e Reports.js lo costruiscono con
// useMemo e lo passano alle funzioni di questo file.
//
// NO_CALENDAR e' il calendario "vuoto": nessun riposo, nessuna assenza. Con
// quello ogni periodo vale dal primo all'ultimo giorno, come fino alla
// 1.1.0, ed e' il valore predefinito di tutte le funzioni.
// ---------------------------------------------------------------------------

const nazione = (c) => (c ? String(c).trim().toUpperCase() : null) || null;

// Settimana lavorativa propria dell'attivita': un elenco di giorni della
// settimana (0 = domenica). Vuota o assente vuol dire "quella della nazione".
export const workWeekOf = (a) => {
  let w = a && a.work_days;
  if (typeof w === 'string') {
    // PostgreSQL puo' restituire un array come testo, nella forma {1,2,3}
    w = w.replace(/[{}\s]/g, '').split(',').filter(Boolean).map(Number);
  }
  if (!Array.isArray(w)) return null;
  const giorni = [...new Set(w.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))];
  return giorni.length ? giorni.sort((x, y) => x - y) : null;
};

export const makeCalendar = ({
  holidays = [], weekendMap = {}, projects = [], technicians = [], absences = [],
  rest = true,
} = {}) => {
  const festivi = new Map();
  (holidays || []).forEach(h => {
    const c = nazione(h.country);
    const g = isoDay(h.date);
    if (!c || !g) return;
    if (!festivi.has(c)) festivi.set(c, new Set());
    festivi.get(c).add(g);
  });
  const nazioneProgetto = new Map((projects || []).map(p => [p.id, nazione(p.country)]));
  const nazioneTecnico = new Map((technicians || []).map(t => [t.id, nazione(t.home_country)]));

  const assenzePer = new Map();
  (absences || []).forEach(x => {
    if (!assenzePer.has(x.technician_id)) assenzePer.set(x.technician_id, []);
    assenzePer.get(x.technician_id).push(x);
  });

  const festivo = (c, g) => Boolean(c && festivi.has(c) && festivi.get(c).has(g));
  const fineSettimana = (c, g) => weekendDays(c, weekendMap).map(Number).includes(giornoSettimana(g));

  // Nazione di un'attivita' (o di una vista): quella del progetto, oppure
  // quella indicata direttamente, come fa la finestra prima di salvare
  const countryOf = (a) => (a && a.country ? nazione(a.country) : nazioneProgetto.get(a && a.project_id) || null);

  // Regola 1: riposo per l'attivita'
  const restDay = (a, g) => {
    if (!rest) return false;
    const c = countryOf(a);
    const settimana = workWeekOf(a);
    const fuori = settimana ? !settimana.includes(giornoSettimana(g)) : fineSettimana(c, g);
    if (fuori) return true;
    return !(a && a.work_holidays) && festivo(c, g);
  };

  // Riposo per il tecnico, secondo la nazione di base: serve alle
  // disponibilita' e al conteggio dei giorni di assenza
  const techRestDay = (techId, g) => {
    if (!rest) return false;
    const c = nazioneTecnico.get(techId) || null;
    return fineSettimana(c, g) || festivo(c, g);
  };

  // Unita' coperte dalle assenze di un tecnico, cosi' come sono registrate
  // (senza guardare i riposi: un permesso toglie quello che toglie)
  const coperturaAssenze = new Map();
  const absenceCover = (techId) => {
    if (coperturaAssenze.has(techId)) return coperturaAssenze.get(techId);
    const s = new Set();
    (assenzePer.get(techId) || []).forEach(x => {
      unitaDiGiorni(dayList(x.start_date, x.end_date), dayPartOf(x)).forEach(u => s.add(u));
    });
    coperturaAssenze.set(techId, s);
    return s;
  };

  // Le unita' calcolate si conservano per oggetto: un'attivita' ricaricata
  // dal server e' un oggetto nuovo, e il suo risultato si ricalcola.
  const memo = new WeakMap();
  const ricorda = (oggetto, chiave, calcolo) => {
    if (!oggetto || typeof oggetto !== 'object') return calcolo();
    if (!memo.has(oggetto)) memo.set(oggetto, new Map());
    const m = memo.get(oggetto);
    if (!m.has(chiave)) m.set(chiave, calcolo());
    return m.get(chiave);
  };

  // Giorni lavorati di un'attivita' senza guardare i tecnici (regole 1 e 2):
  // servono per le attivita' senza tecnici e per il fabbisogno.
  const activityDays = (a) => ricorda(a, `att|${isoDay(a.start_date)}|${isoDay(a.end_date)}`,
    () => workedDayList(a.start_date, a.end_date, g => restDay(a, g)));
  const activityUnits = (a) => ricorda(a, `attu|${isoDay(a.start_date)}|${isoDay(a.end_date)}|${dayPartOf(a)}`,
    () => unitaDiGiorni(activityDays(a), dayPartOf(a)));

  // Unita' pianificate di una vista, prima delle assenze (regole 1 e 2)
  const chiaveVista = (v) =>
    `${v.assignment_id}|${v.technician && v.technician.id}|${isoDay(v.start_date)}|${isoDay(v.end_date)}|${dayPartOf(v)}`;
  const plannedUnits = (v) => ricorda(v.activity || v, `pia|${chiaveVista(v)}`,
    () => unitaDiGiorni(workedDayList(v.start_date, v.end_date, g => restDay(v, g)), dayPartOf(v)));

  // Unita' lavorate di una vista: le pianificate meno le assenze (regola 3)
  const viewUnits = (v) => ricorda(v.activity || v, `lav|${chiaveVista(v)}`, () => {
    const pianificate = plannedUnits(v);
    const via = v.technician ? absenceCover(v.technician.id) : null;
    if (!via || !via.size) return pianificate;
    const s = new Set();
    pianificate.forEach(u => { if (!via.has(u)) s.add(u); });
    return s;
  });

  // Unita' di un'assenza da contare: i giorni lavorativi del tecnico che
  // copre, oppure tutti se cade solo in giorni di riposo
  const absenceUnits = (x) => unitaDiGiorni(
    workedDayList(x.start_date, x.end_date, g => techRestDay(x.technician_id, g)), dayPartOf(x));

  // Unita' in cui un tecnico e' disponibile in un intervallo: i giorni
  // lavorativi della sua nazione di base
  const techAvailableUnits = (techId, fromDate, toDate) => unitaDiGiorni(
    dayList(fromDate, toDate).filter(g => !techRestDay(techId, g)), 'FULL');

  // Festivo della nazione (anche quando l'attivita' lo lavora): per mostrarlo
  const isHoliday = (country, g) => festivo(nazione(country), g);

  return {
    rest, countryOf, restDay, techRestDay, isHoliday, absenceCover,
    activityDays, activityUnits, plannedUnits, viewUnits, absenceUnits, techAvailableUnits,
  };
};

export const NO_CALENDAR = makeCalendar({ rest: false });

// ---------------------------------------------------------------------------
// Viste di assegnazione
// ---------------------------------------------------------------------------

// Una vista per ogni periodo di ogni tecnico dell'attivita'.
//
// Il server manda due elenchi: technicians (le persone, una volta sola) e
// assignments (i periodi, con date vuote quando valgono per tutta la durata).
// Se assignments manca, come con un server precedente, ogni persona vale per
// tutta la durata: e' il comportamento di prima.
//
// La vista porta con se' l'attivita' originale in .activity. Chi apre la
// finestra di modifica deve usare quella: la vista ha date diverse, e
// salvarla riscriverebbe le date dell'attivita' con quelle del tecnico.
export const assignmentsOf = (a) => {
  if (!a) return [];
  const persone = new Map((a.technicians || []).map(t => [t.id, t]));
  const periodi = Array.isArray(a.assignments)
    ? a.assignments
    : (a.technicians || []).map(t => ({ id: null, technician_id: t.id, start_date: null, end_date: null }));

  const inizio = isoDay(a.start_date);
  const fine = isoDay(a.end_date);

  return periodi.map(p => {
    const t = persone.get(p.technician_id) || { id: p.technician_id, name: '—' };
    return {
      ...a,
      start_date: isoDay(p.start_date) || inizio,
      end_date: isoDay(p.end_date) || fine,
      technician: { id: t.id, name: t.name },
      assignment_id: p.id,
      partial: Boolean(p.start_date || p.end_date),
      activity: a,
    };
  });
};

// Chiave univoca di una vista: serve per segnare la singola barra nella
// vista per tecnico del Gantt. Con un server precedente le viste non hanno
// un identificativo, e la coppia attivita'-tecnico e' comunque univoca.
export const assignmentKey = (v) =>
  `${v.activity ? v.activity.id : v.id}:${v.assignment_id != null ? v.assignment_id : 't' + v.technician.id}`;

// Tutte le viste di un elenco di attivita', raggruppate per tecnico
export const assignmentsByTech = (activities) => {
  const m = new Map();
  (activities || []).forEach(a => {
    assignmentsOf(a).forEach(v => {
      if (!m.has(v.technician.id)) m.set(v.technician.id, []);
      m.get(v.technician.id).push(v);
    });
  });
  return m;
};

// Unita' lavorate di qualunque impegno: una vista (tecnico su un'attivita'),
// un'attivita' intera, oppure un'assenza.
export const workedUnits = (x, cal = NO_CALENDAR) => {
  if (x && x.technician) return cal.viewUnits(x);
  if (x && x.project_id === undefined && x.technician_id !== undefined) return cal.absenceUnits(x);
  return cal.activityUnits(x);
};

// Giorni uomo pianificati di un'attivita' in un intervallo (estremi vuoti:
// tutta l'attivita'). Ogni periodo di ogni tecnico conta i suoi giorni
// lavorati. Un'attivita' senza tecnici conta i tecnici richiesti, oppure una
// persona se il campo e' vuoto.
export const activityManDays = (a, cal = NO_CALENDAR, fromDate = null, toDate = null) => {
  const viste = assignmentsOf(a);
  if (viste.length) return viste.reduce((s, v) => s + countDays(cal.viewUnits(v), fromDate, toDate), 0);
  return (Number(a.required_technicians) || 1) * countDays(cal.activityUnits(a), fromDate, toDate);
};

// Come sopra, divisi fra gia' svolti e da svolgere rispetto al giorno di
// riferimento
export const activityManDaysSplit = (a, cal = NO_CALENDAR, fromDate, toDate, refDate) => {
  const viste = assignmentsOf(a);
  if (viste.length) {
    return viste.reduce((s, v) => {
      const x = splitDone(cal.viewUnits(v), fromDate, toDate, refDate);
      return { done: s.done + x.done, planned: s.planned + x.planned };
    }, { done: 0, planned: 0 });
  }
  const n = Number(a.required_technicians) || 1;
  const x = splitDone(cal.activityUnits(a), fromDate, toDate, refDate);
  return { done: n * x.done, planned: n * x.planned };
};

// ---------------------------------------------------------------------------
// Conflitti fra impegni dello stesso tecnico
// ---------------------------------------------------------------------------

// Prima e ultima unita' in comune fra due insiemi, oppure null
const comuni = (a, b) => {
  const [piccolo, grande] = a.size <= b.size ? [a, b] : [b, a];
  let min = Infinity;
  let max = -Infinity;
  piccolo.forEach(u => {
    if (grande.has(u)) {
      if (u < min) min = u;
      if (u > max) max = u;
    }
  });
  return min === Infinity ? null : { min, max };
};

// Viste dello stesso tecnico ordinate per inizio, con le coppie che hanno
// davvero mezze giornate lavorate in comune. Mattina e pomeriggio dello
// stesso giorno sono compatibili; un fine settimana di riposo non e' un
// conflitto; un giorno di ferie neppure, perche' non si lavora.
// Le coppie si cercano solo fra viste i cui intervalli si toccano: ordinate
// per inizio, appena una inizia dopo la fine della prima le successive non
// possono sovrapporsi.
const coppieInConflitto = (list, cal) => {
  const ordinate = [...list].sort((x, y) => (x.start_date < y.start_date ? -1 : x.start_date > y.start_date ? 1 : 0));
  const unita = ordinate.map(v => cal.viewUnits(v));
  const coppie = [];
  for (let i = 0; i < ordinate.length; i++) {
    for (let j = i + 1; j < ordinate.length; j++) {
      if (ordinate[j].start_date > ordinate[i].end_date) break;
      const c = comuni(unita[i], unita[j]);
      if (c) coppie.push({ i, j, ...c });
    }
  }
  return { ordinate, coppie };
};

// Un conflitto e' un PERIODO di sovrapposizione per tecnico, con tutte le
// assegnazioni coinvolte. Due periodi dello stesso tecnico sulla stessa
// attivita' non si sovrappongono mai: il server lo impedisce.
export const findConflicts = (activities, cal = NO_CALENDAR) => {
  const conflicts = [];
  assignmentsByTech(activities).forEach((list, techId) => {
    if (list.length < 2) return;
    const { ordinate, coppie } = coppieInConflitto(list, cal);
    if (!coppie.length) return;

    // Solo le assegnazioni realmente in conflitto entrano nei gruppi
    const coinvolte = [...new Set(coppie.flatMap(c => [c.i, c.j]))].sort((x, y) => x - y);

    // Gruppi: assegnazioni in conflitto i cui intervalli si concatenano
    const gruppi = [];
    let gruppo = null;
    let fineGruppo = null;
    coinvolte.forEach(i => {
      const v = ordinate[i];
      if (gruppo && v.start_date <= fineGruppo) {
        gruppo.push(i);
        if (v.end_date > fineGruppo) fineGruppo = v.end_date;
      } else {
        gruppo = [i];
        fineGruppo = v.end_date;
        gruppi.push(gruppo);
      }
    });

    gruppi.forEach(g => {
      if (g.length < 2) return;
      const dentro = new Set(g);
      // Dalla prima all'ultima mezza giornata in cui due impegni del gruppo
      // coincidono davvero
      let primo = Infinity;
      let ultimo = -Infinity;
      coppie.forEach(c => {
        if (!dentro.has(c.i) || !dentro.has(c.j)) return;
        primo = Math.min(primo, c.min);
        ultimo = Math.max(ultimo, c.max);
      });
      if (primo === Infinity) return;
      const viste = g.map(i => ordinate[i]);
      conflicts.push({
        technicianId: techId,
        technicianName: viste[0].technician.name,
        startDate: unitDay(primo),
        endDate: unitDay(ultimo),
        periodStart: viste.map(v => v.start_date).sort()[0],
        periodEnd: viste.map(v => v.end_date).sort().pop(),
        activities: viste,
      });
    });
  });
  return conflicts;
};

// Segni di conflitto per il Gantt.
// activityIds: attivita' con almeno un periodo in conflitto, per la vista
//   per progetto, dove ogni attivita' ha una barra sola.
// assignmentKeys: i singoli periodi in conflitto, per la vista per tecnico:
//   la barra di Luca non si colora per un conflitto che riguarda Marco.
// Il calcolo resta GLOBALE, mai filtrato: un tecnico impegnato in Spagna
// deve risultare occupato anche guardando solo l'Italia.
// unitsByKey: per ogni periodo in conflitto, le mezze giornate in cui lo e':
//   il Gantt le segna sulla barra, cosi' si vede dove sta il conflitto.
export const conflictMarks = (activities, cal = NO_CALENDAR) => {
  const activityIds = new Set();
  const assignmentKeys = new Set();
  const unitsByKey = new Map();
  assignmentsByTech(activities).forEach(list => {
    if (list.length < 2) return;
    const { ordinate, coppie } = coppieInConflitto(list, cal);
    coppie.forEach(c => {
      const a = cal.viewUnits(ordinate[c.i]);
      const b = cal.viewUnits(ordinate[c.j]);
      [ordinate[c.i], ordinate[c.j]].forEach(v => {
        activityIds.add(v.activity.id);
        const k = assignmentKey(v);
        assignmentKeys.add(k);
        if (!unitsByKey.has(k)) unitsByKey.set(k, new Set());
        const s = unitsByKey.get(k);
        a.forEach(u => { if (b.has(u)) s.add(u); });
      });
    });
  });
  return { activityIds, assignmentKeys, unitsByKey };
};

// Assenze che cadono nei giorni in cui un tecnico era pianificato.
// Dalla 1.2.0 non sono un errore: quei giorni non si contano piu' come
// lavorati, e la copertura mostra chi manca. Restano un'informazione utile,
// perche' chi pianifica deve sapere che in quei giorni serve qualcun altro.
// Conta solo il periodo del tecnico: un permesso nei giorni in cui sulla
// stessa attivita' lavora un altro non riguarda questa attivita'.
//
// Restituisce una mappa id attivita' -> elenco (tech, type, from, to,
// dayPart, assignment).
export const findAbsenceConflicts = (activities, absences, cal = NO_CALENDAR) => {
  const m = new Map();
  if (!absences || !absences.length) return m;
  const perTecnico = new Map();
  absences.forEach(x => {
    if (!perTecnico.has(x.technician_id)) perTecnico.set(x.technician_id, []);
    perTecnico.get(x.technician_id).push(x);
  });
  (activities || []).forEach(a => {
    assignmentsOf(a).forEach(v => {
      const sue = perTecnico.get(v.technician.id);
      if (!sue) return;
      const pianificate = cal.plannedUnits(v);
      sue.forEach(ab => {
        if (isoDay(ab.end_date) < v.start_date || isoDay(ab.start_date) > v.end_date) return;
        const coperte = unitaDiGiorni(dayList(ab.start_date, ab.end_date), dayPartOf(ab));
        if (!comuni(pianificate, coperte)) return;
        if (!m.has(a.id)) m.set(a.id, []);
        m.get(a.id).push({
          tech: v.technician.name,
          techId: v.technician.id,
          type: ab.type,
          from: ab.start_date,
          to: ab.end_date,
          dayPart: dayPartOf(ab),
          assignment: v,
        });
      });
    });
  });
  return m;
};

// ---------------------------------------------------------------------------
// Occupazione
// ---------------------------------------------------------------------------

// Giorni occupati in un periodo, contati UNA volta sola anche quando due
// impegni si sovrappongono. Si ragiona in mezze giornate: cinque mattine
// fanno 2,5 giorni, e una mattina e un pomeriggio dello stesso giorno fanno
// un giorno intero.
// Accetta viste di assegnazione, attivita' e assenze (vedi workedUnits).
export const occupiedDays = (items, fromDate, toDate, cal = NO_CALENDAR) => {
  const [u0, u1] = limiti(fromDate, toDate);
  const occupate = new Set();
  (items || []).forEach(x => {
    workedUnits(x, cal).forEach(u => { if (u >= u0 && u <= u1) occupate.add(u); });
  });
  return occupate.size / 2;
};

// ---------------------------------------------------------------------------
// Copertura del fabbisogno
// ---------------------------------------------------------------------------

// Periodi in cui un'attivita' ha meno tecnici di quelli richiesti.
//
// Si conta giorno per giorno quanti tecnici lavorano, non quanti nomi sono
// assegnati: Marco i primi cinque giorni e Luca gli altri cinque sono due
// nomi, ma ogni giorno c'e' una persona sola.
// Si guardano solo i giorni lavorati dell'attivita': nel fine settimana di
// riposo non manca nessuno. Un tecnico in ferie non e' presente; con mezza
// giornata di permesso conta per meta'.
//
// Restituisce i tratti con la stessa copertura insufficiente:
// [{ from, to, days, present, required, missing }], dove missing sono i
// giorni uomo mancanti (con mezza giornata ogni giorno vale 0,5). Un tratto
// scavalca i giorni di riposo: venerdi' e lunedi' scoperti sono un tratto
// solo, di due giorni.
export const coverageGaps = (a, fromDate, toDate, cal = NO_CALENDAR) => {
  const richiesti = Number(a && a.required_technicians);
  if (!richiesti) return [];

  const da = isoDay(fromDate);
  const al = isoDay(toDate);
  const giorni = cal.activityDays(a).filter(g => (!da || g >= da) && (!al || g <= al));
  if (!giorni.length) return [];

  const viste = assignmentsOf(a).map(v => cal.viewUnits(v));
  const mezze = meta(dayPartOf(a));
  const peso = mezze.length / 2;
  const tratti = [];
  let corrente = null;

  for (const g of giorni) {
    // Presenze del giorno: ogni tecnico vale per la parte di fascia che lavora
    const u = morningUnit(g);
    let presenti = 0;
    for (const s of viste) {
      let n = 0;
      for (const h of mezze) if (s.has(u + h)) n++;
      presenti += n / mezze.length;
    }
    if (presenti < richiesti) {
      if (corrente && corrente.present === presenti) {
        corrente.to = g;
        corrente.days += 1;
      } else {
        corrente = { from: g, to: g, days: 1, present: presenti, required: richiesti };
        tratti.push(corrente);
      }
    } else {
      corrente = null;
    }
  }
  tratti.forEach(t => { t.missing = t.days * (t.required - t.present) * peso; });
  return tratti;
};

// ---------------------------------------------------------------------------
// Periodi nella finestra dell'attivita'
//
// La griglia delle presenze ragiona per giorni lavorati; il server vuole
// periodi. Un periodo e' { start_date, end_date } con la stessa convenzione
// del server: una data vuota (null) vale "come l'attivita'", cosi' chi
// lavora fino all'ultimo giorno continua a farlo se l'attivita' si allunga.
//
// isRest dice se un giorno e' di riposo per l'attivita'. Senza, ogni giorno
// e' lavorativo e i periodi sono tratti di giorni consecutivi, come prima.
// ---------------------------------------------------------------------------

// Giorni lavorati di un elenco di periodi, ristretti all'attivita'
export const periodsToDays = (periods, fromDate, toDate, isRest = null) => {
  const inizio = isoDay(fromDate);
  const fine = isoDay(toDate);
  const giorni = new Set();
  (periods || []).forEach(p => {
    const s = isoDay(p.start_date) || inizio;
    const e = isoDay(p.end_date) || fine;
    for (const g of workedDayList(s > inizio ? s : inizio, e < fine ? e : fine, isRest)) giorni.add(g);
  });
  return giorni;
};

// Periodi ricavati dai giorni lavorati, i piu' lunghi possibile.
// Due tipi di periodo, secondo le regole del calendario:
//   - lavorativo: dal primo all'ultimo giorno lavorativo di un tratto, e
//     puo' scavalcare i giorni di riposo NON lavorati (restano riposo);
//   - di riposo: giorni di riposo lavorati e consecutivi, da soli.
// Un sabato lavorato fra due settimane diventa quindi tre periodi: la
// prima settimana, il sabato, la seconda settimana.
// Un estremo resta vuoto quando il periodo arriva fino all'estremo
// dell'attivita' (contando come "fino all'estremo" anche i soli giorni di
// riposo non lavorati che li separano), come fa il server.
export const daysToPeriods = (daySet, fromDate, toDate, isRest = null) => {
  const giorni = dayList(fromDate, toDate);
  const riposo = isRest || (() => false);
  const periodi = [];
  let corrente = null;   // { tipo: 'L' | 'R', da, a } con indici nei giorni

  const chiudi = () => {
    if (corrente) periodi.push(corrente);
    corrente = null;
  };

  giorni.forEach((g, i) => {
    const lavorato = daySet.has(g);
    const diRiposo = riposo(g);
    if (diRiposo && lavorato) {
      if (corrente && corrente.tipo === 'R' && corrente.a === i - 1) corrente.a = i;
      else { chiudi(); corrente = { tipo: 'R', da: i, a: i }; }
    } else if (diRiposo) {
      // Un periodo lavorativo resta aperto e lo scavalca; uno di riposo finisce
      if (corrente && corrente.tipo === 'R') chiudi();
    } else if (lavorato) {
      if (corrente && corrente.tipo === 'L') corrente.a = i;
      else { chiudi(); corrente = { tipo: 'L', da: i, a: i }; }
    } else {
      chiudi();
    }
  });
  chiudi();

  // Solo giorni di riposo non lavorati fra due indici (esclusi)
  const soloRiposo = (da, a) => {
    for (let k = da; k <= a; k++) if (!riposo(giorni[k]) || daySet.has(giorni[k])) return false;
    return true;
  };
  const ultimo = giorni.length - 1;
  return periodi.map(p => {
    const vuotoInizio = p.da === 0 || (p.tipo === 'L' && soloRiposo(0, p.da - 1));
    const vuotoFine = p.a === ultimo || (p.tipo === 'L' && soloRiposo(p.a + 1, ultimo));
    return {
      start_date: vuotoInizio ? null : giorni[p.da],
      end_date: vuotoFine ? null : giorni[p.a],
    };
  });
};

// Sposta le date esplicite di un certo numero di giorni. Serve quando si
// cambia l'inizio dell'attivita' e la fine la segue: i periodi traslano
// insieme. Le date vuote restano vuote, perche' seguono gia' l'attivita'.
export const shiftPeriods = (periods, giorni) => (periods || []).map(p => {
  const sposta = (d) => {
    if (!d) return null;
    const x = new Date(isoDay(d) + 'T00:00:00Z');
    x.setUTCDate(x.getUTCDate() + giorni);
    return x.toISOString().slice(0, 10);
  };
  return { start_date: sposta(p.start_date), end_date: sposta(p.end_date) };
});

// Elenco da inviare al server per i tecnici selezionati. Chi non ha periodi
// registrati lavora per tutta la durata. I periodi passano per i giorni:
// cosi' quelli rimasti fuori dall'attivita' vengono tagliati, eventuali
// sovrapposizioni si fondono, e chi non ha nessun giorno viene tolto.
export const toAssignments = (technicianIds, periodsByTech, fromDate, toDate, isRest = null) => {
  const out = [];
  (technicianIds || []).forEach(id => {
    const periodi = (periodsByTech && periodsByTech[id]) || [{ start_date: null, end_date: null }];
    const giorni = periodsToDays(periodi, fromDate, toDate, isRest);
    daysToPeriods(giorni, fromDate, toDate, isRest).forEach(p => out.push({ technician_id: id, ...p }));
  });
  return out;
};
