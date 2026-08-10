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

export const actStartUnit = (a) =>
  halfUnit(a.start_date, a.start_half === 'PM' ? 'PM' : 'AM', false);

export const actEndUnit = (a) =>
  halfUnit(a.end_date, a.end_half === 'AM' ? 'AM' : 'PM', true);

// Durata in giorni, con mezze giornate: 3 unita' = 1,5 giorni
export const actDurationDays = (a) => (actEndUnit(a) - actStartUnit(a) + 1) / 2;

// Unita' di mezza giornata effettivamente comprese in un periodo.
// Serve per i report: un'attivita' lunga tre mesi conta solo i giorni
// che ricadono nell'intervallo richiesto.
export const unitsInRange = (a, fromDate, toDate) => {
  const from = halfUnit(fromDate, 'AM', false);
  const to = halfUnit(toDate, 'PM', true);
  const s = Math.max(actStartUnit(a), from);
  const e = Math.min(actEndUnit(a), to);
  return e >= s ? e - s + 1 : 0;
};

export const daysInRange = (a, fromDate, toDate) => unitsInRange(a, fromDate, toDate) / 2;

export const overlapsRange = (a, fromDate, toDate) => unitsInRange(a, fromDate, toDate) > 0;

// Etichetta leggibile del periodo di un'attivita', con mattina/pomeriggio
// indicati solo quando non e' una giornata intera.
export const formatActivityPeriod = (a, locale, tMorning, tAfternoon) => {
  const s = new Date(a.start_date).toLocaleDateString(locale);
  const e = new Date(a.end_date).toLocaleDateString(locale);
  const sh = a.start_half === 'PM' ? ` (${tAfternoon})` : '';
  const eh = a.end_half === 'AM' ? ` (${tMorning})` : '';
  if (a.start_date === a.end_date) {
    if (a.start_half === 'PM') return `${s} (${tAfternoon})`;
    if (a.end_half === 'AM') return `${s} (${tMorning})`;
    return s;
  }
  return `${s}${sh} → ${e}${eh}`;
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
