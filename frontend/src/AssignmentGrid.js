// ---------------------------------------------------------------------------
// Griglia delle presenze nella finestra dell'attivita'
//
// Una riga per tecnico selezionato, una colonna per giorno dell'attivita'.
// Un clic accende o spegne un giorno; trascinando si cambiano molti giorni
// insieme, con il mouse o con il dito. L'ultima riga confronta i presenti
// con i tecnici richiesti.
//
// Oltre ai giorni di lavoro mostra cio' che serve per decidere: le assenze
// del tecnico (tratteggiate, anche a mezza giornata) e i giorni in cui e'
// gia' impegnato su altre attivita' (punto rosso).
//
// Durante il trascinamento lo stato resta qui, in locale, e passa alla
// finestra solo quando si rilascia: aggiornare l'intera applicazione a ogni
// casella attraversata renderebbe il trascinamento lento con molti dati.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { halfUnit, actStartUnit, actEndUnit, dayPartOf, activitiesOverlap } from './dateUtils.js';
import { dayList, periodsToDays, daysToPeriods } from './planning.js';

const CELLA = 24;
const MAX_GIORNI = 370;
const TUTTA = [{ start_date: null, end_date: null }];

// Mezze giornate di un giorno coperte da un'assenza: 'AM', 'PM' o entrambe
const metaAssenti = (assenze, giorno) => {
  const u0 = halfUnit(giorno, 'AM', false);
  const u1 = halfUnit(giorno, 'PM', true);
  const mezze = new Set();
  assenze.forEach(x => {
    const dp = dayPartOf(x);
    [u0, u1].forEach(u => {
      if (actStartUnit(x) <= u && u <= actEndUnit(x)
          && (dp === 'FULL' || (dp === 'AM' && u % 2 === 0) || (dp === 'PM' && u % 2 === 1))) {
        mezze.add(u === u0 ? 'AM' : 'PM');
      }
    });
  });
  return mezze;
};

// Tratti consecutivi di un elenco ordinato di giorni, per i riepiloghi
const tratti = (giorni) => {
  const out = [];
  giorni.forEach(g => {
    const ultimo = out[out.length - 1];
    const prima = ultimo && new Date(ultimo.to + 'T00:00:00Z');
    if (prima) prima.setUTCDate(prima.getUTCDate() + 1);
    if (ultimo && prima.toISOString().slice(0, 10) === g) ultimo.to = g;
    else out.push({ from: g, to: g });
  });
  return out;
};

const AssignmentGrid = ({
  from, to, dayPart, technicians, periods, onChange,
  required, onRequiredChange, absences, otherViews, dayKind, locale, t,
}) => {
  const giorni = useMemo(() => dayList(from, to), [from, to]);
  const troppiGiorni = giorni.length > MAX_GIORNI;

  // Copia locale dei periodi, allineata a quelli della finestra
  const [bozza, setBozza] = useState(periods);
  useEffect(() => { setBozza(periods); }, [periods]);
  const pittura = useRef(null);
  const bozzaRef = useRef(bozza);
  bozzaRef.current = bozza;

  const giorniDi = (id, fonte = bozza) => periodsToDays(fonte[id] || TUTTA, from, to);

  const breve = (g) => new Date(g + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  const intervallo = (x) => (x.from === x.to ? breve(x.from) : `${breve(x.from)} → ${breve(x.to)}`);

  // Per ogni tecnico: assenze e impegni altrove, giorno per giorno
  const contesto = useMemo(() => {
    const m = new Map();
    if (troppiGiorni) return m;
    technicians.forEach(tc => {
      const sue = (absences || []).filter(x => x.technician_id === tc.id);
      const viste = (otherViews && otherViews.get(tc.id)) || [];
      const perGiorno = new Map();
      giorni.forEach(g => {
        const assente = sue.length ? metaAssenti(sue, g) : new Set();
        const qui = { start_date: g, end_date: g, day_part: dayPart };
        const altrove = viste.filter(v => activitiesOverlap(qui, v)).map(v => v.name);
        if (assente.size || altrove.length) perGiorno.set(g, { assente, altrove });
      });
      m.set(tc.id, perGiorno);
    });
    return m;
  }, [technicians, absences, otherViews, giorni, dayPart, troppiGiorni]);

  // Trascinamento: si dipinge sempre lo stato opposto a quello della prima
  // casella toccata, e solo sulla riga di partenza
  const applica = (id, giorno) => {
    const p = pittura.current;
    if (!p || p.id !== id) return;
    const correnti = giorniDi(id, bozzaRef.current);
    if (correnti.has(giorno) === p.accendi) return;
    if (p.accendi) correnti.add(giorno); else correnti.delete(giorno);
    setBozza(b => ({ ...b, [id]: daysToPeriods(correnti, from, to) }));
  };
  const cellaSotto = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const c = el && el.closest('[data-cella]');
    return c ? { id: Number(c.dataset.tech), giorno: c.dataset.day } : null;
  };
  const inizio = (e) => {
    const c = cellaSotto(e);
    if (!c) return;
    e.preventDefault();
    pittura.current = { id: c.id, accendi: !giorniDi(c.id).has(c.giorno) };
    applica(c.id, c.giorno);
  };
  const muovi = (e) => {
    if (!pittura.current) return;
    const c = cellaSotto(e);
    if (c) applica(c.id, c.giorno);
  };
  useEffect(() => {
    const fine = () => {
      const p = pittura.current;
      if (!p) return;
      pittura.current = null;
      onChange(p.id, bozzaRef.current[p.id] || TUTTA);
    };
    window.addEventListener('pointerup', fine);
    window.addEventListener('pointercancel', fine);
    return () => {
      window.removeEventListener('pointerup', fine);
      window.removeEventListener('pointercancel', fine);
    };
  }, [onChange]);

  const richiesti = Number(required) || 0;
  const presenzePerTecnico = troppiGiorni ? new Map()
    : new Map(technicians.map(tc => [tc.id, giorniDi(tc.id)]));
  const copertura = giorni.map(g =>
    technicians.filter(tc => presenzePerTecnico.get(tc.id)?.has(g)).length);
  const scoperti = richiesti ? giorni.filter((g, i) => copertura[i] < richiesti) : [];

  const etichetta = { display: 'block', marginBottom: '0.5rem', fontWeight: '600' };
  const nota = { color: 'var(--muted)', fontSize: 13, margin: '0.25rem 0 0' };

  return (
    <div style={{ marginBottom: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ ...etichetta, marginBottom: 0 }}>{t('presenceTitle')}</span>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 13, color: 'var(--muted)' }} htmlFor="required_technicians">
          {t('requiredTechs')} <span style={{ fontSize: 12 }}>({t('optional')})</span>
        </label>
        <input
          id="required_technicians"
          type="number" min="1" max="999" step="1"
          value={required}
          onChange={e => onRequiredChange(e.target.value)}
          style={{
            width: 70, padding: '0.35rem 0.5rem', borderRadius: 5, border: '1px solid var(--border)',
            backgroundColor: 'var(--surface)', color: 'var(--fg)', boxSizing: 'border-box',
          }}
        />
      </div>

      {!giorni.length ? (
        <p style={nota}>{t('setDatesFirst')}</p>
      ) : troppiGiorni ? (
        <p style={nota}>{t('gridTooLong')}</p>
      ) : !technicians.length ? (
        <p style={nota}>{t('selectTechsFirst')}</p>
      ) : (
        <>
          <div
            onPointerDown={inizio}
            onPointerMove={muovi}
            style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 0' }}
          >
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2 }} />
                  {giorni.map((g, i) => {
                    const d = new Date(g + 'T00:00:00');
                    const tipo = dayKind(g);
                    return (
                      <th key={g} title={d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                        style={{
                          minWidth: CELLA, fontWeight: 400, lineHeight: 1.2,
                          color: tipo === 'holiday' ? '#ef4444' : 'var(--muted)',
                        }}>
                        {(i === 0 || d.getDate() === 1) && (
                          <div style={{ fontSize: 10, textTransform: 'lowercase' }}>
                            {d.toLocaleDateString(locale, { month: 'short' })}
                          </div>
                        )}
                        <div style={{ color: tipo ? undefined : 'var(--fg)' }}>{d.getDate()}</div>
                        <div style={{ fontSize: 10 }}>{d.toLocaleDateString(locale, { weekday: 'narrow' })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {technicians.map(tc => {
                  const presenti = presenzePerTecnico.get(tc.id);
                  const info = contesto.get(tc.id) || new Map();
                  return (
                    <tr key={tc.id}>
                      <td style={{
                        position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1,
                        padding: '0 8px 0 4px', whiteSpace: 'nowrap', fontSize: 13,
                      }}>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                          background: tc.color || 'var(--accent)', marginRight: 6,
                        }} />
                        {tc.name}
                      </td>
                      {giorni.map(g => {
                        const acceso = presenti.has(g);
                        const tipo = dayKind(g);
                        const x = info.get(g);
                        const assente = x ? x.assente : null;
                        const altrove = x ? x.altrove : [];
                        const sfondo = acceso ? (tc.color || 'var(--accent)')
                          : tipo === 'holiday' ? 'rgba(239,68,68,0.10)'
                          : tipo === 'rest' ? 'rgba(128,128,128,0.12)' : 'var(--surface2)';
                        const descrizione = [
                          `${tc.name} — ${new Date(g + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}`,
                          acceso ? t('presentLegend') : t('notPresent'),
                          assente && assente.size ? `${t('absentLegend')}${assente.size === 1 ? ` (${assente.has('AM') ? t('morning') : t('afternoon')})` : ''}` : null,
                          altrove.length ? `${t('busyElsewhere')}: ${altrove.join(', ')}` : null,
                        ].filter(Boolean).join(' · ');
                        return (
                          <td key={g}>
                            <div
                              data-cella="1" data-tech={tc.id} data-day={g}
                              title={descrizione}
                              style={{
                                width: CELLA, height: 22, borderRadius: 4, position: 'relative',
                                background: sfondo, opacity: acceso && tipo ? 0.75 : 1,
                                border: '1px solid var(--border)', boxSizing: 'border-box',
                                cursor: 'pointer', userSelect: 'none', touchAction: 'none',
                              }}
                            >
                              {assente && assente.size > 0 && (
                                <span style={{
                                  position: 'absolute', top: 0, bottom: 0, borderRadius: 3, pointerEvents: 'none',
                                  left: assente.size === 1 && assente.has('PM') ? '50%' : 0,
                                  right: assente.size === 1 && assente.has('AM') ? '50%' : 0,
                                  background: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.7) 0 2px, transparent 2px 5px)',
                                }} />
                              )}
                              {altrove.length > 0 && (
                                <span style={{
                                  position: 'absolute', top: 2, right: 2, width: 6, height: 6,
                                  borderRadius: '50%', background: '#ef4444', pointerEvents: 'none',
                                }} />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr>
                  <td style={{
                    position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1,
                    padding: '0 8px 0 4px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap',
                  }}>{t('coverage')}</td>
                  {copertura.map((n, i) => {
                    const manca = richiesti && n < richiesti;
                    return (
                      <td key={giorni[i]}>
                        <div style={{
                          width: CELLA, height: 18, lineHeight: '18px', borderRadius: 4, textAlign: 'center',
                          background: manca ? 'rgba(239,68,68,0.15)' : 'rgba(22,163,74,0.12)',
                          color: manca ? '#ef4444' : '#16a34a', fontSize: 11,
                        }}>{richiesti ? `${n}` : n}</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            <span>{t('gridHint')}</span>
            <span>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, verticalAlign: -1,
                background: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.8) 0 2px, transparent 2px 4px)' }} />
              {' '}{t('absentLegend')}
            </span>
            <span>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
              {' '}{t('busyElsewhere')}
            </span>
          </div>

          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
            {technicians.map(tc => {
              const presenti = presenzePerTecnico.get(tc.id);
              const lista = giorni.filter(g => presenti.has(g));
              const testo = !lista.length ? t('noDaysRemoved')
                : lista.length === giorni.length ? t('wholeDuration')
                : tratti(lista).map(intervallo).join(', ');
              return (
                <div key={tc.id}>
                  <strong>{tc.name}</strong>
                  <span style={{ color: lista.length ? 'var(--muted)' : '#ef4444' }}> — {testo}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 4, color: richiesti ? (scoperti.length ? '#ef4444' : '#16a34a') : 'var(--muted)' }}>
              {!richiesti ? t('noRequirement')
                : scoperti.length ? `${t('uncoveredDays')}: ${tratti(scoperti).map(intervallo).join(', ')}`
                : t('coverageComplete')}
            </div>
            {(() => {
              const conflitti = technicians.map(tc => {
                const presenti = presenzePerTecnico.get(tc.id);
                const info = contesto.get(tc.id) || new Map();
                const giorniConflitto = giorni.filter(g => presenti.has(g) && (info.get(g)?.altrove.length));
                return giorniConflitto.length ? `${tc.name} ${tratti(giorniConflitto).map(intervallo).join(', ')}` : null;
              }).filter(Boolean);
              return conflitti.length ? (
                <div style={{ color: '#ef4444' }}>⚠ {t('conflictWithOthers')}: {conflitti.join('; ')}</div>
              ) : null;
            })()}
          </div>
        </>
      )}
    </div>
  );
};

export default AssignmentGrid;
