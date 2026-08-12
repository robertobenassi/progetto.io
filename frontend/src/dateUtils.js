// Utility temporali condivise fra App.js e Reports.js.
// Vivono in un file solo perche' la logica delle mezze giornate e' delicata:
// duplicarla porterebbe le due copie a divergere alla prima modifica.

// Tutti i calcoli usano unita' di MEZZA GIORNATA (1 giorno = 2 unita').
// Cosi' un intervento che finisce martedi' mattina e uno che inizia martedi'
// pomeriggio non risultano sovrapposti.
export const halfUnit = (dateStr, half, isEnd) => {
  const days = Math.floor(new Date(dateStr).getTime() / 86400000);
  if (isEnd) return days * 2 + (half === 'AM' ? 0 : 1);
  return days * 2 + (half === 'PM' ? 1 : 0);
};

// day_part vale per TUTTA l'attivita': 'AM' significa tutte le mattine del
// periodo, non solo la prima. I campi start_half/end_half restano letti per
// compatibilita' con i dati creati prima di questo modello.
export const dayPartOf = (a) => {
  if (a.day_part && ['AM', 'PM', 'FULL'].includes(a.day_part)) return a.day_part;
  if (a.start_date === a.end_date) {
    if (a.start_half === 'PM' && a.end_half === 'PM') return 'PM';
    if (a.start_half === 'AM' && a.end_half === 'AM') return 'AM';
  }
  return 'FULL';
};

export const actStartUnit = (a) =>
  halfUnit(a.start_date, dayPartOf(a) === 'PM' ? 'PM' : 'AM', false);

export const actEndUnit = (a) =>
  halfUnit(a.end_date, dayPartOf(a) === 'AM' ? 'AM' : 'PM', true);

// Giorni di calendario coperti, estremi inclusi
export const calendarDays = (a) =>
  Math.round((new Date(a.end_date) - new Date(a.start_date)) / 86400000) + 1;

// Durata effettiva: con mezza giornata ogni giorno vale 0,5
export const actDurationDays = (a) =>
  calendarDays(a) * (dayPartOf(a) === 'FULL' ? 1 : 0.5);

// Unita' di mezza giornata effettivamente comprese in un periodo.
// Serve per i report: un'attivita' lunga tre mesi conta solo i giorni
// che ricadono nell'intervallo richiesto.
// Giorni dell'attivita' che ricadono nel periodo richiesto. Con mezza
// giornata ogni giorno conta 0,5: tre mattine fanno 1,5 giorni, non 3.
export const daysInRange = (a, fromDate, toDate) => {
  const s = new Date(Math.max(new Date(a.start_date), new Date(fromDate)));
  const e = new Date(Math.min(new Date(a.end_date), new Date(toDate)));
  const giorni = Math.round((e - s) / 86400000) + 1;
  if (giorni <= 0) return 0;
  return giorni * (dayPartOf(a) === 'FULL' ? 1 : 0.5);
};

export const unitsInRange = (a, fromDate, toDate) => daysInRange(a, fromDate, toDate) * 2;

export const overlapsRange = (a, fromDate, toDate) => unitsInRange(a, fromDate, toDate) > 0;

// Etichetta leggibile del periodo di un'attivita', con mattina/pomeriggio
// indicati solo quando non e' una giornata intera.
export const formatActivityPeriod = (a, locale, tMorning, tAfternoon) => {
  const s = new Date(a.start_date).toLocaleDateString(locale);
  const e = new Date(a.end_date).toLocaleDateString(locale);
  const dp = dayPartOf(a);
  const fascia = dp === 'AM' ? ` (${tMorning})` : dp === 'PM' ? ` (${tAfternoon})` : '';
  if (a.start_date === a.end_date) return `${s}${fascia}`;
  return `${s} → ${e}${fascia}`;
};

// ---------------------------------------------------------------------------
// Giorni lavorativi
// I festivi e i giorni di riposo non impediscono di pianificare: servono a
// calcolare la data di fine partendo da una durata. Nel lavoro su impianti
// si interviene proprio nei giorni di fermo, quindi nessuna data e' vietata.
// ---------------------------------------------------------------------------

// Giorni di riposo per nazione; se non nota, sabato e domenica.
export const weekendDays = (country, weekendMap) =>
  (weekendMap && weekendMap[country]) || [0, 6];

export const isNonWorking = (date, country, holidays, weekendMap) => {
  const d = new Date(date);
  if (weekendDays(country, weekendMap).includes(d.getDay())) return true;
  const iso = toInputDate(d);
  return Boolean(holidays && holidays.some(h => h.country === country && toInputDate(h.date) === iso));
};

// Data di fine partendo dall'inizio e da una durata in giorni lavorativi.
// Il primo giorno conta come uno: durata 1 significa "solo quel giorno".
export const addWorkingDays = (startDate, workDays, country, holidays, weekendMap) => {
  const n = Math.max(1, Math.round(Number(workDays) || 1));
  let d = new Date(startDate);
  let contati = 0;
  let guardia = 0;
  while (guardia++ < 3650) {
    if (!isNonWorking(d, country, holidays, weekendMap)) {
      contati++;
      if (contati >= n) break;
    }
    d.setDate(d.getDate() + 1);
  }
  return toInputDate(d);
};

// Giorni lavorativi compresi fra due date, estremi inclusi
export const countWorkingDays = (startDate, endDate, country, holidays, weekendMap) => {
  let d = new Date(startDate);
  const fine = new Date(endDate);
  let n = 0;
  let guardia = 0;
  while (d <= fine && guardia++ < 3650) {
    if (!isNonWorking(d, country, holidays, weekendMap)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
};

// Numero con la virgola decimale solo quando serve: 3 resta 3, 3.5 diventa "3,5"
export const fmtDays = (n, locale) =>
  Number(n).toLocaleString(locale || 'it-IT', { maximumFractionDigits: 1 });

export const countryFlag = (cc) => {
  if (!cc || cc.length !== 2) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 127397 + ch.charCodeAt(0)));
};

export const toInputDate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// Split consuntivo / previsto rispetto a una data di riferimento (di norma oggi).
// Il giorno corrente e' conteggiato come "da svolgere": l'attivita' non e'
// ancora conclusa mentre la si guarda.
export const splitDays = (a, fromDate, toDate, refDate) => {
  const ref = new Date(refDate);
  ref.setHours(0, 0, 0, 0);
  const prevDay = new Date(ref.getTime() - 86400000);

  const from = new Date(fromDate);
  const to = new Date(toDate);

  let done = 0;
  if (prevDay >= from) {
    const end = prevDay < to ? prevDay : to;
    done = daysInRange(a, toInputDate(from), toInputDate(end));
  }

  let planned = 0;
  if (ref <= to) {
    const start = ref > from ? ref : from;
    planned = daysInRange(a, toInputDate(start), toInputDate(to));
  }

  return { done, planned, total: done + planned };
};
