// ---------------------------------------------------------------------------
// Calcoli di pianificazione: periodi di assegnazione, conflitti, occupazione,
// copertura del fabbisogno.
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
// ---------------------------------------------------------------------------
import {
  dayPartOf, activitiesOverlap, halfUnit, actStartUnit, actEndUnit, isoDay,
} from './dateUtils.js';

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

// ---------------------------------------------------------------------------
// Conflitti fra impegni dello stesso tecnico
// ---------------------------------------------------------------------------

// Un conflitto e' un PERIODO di sovrapposizione per tecnico, con tutte le
// assegnazioni coinvolte. Stessa logica della versione per attivita', ma su
// ogni periodo del tecnico: un tecnico che in una settimana lavora altrove,
// mentre su questa attivita' lavorano altri, non e' in conflitto.
//
// Due periodi dello stesso tecnico sulla stessa attivita' non si
// sovrappongono mai: il server lo impedisce.
export const findConflicts = (activities) => {
  const conflicts = [];
  assignmentsByTech(activities).forEach((list, techId) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((x, y) => new Date(x.start_date) - new Date(y.start_date));

    // Solo le assegnazioni realmente in conflitto entrano nei gruppi.
    // Il confronto passa da activitiesOverlap, che tiene conto delle fasce:
    // mattina e pomeriggio dello stesso giorno sono compatibili.
    const inConflitto = sorted.filter(a =>
      sorted.some(b => b !== a && activitiesOverlap(a, b)));
    if (inConflitto.length < 2) return;

    let cluster = [inConflitto[0]];
    let maxEnd = new Date(inConflitto[0].end_date);

    const flush = () => {
      if (cluster.length < 2) return;
      const starts = cluster.map(a => new Date(a.start_date));
      const ends = cluster.map(a => new Date(a.end_date));

      // Sovrapposizione: dalla prima all'ultima data in cui due impegni del
      // gruppo coincidono davvero. La versione precedente prendeva l'inizio
      // piu' tardo e la fine piu' presto: con tre impegni che non si
      // sovrappongono tutti fra loro dava una fine prima dell'inizio.
      let primo = Infinity;
      let ultimo = -Infinity;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          if (!activitiesOverlap(cluster[i], cluster[j])) continue;
          primo = Math.min(primo, Math.max(starts[i].getTime(), starts[j].getTime()));
          ultimo = Math.max(ultimo, Math.min(ends[i].getTime(), ends[j].getTime()));
        }
      }

      conflicts.push({
        technicianId: techId,
        technicianName: cluster[0].technician.name,
        startDate: new Date(primo).toISOString().split('T')[0],
        endDate: new Date(ultimo).toISOString().split('T')[0],
        periodStart: new Date(Math.min(...starts)).toISOString().split('T')[0],
        periodEnd: new Date(Math.max(...ends)).toISOString().split('T')[0],
        activities: cluster,
      });
    };

    for (let i = 1; i < inConflitto.length; i++) {
      const cur = inConflitto[i];
      if (new Date(cur.start_date) <= maxEnd) {
        cluster.push(cur);
        if (new Date(cur.end_date) > maxEnd) maxEnd = new Date(cur.end_date);
      } else {
        flush();
        cluster = [cur];
        maxEnd = new Date(cur.end_date);
      }
    }
    flush();
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
export const conflictMarks = (activities) => {
  const activityIds = new Set();
  const assignmentKeys = new Set();
  assignmentsByTech(activities).forEach(list => {
    // Confronto a coppie: con le fasce la sovrapposizione non e' transitiva.
    // Il costo resta contenuto perche' si confrontano solo i periodi dello
    // stesso tecnico.
    const sorted = [...list].sort((x, y) => new Date(x.start_date) - new Date(y.start_date));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        // Ordinati per data: appena uno inizia dopo la fine del primo,
        // i successivi non possono sovrapporsi.
        if (new Date(sorted[j].start_date) > new Date(sorted[i].end_date)) break;
        if (activitiesOverlap(sorted[i], sorted[j])) {
          activityIds.add(sorted[i].activity.id);
          activityIds.add(sorted[j].activity.id);
          assignmentKeys.add(assignmentKey(sorted[i]));
          assignmentKeys.add(assignmentKey(sorted[j]));
        }
      }
    }
  });
  return { activityIds, assignmentKeys };
};

// Periodi di lavoro che cadono su un'assenza dello stesso tecnico.
// E' un conflitto di natura diversa dalla doppia assegnazione: va
// segnalato, mai impedito, perche' capita di richiamare qualcuno dalle ferie.
// Conta solo il periodo del tecnico: un permesso nei giorni in cui sulla
// stessa attivita' lavora un altro non e' un conflitto.
//
// Restituisce una mappa id attivita' -> elenco, con gli stessi campi di
// prima (tech, type, from, to) piu' quelli che servono a mostrare la fascia
// e il periodo del tecnico.
export const findAbsenceConflicts = (activities, absences) => {
  const m = new Map();
  if (!absences || !absences.length) return m;
  const perTecnico = new Map();
  absences.forEach(x => {
    if (!perTecnico.has(x.technician_id)) perTecnico.set(x.technician_id, []);
    perTecnico.get(x.technician_id).push(x);
  });
  (activities || []).forEach(a => {
    assignmentsOf(a).forEach(v => {
      (perTecnico.get(v.technician.id) || []).forEach(ab => {
        if (activitiesOverlap(v, ab)) {
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
        }
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
// Accetta viste di assegnazione, attivita' e assenze: tutto cio' che ha
// start_date, end_date e una fascia.
export const occupiedDays = (items, fromDate, toDate) => {
  const u0 = halfUnit(fromDate, 'AM', false);
  const u1 = halfUnit(toDate, 'PM', true);
  const occupate = new Set();
  (items || []).forEach(x => {
    const s = Math.max(actStartUnit(x), u0);
    const e = Math.min(actEndUnit(x), u1);
    if (e < s) return;
    const dp = dayPartOf(x);
    for (let u = s; u <= e; u++) {
      // Le unita' pari sono le mattine, le dispari i pomeriggi
      if (dp === 'FULL' || (dp === 'AM' && u % 2 === 0) || (dp === 'PM' && u % 2 === 1)) {
        occupate.add(u);
      }
    }
  });
  return occupate.size / 2;
};

// ---------------------------------------------------------------------------
// Copertura del fabbisogno
// ---------------------------------------------------------------------------

// Giorno successivo, sempre in AAAA-MM-GG. Si lavora in UTC: le stringhe
// si confrontano fra loro e il fuso del browser non deve entrarci.
const giornoDopo = (giorno) => {
  const d = new Date(giorno + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

// Periodi in cui un'attivita' ha meno tecnici di quelli richiesti.
//
// Si conta giorno per giorno quanti tecnici sono presenti, non quanti nomi
// sono assegnati: Marco i primi cinque giorni e Luca gli altri cinque sono
// due nomi, ma ogni giorno c'e' una persona sola.
// La fascia e' dell'attivita' ed e' uguale per tutti, quindi basta il giorno.
// Le assenze non riducono la copertura: un tecnico assegnato durante
// un'assenza compare gia' fra i conflitti, e per escluderlo da quei giorni
// si accorcia il suo periodo.
//
// Restituisce i tratti consecutivi con la stessa copertura insufficiente:
// [{ from, to, days, present, required, missing }], dove missing sono i
// giorni uomo mancanti (con mezza giornata ogni giorno vale 0,5).
export const coverageGaps = (a, fromDate, toDate) => {
  const richiesti = Number(a && a.required_technicians);
  if (!richiesti) return [];

  const inizio = [isoDay(a.start_date), isoDay(fromDate)].filter(Boolean).sort().pop();
  const fine = [isoDay(a.end_date), isoDay(toDate)].filter(Boolean).sort()[0];
  if (!inizio || !fine || inizio > fine) return [];

  const viste = assignmentsOf(a);
  const peso = dayPartOf(a) === 'FULL' ? 1 : 0.5;
  const tratti = [];
  let corrente = null;

  for (let g = inizio; g <= fine; g = giornoDopo(g)) {
    // Persone presenti quel giorno (un ciclo semplice: niente funzioni create
    // dentro il ciclo, che il controllo del build segnalerebbe)
    const persone = new Set();
    for (const v of viste) {
      if (v.start_date <= g && g <= v.end_date) persone.add(v.technician.id);
    }
    const presenti = persone.size;
    if (presenti < richiesti) {
      // I giorni sono consecutivi: un giorno coperto chiude il tratto
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
// La griglia delle presenze ragiona per giorni accesi; il server vuole
// periodi. Un periodo e' { start_date, end_date } con la stessa convenzione
// del server: una data vuota (null) vale "come l'attivita'", cosi' chi
// lavora fino all'ultimo giorno continua a farlo se l'attivita' si allunga.
// ---------------------------------------------------------------------------

// Tutti i giorni da un estremo all'altro, inclusi, in AAAA-MM-GG
export const dayList = (fromDate, toDate) => {
  const inizio = isoDay(fromDate);
  const fine = isoDay(toDate);
  const giorni = [];
  if (!inizio || !fine || inizio > fine) return giorni;
  for (let g = inizio; g <= fine; g = giornoDopo(g)) giorni.push(g);
  return giorni;
};

// Giorni coperti da un elenco di periodi, ristretti all'attivita'
export const periodsToDays = (periods, fromDate, toDate) => {
  const inizio = isoDay(fromDate);
  const fine = isoDay(toDate);
  const giorni = new Set();
  (periods || []).forEach(p => {
    const s = isoDay(p.start_date) || inizio;
    const e = isoDay(p.end_date) || fine;
    for (const g of dayList(s > inizio ? s : inizio, e < fine ? e : fine)) giorni.add(g);
  });
  return giorni;
};

// Periodi ricavati dai giorni accesi: un periodo per ogni tratto di giorni
// consecutivi. Un tratto che tocca il primo o l'ultimo giorno dell'attivita'
// lascia vuoto quell'estremo, come fa il server.
export const daysToPeriods = (daySet, fromDate, toDate) => {
  const giorni = dayList(fromDate, toDate);
  const periodi = [];
  let inizio = null;
  giorni.forEach((g, i) => {
    const acceso = daySet.has(g);
    if (acceso && inizio === null) inizio = i;
    const chiude = inizio !== null && (!acceso || i === giorni.length - 1);
    if (chiude) {
      const ultimo = acceso ? i : i - 1;
      periodi.push({
        start_date: inizio === 0 ? null : giorni[inizio],
        end_date: ultimo === giorni.length - 1 ? null : giorni[ultimo],
      });
      inizio = null;
    }
  });
  return periodi;
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
export const toAssignments = (technicianIds, periodsByTech, fromDate, toDate) => {
  const out = [];
  (technicianIds || []).forEach(id => {
    const periodi = (periodsByTech && periodsByTech[id]) || [{ start_date: null, end_date: null }];
    const giorni = periodsToDays(periodi, fromDate, toDate);
    daysToPeriods(giorni, fromDate, toDate).forEach(p => out.push({ technician_id: id, ...p }));
  });
  return out;
};
