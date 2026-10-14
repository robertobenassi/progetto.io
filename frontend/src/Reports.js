import React, { useState, useMemo, useRef } from 'react';
import {
  actDurationDays, daysInRange, overlapsRange, actStartUnit, actEndUnit, splitDays, halfUnit,
  formatActivityPeriod, fmtDays, countryFlag, toInputDate, dayPartOf,
} from './dateUtils';
// I report ragionano per periodo di assegnazione: un tecnico puo' lavorare
// solo su una parte di un'attivita', anche in piu' periodi separati
import { assignmentsOf, occupiedDays, coverageGaps } from './planning.js';

// Quali colonne sono numeriche, dedotto dai dati.
// La regola precedente ("le ultime due a destra") era arbitraria: in Giorni uomo
// le colonne di numeri sono tre, in Agenda una sola, e l'allineamento sballava.
const numericColumns = (rows) => {
  const set = new Set();
  if (!rows.length) return set;
  const n = rows[0].length;
  for (let j = 1; j < n; j++) {
    let seen = 0, numeric = 0;
    rows.forEach(r => {
      const v = String(r[j] ?? '').trim();
      if (!v || v === '—') return;
      seen++;
      if (/^-?[\d.,]+\s*%?$/.test(v)) numeric++;
    });
    if (seen > 0 && numeric === seen) set.add(j);
  }
  return set;
};

// Larghezze di colonna condivise fra i gruppi: le numeriche sono strette e
// fisse, le altre si dividono il resto in proporzione al testo che devono
// contenere. Prima la prima colonna prendeva un terzo dello spazio e le altre
// parti uguali: un periodo con la fascia ("22/02/2027 → 23/02/2027
// (Pomeriggio)") finiva troncato accanto a colonne quasi vuote.
// Si misurano tutte le righe di tutti i gruppi, cosi' le colonne restano
// allineate da un gruppo all'altro.
const columnWidths = (headers, num, rows = []) => {
  const numW = 11;                       // % per ogni colonna di numeri
  const rest = 100 - [...num].length * numW;
  const peso = headers.map((h, i) => {
    if (num.has(i)) return 0;
    let lung = String(h ?? '').length;
    rows.forEach(r => { lung = Math.max(lung, String(r[i] ?? '').length); });
    // Un tetto evita che una nota lunghissima schiacci tutte le altre colonne
    return Math.min(Math.max(lung, 6), 40);
  });
  const totale = peso.reduce((s, x) => s + x, 0) || 1;
  return headers.map((_, i) => num.has(i) ? `${numW}%` : `${(rest * peso[i]) / totale}%`);
};

// ---------------------------------------------------------------------------
// Export CSV
// Separatore ';' e BOM UTF-8: senza, Excel in Europa mette tutto in una colonna
// e storpia gli accenti.
// ---------------------------------------------------------------------------
const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Stampa / PDF
// Usa un iframe nascosto invece di window.open, che i browser bloccano spesso
// come popup. Dal dialogo di stampa si sceglie "Salva come PDF".
// ---------------------------------------------------------------------------
const printReport = (title, subtitle, headers, rows, groups) => {
  const style = `
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
           color: #111111; font-size: 10pt; margin: 0; }
    h1 { font-size: 15pt; margin: 0 0 2mm 0; }
    .sub { color: var(--muted); font-size: 9pt; margin-bottom: 5mm; }
    h2 { font-size: 11pt; margin: 5mm 0 2mm 0; padding-bottom: 1mm;
         border-bottom: 1px solid var(--border); page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; table-layout: fixed; }
    td { overflow: hidden; text-overflow: ellipsis; }
    th { background: var(--surface2); text-align: left; padding: 2mm; font-size: 9pt;
         border-bottom: 1.5px solid #9ca3af; }
    td { padding: 1.8mm 2mm; border-bottom: 1px solid var(--border); font-size: 9pt; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    .num { text-align: right; white-space: nowrap; }
    .foot { margin-top: 6mm; padding-top: 2mm; border-top: 1px solid var(--border);
            color: #9ca3af; font-size: 8pt; }
  `;

  const tutte = groups ? groups.flatMap(g => g.rows) : rows;
  const table = (hd, rw) => {
    const num = numericColumns(tutte);
    const widths = columnWidths(hd, num, tutte);
    return `
    <table>
      <colgroup>${widths.map(w => `<col style="width:${w}">`).join('')}</colgroup>
      <thead><tr>${hd.map((h, i) => `<th${num.has(i) ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
      <tbody>${rw.map(r => `<tr>${r.map((c, i) =>
        `<td${num.has(i) ? ' class="num"' : ''}>${String(c ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  };

  const body = groups
    ? groups.map(g => `<h2>${g.title}</h2>${table(g.headers, g.rows)}`).join('')
    : table(headers, rows);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>${style}</style></head><body>
    <h1>${title}</h1><div class="sub">${subtitle}</div>
    ${body}
    <div class="foot">progetto.io — ${new Date().toLocaleString()}</div>
    </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
};

// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  { id: 'today',      labelKey: 'repToday' },
  { id: 'available',  labelKey: 'repAvailable' },
  // Accanto a Disponibili: uno dice chi manca, l'altro chi e' libero
  { id: 'staffing',   labelKey: 'repStaffing' },
  { id: 'agenda',     labelKey: 'repAgenda' },
  { id: 'workload',   labelKey: 'repWorkload' },
  { id: 'mandays',    labelKey: 'repMandays' },
  { id: 'travel',     labelKey: 'repTravel' },
  { id: 'byCountry',  labelKey: 'repByCountry' },
  { id: 'overdue',    labelKey: 'repOverdue' },
  { id: 'absences',   labelKey: 'repAbsences' },
  // Esisteva gia' tutto il calcolo, ma la scheda non era mai stata aggiunta
  { id: 'soldvsdone', labelKey: 'repSoldVsDone' },
];

function Reports({ projects, activities, technicians, absences = [], t, locale, onActivityClick, canEdit, showArchived, onToggleArchived }) {
  const today = new Date();
  const [reportType, setReportType] = useState('agenda');
  const [from, setFrom] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [techFilter, setTechFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [expandedToday, setExpandedToday] = useState([]);
  const [skillFilter, setSkillFilter] = useState('');

  const projectsById = useMemo(() => {
    const m = new Map();
    projects.forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  const availableCountries = useMemo(
    () => [...new Set(projects.map(p => p.country).filter(Boolean))].sort(),
    [projects]
  );

  // Attivita' che ricadono nel periodo e superano il filtro nazione
  const scoped = useMemo(() => {
    return activities.filter(a => {
      if (!overlapsRange(a, from, to)) return false;
      if (projectFilter && String(a.project_id) !== String(projectFilter)) return false;
      if (countryFilter) {
        const p = projectsById.get(a.project_id);
        if (!p || p.country !== countryFilter) return false;
      }
      return true;
    });
  }, [activities, from, to, countryFilter, projectFilter, projectsById]);

  // Cambiando la data iniziale, la finale si sposta e conserva la lunghezza
  // del periodo: se era di mesi interi resta di mesi interi (da ottobre a
  // febbraio porta "al" a fine febbraio), altrimenti mantiene i giorni.
  // Prima "al" restava ferma e il periodo poteva rovesciarsi, con un report
  // di zeri senza spiegazione.
  // Il riferimento e' l'ultimo periodo valido: mentre si digita l'anno il
  // campo passa per date come 0002-02-01, che non devono spostare nulla.
  const ultimoValido = useRef({ from, to });
  const plausibile = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && Number(d.slice(0, 4)) >= 1900;
  if (plausibile(from) && plausibile(to) && from <= to) ultimoValido.current = { from, to };

  const cambiaInizio = (nuovo) => {
    setFrom(nuovo);
    if (!plausibile(nuovo)) return;
    const { from: da, to: a } = ultimoValido.current;
    const g = (x) => new Date(x + 'T00:00:00Z');
    const d0 = g(da), d1 = g(a), n = g(nuovo);
    const ultimoDelMese = (y, m) => new Date(Date.UTC(y, m + 1, 0));
    const mesiInteri = d0.getUTCDate() === 1
      && d1.getUTCDate() === ultimoDelMese(d1.getUTCFullYear(), d1.getUTCMonth()).getUTCDate();
    let fine;
    if (mesiInteri && n.getUTCDate() === 1) {
      const mesi = (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + d1.getUTCMonth() - d0.getUTCMonth();
      fine = ultimoDelMese(n.getUTCFullYear(), n.getUTCMonth() + mesi);
    } else {
      fine = new Date(n.getTime() + (d1 - d0));
    }
    setTo(fine.toISOString().slice(0, 10));
  };
  const periodoRovesciato = Boolean(from && to && to < from);

  const periodLabel = `${new Date(from).toLocaleDateString(locale)} → ${new Date(to).toLocaleDateString(locale)}`;
  const periodDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

  // -------------------------------------------------------------------------
  // Costruzione dei dati, uno per tipo di report
  // -------------------------------------------------------------------------
  const data = useMemo(() => {
    const P = (id) => projectsById.get(id);
    const techOf = (a) => a.technicians || [];
    // Periodi dei tecnici nelle attivita' indicate che toccano il periodo del
    // report. Ogni periodo ha le date del tecnico; .activity e' l'originale.
    const periodiIn = (acts) => acts.flatMap(assignmentsOf).filter(v => overlapsRange(v, from, to));
    const passaFiltri = (a) => {
      if (projectFilter && String(a.project_id) !== String(projectFilter)) return false;
      if (countryFilter) {
        const p = projectsById.get(a.project_id);
        if (!p || p.country !== countryFilter) return false;
      }
      return true;
    };
    // Mezze giornate di una data coperte da un impegno o da un'assenza:
    // l'unita' pari e' la mattina, la dispari il pomeriggio
    const metaCoperte = (x, u0, u1) => {
      const dp = dayPartOf(x);
      return [u0, u1].filter(u => actStartUnit(x) <= u && u <= actEndUnit(x)
        && (dp === 'FULL' || (dp === 'AM' && u % 2 === 0) || (dp === 'PM' && u % 2 === 1)));
    };

    // 0. SITUAZIONE A UNA DATA — chi e' dove, chi e' assente, chi e' libero.
    // Usa la data di inizio periodo come riferimento: cosi' si puo' guardare
    // anche in avanti, non solo oggi.
    if (reportType === 'today') {
      const ref = from;
      const u0 = halfUnit(ref, 'AM', false);
      const u1 = halfUnit(ref, 'PM', true);

      // Due forme dello stesso dato: a schermo una riga per tecnico (espandibile),
      // nell'export una riga per attivita'. Tenerle separate evita di piegare il
      // componente tabella generico, che serve agli altri report.
      const groups = [];
      const flat = [];
      const periodi = activities.filter(passaFiltri).flatMap(assignmentsOf);

      technicians
        .filter(tech => !techFilter || String(tech.id) === String(techFilter))
        .forEach(tech => {
          // Periodi del tecnico che toccano quella data (non l'attivita' intera)
          const impegni = periodi.filter(v => v.technician.id === tech.id
            && metaCoperte(v, u0, u1).length > 0);
          const abs = absences.filter(x =>
            x.technician_id === tech.id && metaCoperte(x, u0, u1).length > 0);

          const filtered = projectFilter || countryFilter;
          if (filtered && impegni.length === 0) return;

          const home = tech.home_country ? `${[countryFlag(tech.home_country), tech.home_country].filter(Boolean).join(' ')}` : '—';

          // Mezze giornate di lavoro non coperte da un'assenza: un permesso il
          // pomeriggio non cancella la mattina di lavoro. Prima bastava
          // un'assenza qualsiasi per mostrare il tecnico come assente tutto
          // il giorno.
          const metaAssente = new Set(abs.flatMap(x => metaCoperte(x, u0, u1)));
          const lavora = impegni.some(v => metaCoperte(v, u0, u1).some(u => !metaAssente.has(u)));
          const notaAssenza = abs.length
            ? `${t('abs_' + abs[0].type)}${metaAssente.size === 1
                ? ` (${metaAssente.has(u0) ? t('morning') : t('afternoon')})` : ''}`
            : '';

          if (lavora) {
            const items = impegni.map(v => {
              const p = projectsById.get(v.project_id);
              return {
                project: p ? `${p.code} - ${p.name}` : '—',
                code: p?.code || '—',
                color: p?.color,
                country: p?.country ? `${[countryFlag(p.country), p.country].filter(Boolean).join(' ')}` : '—',
                activity: v.name,
                act: v.activity,
              };
            });
            const label = notaAssenza ? `${t('atWork')} · ${notaAssenza}` : t('atWork');
            groups.push({ id: tech.id, order: 0, name: tech.name, color: tech.color, home,
              status: 'busy', label, note: notaAssenza, items });
            items.forEach(it => flat.push([tech.name, home, label, it.project, it.activity, it.country]));
          } else if (abs.length) {
            groups.push({ id: tech.id, order: 1, name: tech.name, color: tech.color, home,
              status: 'absent', label: notaAssenza, items: [] });
            flat.push([tech.name, home, notaAssenza, '—', '—', '—']);
          } else {
            groups.push({ id: tech.id, order: 2, name: tech.name, color: tech.color, home,
              status: 'free', label: t('free'), items: [] });
            flat.push([tech.name, home, t('free'), '—', '—', '—']);
          }
        });

      groups.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
      return {
        todayGroups: groups,
        headers: [t('technician'), t('baseCountry'), t('status'), t('project'), t('activity'), t('country')],
        rows: flat,
      };
    }

    // 0b. DISPONIBILI — chi si puo' chiamare per coprire un periodo.
    //
    // Risponde a una domanda diversa dagli altri report: non "com'e' messa
    // l'organizzazione" ma "chi mando lunedi a Milano". Per questo i liberi
    // stanno in cima e ognuno porta con se' le informazioni per decidere:
    // quanto e' carico, dov'e' di base, cosa sa fare, dove ha lavorato.
    if (reportType === 'available') {
      const tuttiIPeriodi = activities.flatMap(assignmentsOf);
      const u0 = halfUnit(from, 'AM', false);
      const u1 = halfUnit(to, 'PM', true);
      const q = skillFilter.trim().toLowerCase();

      const righe = technicians
        .filter(tech => !techFilter || String(tech.id) === String(techFilter))
        .filter(tech => !q || (tech.specialization || '').toLowerCase().includes(q)
                          || tech.name.toLowerCase().includes(q))
        .map(tech => {
          // Periodi del tecnico nel periodo richiesto, non attivita' intere
          const suoi = tuttiIPeriodi.filter(v => v.technician.id === tech.id);
          const impegni = suoi.filter(v => actStartUnit(v) <= u1 && actEndUnit(v) >= u0);
          const assenze = absences.filter(x =>
            x.technician_id === tech.id && actStartUnit(x) <= u1 && actEndUnit(x) >= u0
          );

          // Giorni gia' occupati nel periodo richiesto, contati una volta sola:
          // con due impegni nello stesso giorno, o un impegno durante
          // un'assenza, la somma superava i giorni del periodo.
          const occupati = occupiedDays([...impegni, ...assenze], from, to);
          const liberi = Math.max(0, periodDays - occupati);
          const nAttivita = new Set(impegni.map(v => v.activity.id)).size;

          // Nazioni dove ha lavorato negli ultimi mesi: chi conosce gia' il
          // posto e' il candidato migliore a parita' di disponibilita'.
          const recenti = [...new Set(suoi
            .map(v => projectsById.get(v.project_id)?.country)
            .filter(Boolean))];

          const stato = assenze.length ? 'absent' : impegni.length ? 'partial' : 'free';
          return { tech, stato, liberi, occupati, impegni, nAttivita, assenze, recenti };
        })
        // Prima chi e' del tutto libero, poi chi lo e' in parte, infine gli
        // assenti; a parita', chi ha piu' giorni disponibili.
        .sort((a, b) => {
          const ord = { free: 0, partial: 1, absent: 2 };
          return ord[a.stato] - ord[b.stato]
              || b.liberi - a.liberi
              || a.tech.name.localeCompare(b.tech.name);
        });

      const etichettaStato = (r) =>
        r.stato === 'free' ? `○ ${t('free')}`
        : r.stato === 'absent' ? `🏖 ${t('abs_' + (r.assenze[0]?.type || 'vacation'))}`
        : `● ${r.nAttivita} ${t(r.nAttivita === 1 ? 'activityCount1' : 'activityCount')}`;

      return {
        headers: [t('technician'), t('status'), t('specialization'), t('baseCountry'),
                  t('daysFree'), t('worksIn')],
        rows: righe.map(r => [
          r.tech.name,
          etichettaStato(r),
          r.tech.specialization || '—',
          r.tech.home_country ? `${[countryFlag(r.tech.home_country), r.tech.home_country].filter(Boolean).join(' ')}` : '—',
          fmtDays(r.liberi, locale),
          r.recenti.length
            ? r.recenti.map(cc => `${[countryFlag(cc), cc].filter(Boolean).join(' ')}`).join(' ')
            : '—',
        ]),
      };
    }

    // 0c. VENDUTO E SVOLTO — quanto e' stato venduto contro quanto e' stato
    // fatto davvero. Serve al venditore quando il lavoro eccede il contratto:
    // per chiedere un'integrazione bisogna poterla documentare, quindi non
    // basta il totale, servono le attivita' che lo compongono.
    if (reportType === 'soldvsdone') {
      // Giorni uomo pianificati di un'attivita': la durata di ogni periodo di
      // ogni tecnico. Senza tecnici conta come una persona, come nel report
      // Giorni uomo. Prima si usava la durata dell'attivita': cinque giorni
      // con due tecnici valevano 5 qui e 10 in Giorni uomo.
      const giorniUomo = (a) => {
        const periodi = assignmentsOf(a);
        return periodi.length
          ? periodi.reduce((s, v) => s + actDurationDays(v), 0)
          : actDurationDays(a);
      };
      const righe = projects
        .filter(p => !countryFilter || p.country === countryFilter)
        .filter(p => !projectFilter || String(p.id) === String(projectFilter))
        .map(p => {
          const acts = (activities || []).filter(a => a.project_id === p.id);

          // Si vende in due modi: a fasi, oppure un pacchetto unico. Se le
          // attivita' portano un valore, quella e' la ripartizione reale.
          const vendutoFasi = acts.reduce((s, a) => s + (Number(a.sold_days) || 0), 0);
          const vendutoProgetto = Number(p.sold_days) || 0;
          const venduto = vendutoFasi > 0 ? vendutoFasi : vendutoProgetto;
          if (!venduto) return null;          // senza un valore non c'e' confronto

          // Svolto: giorni uomo delle attivita' completate, mezze giornate
          // contate per meta'. Il parziale segue l'avanzamento dichiarato.
          const svolto = acts.reduce((s, a) =>
            s + giorniUomo(a) * ((Number(a.progress) || 0) / 100), 0);
          const previsto = acts.reduce((s, a) => s + giorniUomo(a), 0);

          const scarto = svolto - venduto;
          const avanzamento = previsto > 0 ? (svolto / previsto) * 100 : 0;

          // Quanto del venduto e' gia' stato consumato. Confrontato con
          // l'avanzamento dice se il progetto sta per sforare: al 40% di
          // lavoro fatto con il 70% dei giorni gia' spesi, il conto finale
          // non torna — ed e' un'informazione utile ora, non a consegna.
          const consumo = venduto > 0 ? (svolto / venduto) * 100 : 0;

          // Proiezione a finire: se il ritmo resta questo, quanto costera'
          // in tutto. Con il previsto gia' pianificato la stima e' migliore
          // di una semplice estrapolazione lineare.
          const proiezione = Math.max(previsto, svolto);
          const scartoFinale = proiezione - venduto;

          // Il segnale: consuma piu' in fretta di quanto avanza
          const inSofferenza = avanzamento > 0 && avanzamento < 95
                            && consumo > avanzamento + 10;

          return {
            p, acts, venduto, svolto, previsto, scarto, avanzamento,
            consumo, proiezione, scartoFinale, inSofferenza,
            discordanza: vendutoFasi > 0 && vendutoProgetto > 0
                      && Math.abs(vendutoFasi - vendutoProgetto) > 0.01,
            vendutoFasi, vendutoProgetto,
          };
        })
        .filter(Boolean)
        // Prima chi ha gia' sforato — li' si recuperano soldi — poi chi sta
        // per sforare, che e' ancora in tempo per essere corretto.
        .sort((a, b) => b.scartoFinale - a.scartoFinale || b.scarto - a.scarto);

      // Un gruppo per progetto: il totale in intestazione, il dettaglio delle
      // attivita' sotto. Cosi' la stampa e' gia' il documento da allegare a
      // una richiesta di integrazione.
      const groups = righe.map(r => ({
        title: `${[countryFlag(r.p.country), r.p.code].filter(Boolean).join(' ')} ${r.p.name}`
             + `  —  ${t('sold')} ${fmtDays(r.venduto, locale)}`
             + ` · ${t('done')} ${fmtDays(r.svolto, locale)}`
             // Residuo: positivo se restano giorni da fare, negativo se si e'
             // gia' sforato. Prima qui c'era lo scarto con il segno opposto
             // (svolto meno venduto): lo stesso dato compariva con due segni.
             + ` · ${t('remaining')} ${fmtDays(r.venduto - r.svolto, locale)}`
             + (r.scartoFinale > 0.01 && r.scarto <= 0.01
                 ? `  ⚡ ${t('willExceed')} ${fmtDays(r.scartoFinale, locale)}` : '')
             + (r.inSofferenza ? '  ⚠' : '')
             + (r.discordanza ? '  ⚠' : ''),
        headers: [t('activity'), t('sold'), t('planned'), t('done'), t('remaining'), t('progress'), t('period')],
        rows: r.acts.map(a => {
          const svoltoA = giorniUomo(a) * ((Number(a.progress) || 0) / 100);
          // Il residuo ha senso solo per le attivita' vendute a fasi: senza
          // un proprio venduto il riferimento e' il progetto, nel titolo
          const vendutoA = Number(a.sold_days) || 0;
          return [
            a.name,
            vendutoA ? fmtDays(vendutoA, locale) : '—',
            fmtDays(giorniUomo(a), locale),
            fmtDays(svoltoA, locale),
            vendutoA ? fmtDays(vendutoA - svoltoA, locale) : '—',
            (Number(a.progress) || 0) + '%',
            formatActivityPeriod(a, locale, t('morning'), t('afternoon')),
          ];
        }),
      }));

      return {
        groups,
        flatHeaders: [t('project'), t('sold'), t('done'), t('planned'),
                      t('remaining'), t('progress'), t('used'), t('atCompletion')],
        flatRows: righe.map(r => [
          `${r.p.code} - ${r.p.name}`,
          fmtDays(r.venduto, locale),
          fmtDays(r.svolto, locale),
          fmtDays(r.previsto, locale),
          fmtDays(r.venduto - r.svolto, locale),
          Math.round(r.avanzamento) + '%',
          Math.round(r.consumo) + '%' + (r.inSofferenza ? ' ⚠' : ''),
          // Stesso segno del residuo: negativo se a fine lavori si sforera'
          fmtDays(r.venduto - r.proiezione, locale),
        ]),
      };
    }

    // FABBISOGNO
    // Attivita' con meno tecnici presenti di quelli richiesti, giorno per
    // giorno: un'attivita' con Marco la prima settimana e Luca la seconda ha
    // due nomi, ma ogni giorno una persona sola. Un tratto per riga, in
    // ordine di data: le scoperture piu' vicine sono le prime da risolvere.
    // Contano i giorni di calendario, come nel resto dell'applicazione e
    // come nella griglia delle presenze: lo stesso giorno non deve risultare
    // scoperto in un punto e coperto in un altro.
    if (reportType === 'staffing') {
      const tratti = [];
      scoped.forEach(a => {
        coverageGaps(a, from, to).forEach(g => tratti.push({ g, a, p: P(a.project_id) }));
      });
      tratti.sort((x, y) => x.g.from.localeCompare(y.g.from)
        || (x.p?.code || '').localeCompare(y.p?.code || '')
        || x.a.name.localeCompare(y.a.name));
      return {
        headers: [t('period'), t('project'), t('activity'), t('presentCount'), t('requiredCount'),
                  t('daysCol'), t('missingManDays')],
        rows: tratti.map(({ g, a, p }) => [
          formatActivityPeriod({ start_date: g.from, end_date: g.to, day_part: dayPartOf(a) },
                               locale, t('morning'), t('afternoon')),
          p ? `${p.code} - ${p.name}` : '—',
          a.name,
          String(g.present),
          String(g.required),
          fmtDays(g.days, locale),
          fmtDays(g.missing, locale),
        ]),
      };
    }

    // 1. AGENDA TECNICO — dove va e quando
    if (reportType === 'agenda') {
      const groups = [];
      const list = techFilter
        ? technicians.filter(x => String(x.id) === String(techFilter))
        : technicians;

      // Una riga per periodo del tecnico: chi lavora su un'attivita' in due
      // momenti la vede due volte, ognuna con le sue date
      const periodi = periodiIn(scoped);
      list.forEach(tech => {
        const acts = periodi
          .filter(v => v.technician.id === tech.id)
          .sort((a, b) => actStartUnit(a) - actStartUnit(b));
        if (!acts.length) return;
        groups.push({
          title: `${tech.name}${tech.home_country ? ' — ' + countryFlag(tech.home_country) + ' ' + tech.home_country : ''}`,
          headers: [t('period'), t('project'), t('activity'), t('country'), t('daysCol')],
          rows: acts.map(a => {
            const p = P(a.project_id);
            return [
              formatActivityPeriod(a, locale, t('morning'), t('afternoon')),
              p ? `${p.code} - ${p.name}` : '—',
              a.name,
              p?.country ? `${[countryFlag(p.country), p.country].filter(Boolean).join(' ')}` : '—',
              fmtDays(daysInRange(a, from, to), locale),
            ];
          }),
        });
      });
      return { groups, flatHeaders: [t('technician'), t('period'), t('project'), t('activity'), t('country'), t('daysCol')],
        flatRows: groups.flatMap(g => g.rows.map(r => [g.title.split(' — ')[0], ...r])) };
    }

    // 2. CARICO PER TECNICO — saturazione sui giorni realmente disponibili
    if (reportType === 'workload') {
      const periodi = periodiIn(scoped);
      const rows = technicians.map(tech => {
        const suoi = periodi.filter(v => v.technician.id === tech.id);
        // Giorni occupati contati una volta sola: due impegni nello stesso
        // giorno sono un conflitto, non due giorni di lavoro. Prima si
        // sommavano, e il carico superava quello mostrato dal Gantt.
        const busy = occupiedDays(suoi, from, to);
        // Le assenze riducono i giorni disponibili: senza, chi e' in ferie
        // meta' mese risulterebbe scarico invece che assente.
        const off = occupiedDays(absences.filter(x => x.technician_id === tech.id), from, to);
        const avail = Math.max(0, periodDays - off);
        const pct = avail ? Math.round((busy / avail) * 100) : 0;
        return {
          name: tech.name,
          home: tech.home_country || '',
          nAct: new Set(suoi.map(v => v.activity.id)).size,
          busy, off, avail, pct,
          projects: new Set(suoi.map(v => v.project_id)).size,
        };
      })
      .filter(r => r.nAct > 0 || r.off > 0 || !techFilter)
      .sort((a, b) => b.busy - a.busy);

      return {
        headers: [t('technician'), t('baseCountry'), t('projectsCol'), t('activitiesCol'),
                  t('daysCol'), t('absences'), t('available'), t('saturation')],
        rows: rows.map(r => [
          r.name,
          r.home ? `${[countryFlag(r.home), r.home].filter(Boolean).join(' ')}` : '—',
          r.projects, r.nAct,
          fmtDays(r.busy, locale),
          fmtDays(r.off, locale),
          fmtDays(r.avail, locale),
          r.pct + '%',
        ]),
      };
    }

    // 7. ASSENZE
    if (reportType === 'absences') {
      const rows = absences
        .filter(x => overlapsRange(x, from, to))
        .filter(x => !techFilter || String(x.technician_id) === String(techFilter))
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
        .map(x => [
          x.technician_name,
          x.home_country ? `${[countryFlag(x.home_country), x.home_country].filter(Boolean).join(' ')}` : '—',
          t('abs_' + x.type),
          formatActivityPeriod(x, locale, t('morning'), t('afternoon')),
          x.note || '',
          fmtDays(daysInRange(x, from, to), locale),
        ]);
      return {
        headers: [t('technician'), t('baseCountry'), t('type'), t('period'), t('note'), t('daysCol')],
        rows,
      };
    }

    // 3. GIORNI UOMO PER PROGETTO — separati fra svolti e ancora da svolgere
    if (reportType === 'mandays') {
      const groups = [];
      const flat = [];
      const todayStr = toInputDate(new Date());

      projects
        .filter(p => !countryFilter || p.country === countryFilter)
        .filter(p => !projectFilter || String(p.id) === String(projectFilter))
        .forEach(p => {
          const acts = scoped.filter(a => a.project_id === p.id);
          if (!acts.length) return;

          const perTech = new Map();
          let tDone = 0, tPlanned = 0;

          // Ogni periodo di ogni tecnico conta per le sue date. Un'attivita'
          // senza tecnici conta come una persona, sotto la voce "—".
          acts.forEach(a => {
            const periodi = assignmentsOf(a);
            const voci = periodi.length
              ? periodi.map(v => [v.technician.name, v])
              : [['—', a]];
            voci.forEach(([n, x]) => {
              const s = splitDays(x, from, to, todayStr);
              const e = perTech.get(n) || { done: 0, planned: 0 };
              e.done += s.done;
              e.planned += s.planned;
              perTech.set(n, e);
              tDone += s.done;
              tPlanned += s.planned;
            });
          });

          const rows = [...perTech.entries()]
            .sort((a, b) => (b[1].done + b[1].planned) - (a[1].done + a[1].planned))
            .map(([n, e]) => [
              n,
              fmtDays(e.done, locale),
              fmtDays(e.planned, locale),
              fmtDays(e.done + e.planned, locale),
            ]);
          rows.push([
            t('total'),
            fmtDays(tDone, locale),
            fmtDays(tPlanned, locale),
            fmtDays(tDone + tPlanned, locale),
          ]);

          groups.push({
            title: `${[countryFlag(p.country), p.code].filter(Boolean).join(' ')} - ${p.name}`,
            headers: [t('technician'), t('daysDone'), t('daysPlanned'), t('manDays')],
            rows,
          });
          flat.push([
            p.code, p.name, p.country || '', acts.length,
            fmtDays(tDone, locale), fmtDays(tPlanned, locale), fmtDays(tDone + tPlanned, locale),
          ]);
        });

      return {
        groups,
        flatHeaders: [t('code'), t('project'), t('country'), t('activitiesCol'),
                      t('daysDone'), t('daysPlanned'), t('manDays')],
        flatRows: flat,
      };
    }

    // 4. TRASFERTE — chi lavora fuori dalla propria nazione
    if (reportType === 'travel') {
      // Una riga per periodo: la trasferta dura quanto il periodo del
      // tecnico, non quanto l'attivita'
      const rows = [];
      periodiIn(scoped).forEach(v => {
        const p = P(v.project_id);
        if (!p?.country) return;
        const full = technicians.find(y => y.id === v.technician.id);
        const home = full?.home_country;
        if (!home || home === p.country) return;
        rows.push([
          full.name,
          `${[countryFlag(home), home].filter(Boolean).join(' ')}`,
          `${[countryFlag(p.country), p.country].filter(Boolean).join(' ')}`,
          `${p.code} - ${p.name}`,
          v.name,
          formatActivityPeriod(v, locale, t('morning'), t('afternoon')),
          fmtDays(daysInRange(v, from, to), locale),
        ]);
      });
      rows.sort((a, b) => a[0].localeCompare(b[0]));
      return {
        headers: [t('technician'), t('baseCountry'), t('destination'), t('project'), t('activity'), t('period'), t('daysCol')],
        rows,
      };
    }

    // 5. RIEPILOGO PER NAZIONE
    if (reportType === 'byCountry') {
      const m = new Map();
      scoped.forEach(a => {
        const p = P(a.project_id);
        const cc = p?.country || '—';
        if (!m.has(cc)) m.set(cc, { projects: new Set(), acts: 0, days: 0, techs: new Set() });
        const e = m.get(cc);
        e.projects.add(a.project_id);
        e.acts += 1;
        // Giorni uomo: la parte di ogni periodo che cade nel report.
        // Un'attivita' senza tecnici conta come una persona.
        const periodi = assignmentsOf(a);
        if (periodi.length) {
          periodi.forEach(v => {
            const d = daysInRange(v, from, to);
            e.days += d;
            if (d > 0) e.techs.add(v.technician.id);
          });
        } else {
          e.days += daysInRange(a, from, to);
        }
      });
      const rows = [...m.entries()]
        .sort((a, b) => b[1].days - a[1].days)
        .map(([cc, e]) => [
          cc === '—' ? '—' : `${[countryFlag(cc), cc].filter(Boolean).join(' ')}`,
          e.projects.size, e.acts, e.techs.size, fmtDays(e.days, locale),
        ]);
      return {
        headers: [t('country'), t('projectsCol'), t('activitiesCol'), t('techniciansCol'), t('manDays')],
        rows,
      };
    }

    // 6. ATTIVITA' IN RITARDO — scadute e non completate
    if (reportType === 'overdue') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const rows = activities
        .filter(a => {
          if (countryFilter) {
            const p = P(a.project_id);
            if (!p || p.country !== countryFilter) return false;
          }
          const end = new Date(a.end_date);
          end.setHours(0, 0, 0, 0);
          return end < now && (a.progress ?? 0) < 100;
        })
        .sort((a, b) => new Date(a.end_date) - new Date(b.end_date))
        .map(a => {
          const p = P(a.project_id);
          const end = new Date(a.end_date);
          end.setHours(0, 0, 0, 0);
          const late = Math.round((now - end) / 86400000);
          return [
            p ? `${[countryFlag(p.country), p.code].filter(Boolean).join(' ')}` : '—',
            a.name,
            techOf(a).map(x => x.name).join(', ') || t('unassigned'),
            new Date(a.end_date).toLocaleDateString(locale),
            late,
            (a.progress ?? 0) + '%',
          ];
        });
      return {
        headers: [t('project'), t('activity'), t('technician'), t('endDate'), t('daysLate'), t('progress')],
        rows,
      };
    }

    return { headers: [], rows: [] };
  }, [reportType, scoped, technicians, projects, projectsById, from, to, techFilter,
      countryFilter, projectFilter, locale, t, periodDays, activities, absences, from, to, skillFilter, projects]);

  const currentLabel = t(REPORT_TYPES.find(r => r.id === reportType).labelKey);
  const subtitle = reportType === 'today'
    ? `${t('date')}: ${new Date(from).toLocaleDateString(locale)}${countryFilter ? ` — ${[countryFlag(countryFilter), countryFilter].filter(Boolean).join(' ')}` : ''}`
    : `${t('period')}: ${periodLabel}${countryFilter ? ` — ${[countryFlag(countryFilter), countryFilter].filter(Boolean).join(' ')}` : ''}`;

  const handlePrint = () => {
    if (data.groups) printReport(currentLabel, subtitle, null, null, data.groups);
    else printReport(currentLabel, subtitle, data.headers, data.rows);
  };

  const handleCSV = () => {
    const stamp = `${from}_${to}`;
    if (data.groups) downloadCSV(`${reportType}_${stamp}.csv`, data.flatHeaders, data.flatRows);
    else downloadCSV(`${reportType}_${stamp}.csv`, data.headers, data.rows);
  };

  const isEmpty = periodoRovesciato || (data.todayGroups ? data.todayGroups.length === 0
    : data.groups ? data.groups.length === 0 : data.rows.length === 0);

  const presets = useMemo(() => [
    { key: 'thisMonth', range: () => {
      const d = new Date();
      return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)];
    }},
    { key: 'thisQuarter', range: () => {
      const d = new Date(); const q = Math.floor(d.getMonth() / 3);
      return [new Date(d.getFullYear(), q * 3, 1), new Date(d.getFullYear(), q * 3 + 3, 0)];
    }},
    { key: 'thisYear', range: () => {
      const d = new Date();
      return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear(), 11, 31)];
    }},
    // "Tutto" si stringe su cio' che e' effettivamente filtrato: con un progetto
    // selezionato copre esattamente la sua prima e ultima attivita', senza vuoti.
    { key: 'allTime', range: () => {
      const pool = activities.filter(a => {
        if (projectFilter && String(a.project_id) !== String(projectFilter)) return false;
        if (countryFilter) {
          const p = projectsById.get(a.project_id);
          if (!p || p.country !== countryFilter) return false;
        }
        return true;
      });
      if (!pool.length) return [new Date(), new Date()];
      let s = new Date(pool[0].start_date), e = new Date(pool[0].end_date);
      pool.forEach(a => {
        const as = new Date(a.start_date), ae = new Date(a.end_date);
        if (as < s) s = as;
        if (ae > e) e = ae;
      });
      return [s, e];
    }},
  ], [activities, projectFilter, countryFilter, projectsById]);

  const inputStyle = {
    padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)',
    borderRadius: 5, backgroundColor: 'var(--surface)', color: 'var(--fg)',
  };
  const btnStyle = (primary) => ({
    padding: '7px 14px', fontSize: 13, cursor: isEmpty ? 'not-allowed' : 'pointer',
    borderRadius: 5, border: primary ? 'none' : '1px solid var(--border)',
    backgroundColor: isEmpty ? 'var(--border)' : (primary ? 'var(--accent)' : 'var(--surface)'),
    color: primary ? 'var(--accentFg)' : 'var(--fg)', whiteSpace: 'nowrap',
  });

  return (
    <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 8, border: '1px solid var(--border)' }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>📄 {t('reports')}</h2>

      {/* Tipo di report */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14,
        borderBottom: '1px solid var(--border)',
      }}>
        {REPORT_TYPES.map(r => {
          const active = reportType === r.id;
          return (
            <button key={r.id}
              onClick={() => {
                setReportType(r.id);
                // Questi due report guardano una giornata, non un intervallo:
                // arrivandoci da un periodo lungo si vedrebbero date che non
                // corrispondono alla domanda che si sta facendo.
                if (r.id === 'today' || r.id === 'available') {
                  const oggi = toInputDate(new Date());
                  setFrom(oggi);
                  setTo(oggi);
                }
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = active ? 1 : 0.65; }}
              style={{
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderBottom: `3px solid ${active ? 'var(--fg)' : 'transparent'}`,
                marginBottom: -1,
                color: 'var(--fg)',
                fontWeight: active ? 700 : 400,
                opacity: active ? 1 : 0.65,
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}>
              {t(r.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Periodi rapidi — l'evidenziazione deriva dalle date, non da uno stato
          separato: se le si modifica a mano, nessun preset resta acceso.
          Nascosti nel report "Oggi", che guarda una data singola: li' un
          pulsante "Anno" porterebbe a osservare il primo gennaio. */}
      <div style={{
        display: reportType === 'today' ? 'none' : 'flex',
        gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('quickPeriod')}:</span>
        {presets.map(({ key, range }) => {
          const [a, b] = range();
          const active = toInputDate(a) === from && toInputDate(b) === to;
          return (
            <button key={key}
              onClick={() => { setFrom(toInputDate(a)); setTo(toInputDate(b)); }}
              style={{
                padding: '3px 10px', fontSize: 12, cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--fg)' : 'transparent'}`,
                color: 'var(--fg)',
                fontWeight: active ? 700 : 400,
                opacity: active ? 1 : 0.65,
              }}>
              {t(key)}
            </button>
          );
        })}
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
          {periodLabel} — {periodDays} {t('daysCol').toLowerCase()}
        </span>
      </div>

      {/* Filtri */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        padding: '10px 12px', marginBottom: 16,
        backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8,
      }}>
        {/* Oggi e domani: chi chiama la sera per coprire il giorno dopo non
            deve passare dal calendario. */}
        {reportType === 'available' && [['today', 0], ['tomorrow', 1]].map(([chiave, scarto]) => {
          const d = new Date();
          d.setDate(d.getDate() + scarto);
          const g = toInputDate(d);
          const attivo = from === g && to === g;
          return (
            <button key={chiave}
              onClick={() => { setFrom(g); setTo(g); }}
              style={{
                padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 5,
                border: attivo ? '1px solid var(--accent)' : '1px solid var(--border)',
                backgroundColor: attivo ? 'var(--accent)' : 'transparent',
                color: attivo ? 'var(--accentFg)' : 'var(--fg)',
                fontWeight: attivo ? 600 : 400,
              }}>
              {t(chiave)}
            </button>
          );
        })}

        {reportType === 'today' ? (
          <>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>{t('date')}</label>
            <input type="date" value={from}
              onChange={e => { setFrom(e.target.value); setTo(e.target.value); }}
              style={inputStyle} />
            <button
              onClick={() => { const g = toInputDate(new Date()); setFrom(g); setTo(g); }}
              style={{
                padding: '4px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 5,
                border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)',
              }}>
              {t('today')}
            </button>
          </>
        ) : (
          <>
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>{t('from')}</label>
            <input type="date" value={from} onChange={e => cambiaInizio(e.target.value)} style={inputStyle} />
            <label style={{ fontSize: 13, color: 'var(--muted)' }}>{t('to')}</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />
          </>
        )}

        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} style={inputStyle}>
          <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allCountries')}</option>
          {availableCountries.map(cc => (
            <option key={cc} value={cc} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{countryFlag(cc)} {cc}</option>
          ))}
        </select>

        {/* Il progetto non entra nella domanda "chi e' libero": filtrare per
            progetto restringerebbe i tecnici a quelli che ci lavorano gia'. */}
        {reportType !== 'available' && (
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
            style={{ ...inputStyle, maxWidth: 240 }}>
            <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allProjects')}</option>
            {projects
              .filter(p => !countryFilter || p.country === countryFilter)
              .map(p => <option key={p.id} value={p.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{p.code} - {p.name}</option>)}
          </select>
        )}

        {reportType === 'available' && (
          <input
            type="text"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder={t('searchSkill')}
            style={{ ...inputStyle, minWidth: 180 }}
          />
        )}

        {(reportType === 'agenda' || reportType === 'today' || reportType === 'available') && (
          <select value={techFilter} onChange={e => setTechFilter(e.target.value)} style={inputStyle}>
            <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allTechnicians')}</option>
            {technicians.map(x => <option key={x.id} value={x.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{x.name}</option>)}
          </select>
        )}

        {/* Gli archiviati sono esclusi dal caricamento ordinario per alleggerire
            il diagramma: qui si richiedono al server quando serve lo storico. */}
        {onToggleArchived && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}
            title={t('includeArchivedHint')}>
            <input type="checkbox" checked={Boolean(showArchived)}
              onChange={(e) => onToggleArchived(e.target.checked)} />
            {t('includeArchived')}
          </label>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleCSV} disabled={isEmpty} style={btnStyle(false)}>⬇ CSV</button>
          <button onClick={handlePrint} disabled={isEmpty} style={btnStyle(true)}>🖨 PDF / {t('print')}</button>
        </div>
      </div>

      {/* Anteprima */}
      {periodoRovesciato ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
          ⚠ {t('invertedPeriod')}
        </div>
      ) : isEmpty ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          {reportType === 'staffing' ? t('staffingAllCovered') : t('noDataPeriod')}
        </div>
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 340px)', overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {data.todayGroups ? (
            <TodayList
              groups={data.todayGroups}
              expanded={expandedToday}
              onToggle={(id) => setExpandedToday(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onActivityClick={canEdit ? onActivityClick : null}
              t={t}
            />
          ) : data.groups ? (
            data.groups.map((g, i) => (
              <div key={i}>
                <div style={{
                  padding: '10px 14px', fontWeight: 700, fontSize: 13,
                  backgroundColor: 'var(--surface2)', borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  {g.title}
                </div>
                <Table headers={g.headers} rows={g.rows} allRows={data.groups.flatMap(x => x.rows)} />
              </div>
            ))
          ) : (
            <Table headers={data.headers} rows={data.rows} sticky />
          )}
        </div>
      )}
    </div>
  );
}

// Una riga per tecnico: chi ha piu' attivita' le mostra espandendo, cosi'
// l'elenco resta lungo quanto il numero di persone e non di assegnazioni.
const TodayList = ({ groups, expanded, onToggle, onActivityClick, t }) => {
  const dot = (status) => status === 'busy' ? '●' : status === 'absent' ? '🏖' : '○';
  const tone = (status) => status === 'busy' ? 'var(--fg)' : status === 'absent' ? '#f59e0b' : 'var(--muted)';

  return (
    <div>
      {groups.map(g => {
        const open = expanded.includes(g.id);
        const many = g.items.length > 1;
        return (
          <div key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              onClick={() => many && onToggle(g.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', fontSize: 13,
                cursor: many ? 'pointer' : 'default',
                opacity: g.status === 'free' ? 0.6 : 1,
              }}>
              <span style={{ width: 14, textAlign: 'center', color: tone(g.status) }}>
                {many ? (open ? '▾' : '▸') : dot(g.status)}
              </span>
              <span style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                backgroundColor: g.color || '#555555',
              }} />
              <strong style={{ minWidth: 150 }}>{g.name}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 12, minWidth: 50 }}>{g.home}</span>

              {g.items.length === 0 ? (
                <span style={{ color: tone(g.status), fontSize: 12 }}>{g.label}</span>
              ) : many ? (
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {/* Codici senza ripetizioni: due attivita' dello stesso
                      progetto davano "PROVA-01, PROVA-01" */}
                  {g.items.length} {t(g.items.length === 1 ? 'activityCount1' : 'activityCount')} —{' '}
                  {[...new Set(g.items.map(i => i.code))].join(', ')}
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    if (!onActivityClick) return;
                    e.stopPropagation();
                    onActivityClick(g.items[0].act);
                  }}
                  title={onActivityClick ? t('clickToEdit') : undefined}
                  style={{
                    fontSize: 12,
                    cursor: onActivityClick ? 'pointer' : 'default',
                    textDecoration: onActivityClick ? 'underline dotted' : 'none',
                    textUnderlineOffset: 3,
                  }}>
                  <span style={{ color: 'var(--muted)' }}>{g.items[0].country} {g.items[0].code}</span>
                  {' · '}{g.items[0].activity}
                </span>
              )}
              {/* Al lavoro per una parte della giornata, assente per l'altra */}
              {g.items.length > 0 && g.note && (
                <span style={{ color: '#f59e0b', fontSize: 12 }}>· 🏖 {g.note}</span>
              )}
            </div>

            {open && many && (
              <div style={{ padding: '0 12px 8px 46px' }}>
                {g.items.map((it, i) => (
                  <div key={i}
                    onClick={() => onActivityClick && onActivityClick(it.act)}
                    title={onActivityClick ? t('clickToEdit') : undefined}
                    onMouseEnter={(e) => { if (onActivityClick) e.currentTarget.style.backgroundColor = 'var(--surface2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center',
                      padding: '4px 6px', fontSize: 12, borderRadius: 4,
                      borderTop: i ? '1px solid var(--border)' : 'none',
                      cursor: onActivityClick ? 'pointer' : 'default',
                    }}>
                    <span style={{
                      padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      backgroundColor: it.color || '#555555', color: 'white', whiteSpace: 'nowrap',
                    }}>{it.country} {it.code}</span>
                    <span>{it.activity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// allRows: le righe di tutti i gruppi del report, per larghezze uguali in
// ogni gruppo. Senza, si usano quelle della tabella stessa.
const Table = ({ headers, rows, sticky, allRows }) => {
  const misura = allRows || rows;
  const num = numericColumns(misura);
  const widths = columnWidths(headers, num, misura);
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
      <colgroup>
        {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
      </colgroup>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              textAlign: num.has(i) ? 'right' : 'left',
              padding: '8px 12px', backgroundColor: 'var(--surface2)', color: 'var(--fg)', fontSize: 12,
              borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
              position: sticky ? 'sticky' : undefined, top: sticky ? 0 : undefined, zIndex: sticky ? 1 : undefined,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ backgroundColor: i % 2 ? 'var(--rowAlt)' : 'var(--surface)', color: 'var(--fg)' }}>
            {r.map((cell, j) => (
              <td key={j} style={{
                padding: '7px 12px', borderBottom: '1px solid var(--border)',
                textAlign: num.has(j) ? 'right' : 'left',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                fontVariantNumeric: num.has(j) ? 'tabular-nums' : undefined,
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default Reports;
