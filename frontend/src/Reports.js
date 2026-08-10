import React, { useState, useMemo } from 'react';
import {
  actDurationDays, daysInRange, overlapsRange, actStartUnit, actEndUnit, splitDays, halfUnit,
  formatActivityPeriod, fmtDays, countryFlag, toInputDate,
} from './dateUtils';

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
// fisse, la prima prende piu' spazio, le restanti si dividono il resto.
const columnWidths = (headers, num) => {
  const n = headers.length;
  const numCount = [...num].length;
  const numW = 11;                       // % per ogni colonna di numeri
  const rest = 100 - numCount * numW;
  const textCols = n - numCount;
  const firstW = textCols > 1 ? rest * 0.34 : rest;
  const otherW = textCols > 1 ? (rest - firstW) / (textCols - 1) : 0;
  return headers.map((_, i) => num.has(i) ? `${numW}%` : (i === 0 ? `${firstW}%` : `${otherW}%`));
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

  const table = (hd, rw) => {
    const num = numericColumns(rw);
    const widths = columnWidths(hd, num);
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
  { id: 'agenda',     labelKey: 'repAgenda' },
  { id: 'workload',   labelKey: 'repWorkload' },
  { id: 'mandays',    labelKey: 'repMandays' },
  { id: 'travel',     labelKey: 'repTravel' },
  { id: 'byCountry',  labelKey: 'repByCountry' },
  { id: 'overdue',    labelKey: 'repOverdue' },
  { id: 'absences',   labelKey: 'repAbsences' },
];

function Reports({ projects, activities, technicians, absences = [], t, locale, onActivityClick, canEdit }) {
  const today = new Date();
  const [reportType, setReportType] = useState('agenda');
  const [from, setFrom] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [techFilter, setTechFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [expandedToday, setExpandedToday] = useState([]);

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

  const periodLabel = `${new Date(from).toLocaleDateString(locale)} → ${new Date(to).toLocaleDateString(locale)}`;
  const periodDays = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

  // -------------------------------------------------------------------------
  // Costruzione dei dati, uno per tipo di report
  // -------------------------------------------------------------------------
  const data = useMemo(() => {
    const P = (id) => projectsById.get(id);
    const techOf = (a) => a.technicians || [];

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

      technicians
        .filter(tech => !techFilter || String(tech.id) === String(techFilter))
        .forEach(tech => {
          const acts = activities.filter(a =>
            (a.technicians || []).some(x => x.id === tech.id) &&
            actStartUnit(a) <= u1 && actEndUnit(a) >= u0
          ).filter(a => {
            if (projectFilter && String(a.project_id) !== String(projectFilter)) return false;
            if (countryFilter) {
              const p = projectsById.get(a.project_id);
              if (!p || p.country !== countryFilter) return false;
            }
            return true;
          });

          const abs = absences.filter(x =>
            x.technician_id === tech.id &&
            actStartUnit(x) <= u1 && actEndUnit(x) >= u0
          );

          const filtered = projectFilter || countryFilter;
          if (filtered && acts.length === 0) return;

          const home = tech.home_country ? `${countryFlag(tech.home_country)} ${tech.home_country}` : '—';

          if (abs.length) {
            groups.push({ id: tech.id, order: 1, name: tech.name, color: tech.color, home,
              status: 'absent', label: t('abs_' + abs[0].type), items: [] });
            flat.push([tech.name, home, t('abs_' + abs[0].type), '—', '—', '—']);
          } else if (acts.length) {
            const items = acts.map(a => {
              const p = projectsById.get(a.project_id);
              return {
                project: p ? `${p.code} - ${p.name}` : '—',
                code: p?.code || '—',
                color: p?.color,
                country: p?.country ? `${countryFlag(p.country)} ${p.country}` : '—',
                activity: a.name,
                act: a,
              };
            });
            groups.push({ id: tech.id, order: 0, name: tech.name, color: tech.color, home,
              status: 'busy', label: t('atWork'), items });
            items.forEach(it => flat.push([tech.name, home, t('atWork'), it.project, it.activity, it.country]));
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

    // 1. AGENDA TECNICO — dove va e quando
    if (reportType === 'agenda') {
      const groups = [];
      const list = techFilter
        ? technicians.filter(x => String(x.id) === String(techFilter))
        : technicians;

      list.forEach(tech => {
        const acts = scoped
          .filter(a => techOf(a).some(x => x.id === tech.id))
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
              p?.country ? `${countryFlag(p.country)} ${p.country}` : '—',
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
      const rows = technicians.map(tech => {
        const acts = scoped.filter(a => techOf(a).some(x => x.id === tech.id));
        const busy = acts.reduce((s, a) => s + daysInRange(a, from, to), 0);
        // Le assenze riducono i giorni disponibili: senza, chi e' in ferie
        // meta' mese risulterebbe scarico invece che assente.
        const off = absences
          .filter(x => x.technician_id === tech.id)
          .reduce((s, x) => s + daysInRange(x, from, to), 0);
        const avail = Math.max(0, periodDays - off);
        const pct = avail ? Math.round((busy / avail) * 100) : 0;
        return {
          name: tech.name,
          home: tech.home_country || '',
          nAct: acts.length,
          busy, off, avail, pct,
          projects: new Set(acts.map(a => a.project_id)).size,
        };
      })
      .filter(r => r.nAct > 0 || r.off > 0 || !techFilter)
      .sort((a, b) => b.busy - a.busy);

      return {
        headers: [t('technician'), t('baseCountry'), t('projectsCol'), t('activitiesCol'),
                  t('daysCol'), t('absences'), t('available'), t('saturation')],
        rows: rows.map(r => [
          r.name,
          r.home ? `${countryFlag(r.home)} ${r.home}` : '—',
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
          x.home_country ? `${countryFlag(x.home_country)} ${x.home_country}` : '—',
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

          acts.forEach(a => {
            const s = splitDays(a, from, to, todayStr);
            const list = techOf(a);
            const names = list.length ? list.map(x => x.name) : ['—'];
            names.forEach(n => {
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
            title: `${countryFlag(p.country)} ${p.code} - ${p.name}`,
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
      const rows = [];
      scoped.forEach(a => {
        const p = P(a.project_id);
        if (!p?.country) return;
        techOf(a).forEach(x => {
          const full = technicians.find(y => y.id === x.id);
          const home = full?.home_country;
          if (!home || home === p.country) return;
          rows.push([
            full.name,
            `${countryFlag(home)} ${home}`,
            `${countryFlag(p.country)} ${p.country}`,
            `${p.code} - ${p.name}`,
            a.name,
            formatActivityPeriod(a, locale, t('morning'), t('afternoon')),
            fmtDays(daysInRange(a, from, to), locale),
          ]);
        });
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
        const d = daysInRange(a, from, to);
        const list = techOf(a);
        e.days += d * (list.length || 1);
        list.forEach(x => e.techs.add(x.id));
      });
      const rows = [...m.entries()]
        .sort((a, b) => b[1].days - a[1].days)
        .map(([cc, e]) => [
          cc === '—' ? '—' : `${countryFlag(cc)} ${cc}`,
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
            p ? `${countryFlag(p.country)} ${p.code}` : '—',
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
      countryFilter, projectFilter, locale, t, periodDays, activities, absences, from]);

  const currentLabel = t(REPORT_TYPES.find(r => r.id === reportType).labelKey);
  const subtitle = reportType === 'today'
    ? `${t('date')}: ${new Date(from).toLocaleDateString(locale)}${countryFilter ? ` — ${countryFlag(countryFilter)} ${countryFilter}` : ''}`
    : `${t('period')}: ${periodLabel}${countryFilter ? ` — ${countryFlag(countryFilter)} ${countryFilter}` : ''}`;

  const handlePrint = () => {
    if (data.groups) printReport(currentLabel, subtitle, null, null, data.groups);
    else printReport(currentLabel, subtitle, data.headers, data.rows);
  };

  const handleCSV = () => {
    const stamp = `${from}_${to}`;
    if (data.groups) downloadCSV(`${reportType}_${stamp}.csv`, data.flatHeaders, data.flatRows);
    else downloadCSV(`${reportType}_${stamp}.csv`, data.headers, data.rows);
  };

  const isEmpty = data.todayGroups ? data.todayGroups.length === 0
    : data.groups ? data.groups.length === 0 : data.rows.length === 0;

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
            <button key={r.id} onClick={() => setReportType(r.id)}
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
          separato: se le si modifica a mano, nessun preset resta acceso. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
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
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>{t('from')}</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} />
        <label style={{ fontSize: 13, color: 'var(--muted)' }}>{t('to')}</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} />

        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} style={inputStyle}>
          <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allCountries')}</option>
          {availableCountries.map(cc => (
            <option key={cc} value={cc} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{countryFlag(cc)} {cc}</option>
          ))}
        </select>

        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          style={{ ...inputStyle, maxWidth: 240 }}>
          <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allProjects')}</option>
          {projects
            .filter(p => !countryFilter || p.country === countryFilter)
            .map(p => <option key={p.id} value={p.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{p.code} - {p.name}</option>)}
        </select>

        {(reportType === 'agenda' || reportType === 'today') && (
          <select value={techFilter} onChange={e => setTechFilter(e.target.value)} style={inputStyle}>
            <option value="" style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{t('allTechnicians')}</option>
            {technicians.map(x => <option key={x.id} value={x.id} style={{ color: 'var(--fg)', backgroundColor: 'var(--surface)' }}>{x.name}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={handleCSV} disabled={isEmpty} style={btnStyle(false)}>⬇ CSV</button>
          <button onClick={handlePrint} disabled={isEmpty} style={btnStyle(true)}>🖨 PDF / {t('print')}</button>
        </div>
      </div>

      {/* Anteprima */}
      {isEmpty ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
          {t('noDataPeriod')}
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
                <Table headers={g.headers} rows={g.rows} />
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
                  {g.items.length} {t('activitiesCol').toLowerCase()} —{' '}
                  {g.items.map(i => i.code).join(', ')}
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

const Table = ({ headers, rows, sticky }) => {
  const num = numericColumns(rows);
  const widths = columnWidths(headers, num);
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
