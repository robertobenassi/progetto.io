// ---------------------------------------------------------------------------
// Griglia delle presenze nella finestra dell'attivita'
//
// Una riga per tecnico selezionato, una colonna per giorno dell'attivita'.
// Un clic accende o spegne un giorno; trascinando si cambiano molti giorni
// insieme, con il mouse o con il dito. L'ultima riga confronta i presenti
// con i tecnici richiesti.
//
// Dalla 1.2.0 i giorni di riposo dell'attivita' (fine settimana, festivi,
// giorni fuori dalla sua settimana lavorativa) restano spenti anche dentro
// un periodo: si accendono uno per uno quando si lavora davvero. Un
// trascinamento cominciato su un giorno lavorativo cambia solo i giorni
// lavorativi, cosi' attraversando un fine settimana non lo si accende per
// sbaglio; cominciato su un giorno di riposo cambia solo i giorni di riposo.
//
// Oltre ai giorni di lavoro mostra cio' che serve per decidere: le assenze
// del tecnico (tratteggiate, anche a mezza giornata), che tolgono quei
// giorni dal conto, e i giorni in cui e' gia' impegnato su altre attivita'
// (punto rosso).
//
// Durante il trascinamento lo stato resta qui, in locale, e passa alla
// finestra solo quando si rilascia: aggiornare l'intera applicazione a ogni
// casella attraversata renderebbe il trascinamento lento con molti dati.
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dayPartOf, isoDay } from './dateUtils.js';
import {
  dayList, periodsToDays, daysToPeriods, workedDayList, workedRuns, morningUnit, NO_CALENDAR,
} from './planning.js';

const CELLA = 24;
const MAX_GIORNI = 370;
const TUTTA = [{ start_date: null, end_date: null }];

// Mezze giornate di una fascia: 0 la mattina, 1 il pomeriggio
const mezzeDi = (dp) => (dp === 'AM' ? [0] : dp === 'PM' ? [1] : [0, 1]);

// Mezze giornate di un giorno coperte da un'assenza: 'AM', 'PM' o entrambe
const metaAssenti = (assenze, giorno) => {
  const mezze = new Set();
  assenze.forEach(x => {
    const da = isoDay(x.start_date);
    const a = isoDay(x.end_date);
    if (giorno < da || giorno > a) return;
    const dp = dayPartOf(x);
    if (dp !== 'PM') mezze.add('AM');
    if (dp !== 'AM') mezze.add('PM');
  });
  return mezze;
};

const AssignmentGrid = ({
  from, to, dayPart, technicians, periods, onChange,
  required, onRequiredChange, absences, otherViews, dayKind, isRest, calendar, locale, t,
}) => {
  const giorni = useMemo(() => dayList(from, to), [from, to]);
  const troppiGiorni = giorni.length > MAX_GIORNI;
  const riposo = isRest || null;
  const cal = calendar || NO_CALENDAR;
  const mezze = mezzeDi(dayPart);

  // Copia locale dei periodi, allineata a quelli della finestra
  const [bozza, setBozza] = useState(periods);
  useEffect(() => { setBozza(periods); }, [periods]);
  const pittura = useRef(null);
  const bozzaRef = useRef(bozza);
  bozzaRef.current = bozza;

  const giorniDi = (id, fonte = bozza) => periodsToDays(fonte[id] || TUTTA, from, to, riposo);

  // Giorni lavorati dell'attivita' (la stessa regola dei periodi): sono
  // quelli in cui si controlla la copertura
  const giorniAttivita = useMemo(
    () => new Set(troppiGiorni ? [] : workedDayList(from, to, riposo)),
    [from, to, riposo, troppiGiorni]);
  // Insieme di "tutta la durata", per il riepilogo
  const tutti = giorniAttivita;

  const breve = (g) => new Date(g + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  const intervallo = (x) => (x.from === x.to ? breve(x.from) : `${breve(x.from)} → ${breve(x.to)}`);
  const tratti = (lista) => workedRuns(lista, riposo).map(intervallo).join(', ');

  // Per ogni tecnico: assenze e impegni altrove, giorno per giorno.
  // Gli impegni altrove contano solo nei giorni in cui quell'altra attivita'
  // si lavora davvero: un fine settimana di riposo non e' "impegnato".
  const contesto = useMemo(() => {
    const m = new Map();
    if (troppiGiorni) return m;
    technicians.forEach(tc => {
      const sue = (absences || []).filter(x => x.technician_id === tc.id);
      const viste = ((otherViews && otherViews.get(tc.id)) || []).map(v => ({ v, u: cal.viewUnits(v) }));
      const perGiorno = new Map();
      giorni.forEach(g => {
        const assente = sue.length ? metaAssenti(sue, g) : new Set();
        const u = morningUnit(g);
        const altrove = viste.filter(x => mezze.some(h => x.u.has(u + h))).map(x => x.v.name);
        if (assente.size || altrove.length) perGiorno.set(g, { assente, altrove });
      });
      m.set(tc.id, perGiorno);
    });
    return m;
  // mezze dipende solo da dayPart, gia' fra le dipendenze
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [technicians, absences, otherViews, giorni, dayPart, troppiGiorni, cal]);

  // Trascinamento: si dipinge sempre lo stato opposto a quello della prima
  // casella toccata, solo sulla riga di partenza e solo sui giorni dello
  // stesso tipo (lavorativi o di riposo) della prima casella
  const diRiposo = (g) => Boolean(riposo && riposo(g));
  const applica = (id, giorno) => {
    const p = pittura.current;
    if (!p || p.id !== id || diRiposo(giorno) !== p.riposo) return;
    const correnti = giorniDi(id, bozzaRef.current);
    if (correnti.has(giorno) === p.accendi) return;
    if (p.accendi) correnti.add(giorno); else correnti.delete(giorno);
    setBozza(b => ({ ...b, [id]: daysToPeriods(correnti, from, to, riposo) }));
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
    pittura.current = { id: c.id, accendi: !giorniDi(c.id).has(c.giorno), riposo: diRiposo(c.giorno) };
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

  // Presenza di un tecnico in un giorno: 1 se lavora, 0,5 se un'assenza gli
  // toglie meta' della fascia, 0 se non lavora o e' assente
  const presenza = (tc, g) => {
    if (!presenzePerTecnico.get(tc.id)?.has(g)) return 0;
    const ass = contesto.get(tc.id)?.get(g)?.assente;
    if (!ass || !ass.size) return 1;
    const libere = mezze.filter(h => !ass.has(h === 0 ? 'AM' : 'PM')).length;
    return libere / mezze.length;
  };
  const copertura = giorni.map(g => technicians.reduce((s, tc) => s + presenza(tc, g), 0));
  const scoperti = richiesti ? giorni.filter((g, i) => giorniAttivita.has(g) && copertura[i] < richiesti) : [];
  const numero = (n) => Number(n).toLocaleString(locale, { maximumFractionDigits: 1 });

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
                    const tipo = dayKind ? dayKind(g) : null;
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
                        const tipo = dayKind ? dayKind(g) : null;
                        const riposa = diRiposo(g);
                        const x = info.get(g);
                        const assente = x ? x.assente : null;
                        const altrove = x ? x.altrove : [];
                        // Il riposo si vede anche quando il festivo e' lavorabile
                        const sfondo = acceso ? (tc.color || 'var(--accent)')
                          : tipo === 'holiday' ? 'rgba(239,68,68,0.10)'
                          : (tipo === 'rest' || riposa) ? 'rgba(128,128,128,0.12)' : 'var(--surface2)';
                        const descrizione = [
                          `${tc.name} — ${new Date(g + 'T00:00:00').toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' })}`,
                          acceso ? t('presentLegend') : riposa ? t('restLegend') : t('notPresent'),
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
                                background: sfondo,
                                border: acceso && riposa ? '2px solid var(--fg)' : '1px solid var(--border)',
                                boxSizing: 'border-box',
                                cursor: 'pointer', userSelect: 'none', touchAction: 'none',
                              }}
                            >
                              {assente && assente.size > 0 && (
                                <span style={{
                                  position: 'absolute', top: 0, bottom: 0, borderRadius: 3, pointerEvents: 'none',
                                  left: assente.size === 1 && assente.has('PM') ? '50%' : 0,
                                  right: assente.size === 1 && assente.has('AM') ? '50%' : 0,
                                  background: 'repeating-linear-gradient(45deg, rgba(245,158,11,0.85) 0 2px, transparent 2px 5px)',
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
                    const g = giorni[i];
                    // Nei giorni di riposo la copertura non si controlla: si
                    // mostra solo chi lavora, senza colore
                    const controllato = giorniAttivita.has(g);
                    const manca = controllato && richiesti && n < richiesti;
                    return (
                      <td key={g}>
                        <div style={{
                          width: CELLA, height: 18, lineHeight: '18px', borderRadius: 4, textAlign: 'center',
                          background: !controllato ? 'transparent'
                            : manca ? 'rgba(239,68,68,0.15)' : 'rgba(22,163,74,0.12)',
                          color: !controllato ? 'var(--muted)' : manca ? '#ef4444' : '#16a34a', fontSize: 11,
                        }}>{controllato || n ? numero(n) : ''}</div>
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
                background: 'rgba(128,128,128,0.25)', border: '1px solid var(--border)' }} />
              {' '}{t('restLegend')}
            </span>
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
              const intera = lista.length === tutti.size && lista.every(g => tutti.has(g));
              const testo = !lista.length ? t('noDaysRemoved')
                : intera ? t('wholeDuration')
                : tratti(lista);
              // Giorni di riposo lavorati: si scrivono a parte, perche' sono
              // l'eccezione da notare
              const extra = lista.filter(g => diRiposo(g));
              return (
                <div key={tc.id}>
                  <strong>{tc.name}</strong>
                  <span style={{ color: lista.length ? 'var(--muted)' : '#ef4444' }}> — {testo}</span>
                  {!intera && extra.length > 0 && (
                    <span style={{ color: 'var(--muted)' }}> · {t('restWorked')}: {extra.map(breve).join(', ')}</span>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 4, color: richiesti ? (scoperti.length ? '#ef4444' : '#16a34a') : 'var(--muted)' }}>
              {!richiesti ? t('noRequirement')
                : scoperti.length ? `${t('uncoveredDays')}: ${tratti(scoperti)}`
                : t('coverageComplete')}
            </div>
            {(() => {
              const conflitti = technicians.map(tc => {
                const info = contesto.get(tc.id) || new Map();
                const giorniConflitto = giorni.filter(g => presenza(tc, g) > 0 && (info.get(g)?.altrove.length));
                return giorniConflitto.length ? `${tc.name} ${tratti(giorniConflitto)}` : null;
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
