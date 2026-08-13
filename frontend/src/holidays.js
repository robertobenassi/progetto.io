// Calcolo delle festivita' nazionali.
//
// Nessuna chiamata a servizi esterni: le feste fisse sono tabellate e quelle
// mobili derivano dalla Pasqua, che ha un algoritmo esatto. Cosi' il calcolo
// funziona anche senza connessione e non dipende da un servizio che domani
// potrebbe non esserci piu'.
//
// Le festivita' islamiche seguono il calendario lunare e non sono calcolabili
// con precisione in anticipo: per quei paesi si inseriscono a mano.

// Domenica di Pasqua secondo l'algoritmo di Meeus/Jones/Butcher
export const easterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, mese - 1, giorno);
};

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// n-esimo giorno della settimana del mese (n negativo = dall'ultimo)
const nthWeekday = (year, month, weekday, n) => {
  if (n > 0) {
    const d = new Date(year, month, 1);
    const delta = (weekday - d.getDay() + 7) % 7;
    return new Date(year, month, 1 + delta + (n - 1) * 7);
  }
  const d = new Date(year, month + 1, 0);
  const delta = (d.getDay() - weekday + 7) % 7;
  return new Date(year, month + 1, 0 - delta);
};

// Feste fisse: [mese (1-12), giorno, descrizione]
const FISSE = {
  IT: [[1,1,'Capodanno'],[1,6,'Epifania'],[4,25,'Liberazione'],[5,1,'Festa del Lavoro'],
       [6,2,'Festa della Repubblica'],[8,15,'Ferragosto'],[11,1,'Ognissanti'],
       [12,8,'Immacolata'],[12,25,'Natale'],[12,26,'Santo Stefano']],
  FR: [[1,1,'Jour de l\'An'],[5,1,'Fête du Travail'],[5,8,'Victoire 1945'],
       [7,14,'Fête nationale'],[8,15,'Assomption'],[11,1,'Toussaint'],
       [11,11,'Armistice'],[12,25,'Noël']],
  DE: [[1,1,'Neujahr'],[5,1,'Tag der Arbeit'],[10,3,'Tag der Deutschen Einheit'],
       [12,25,'1. Weihnachtstag'],[12,26,'2. Weihnachtstag']],
  ES: [[1,1,'Año Nuevo'],[1,6,'Reyes'],[5,1,'Día del Trabajador'],[8,15,'Asunción'],
       [10,12,'Fiesta Nacional'],[11,1,'Todos los Santos'],[12,6,'Constitución'],
       [12,8,'Inmaculada'],[12,25,'Navidad']],
  PT: [[1,1,'Ano Novo'],[4,25,'Dia da Liberdade'],[5,1,'Dia do Trabalhador'],
       [6,10,'Dia de Portugal'],[8,15,'Assunção'],[10,5,'Implantação da República'],
       [11,1,'Todos os Santos'],[12,1,'Restauração da Independência'],
       [12,8,'Imaculada Conceição'],[12,25,'Natal']],
  GB: [[1,1,'New Year\'s Day'],[12,25,'Christmas Day'],[12,26,'Boxing Day']],
  IE: [[1,1,'New Year\'s Day'],[3,17,'St Patrick\'s Day'],[12,25,'Christmas Day'],[12,26,'St Stephen\'s Day']],
  NL: [[1,1,'Nieuwjaar'],[4,27,'Koningsdag'],[5,5,'Bevrijdingsdag'],[12,25,'Eerste Kerstdag'],[12,26,'Tweede Kerstdag']],
  BE: [[1,1,'Nouvel An'],[5,1,'Fête du Travail'],[7,21,'Fête nationale'],[8,15,'Assomption'],
       [11,1,'Toussaint'],[11,11,'Armistice'],[12,25,'Noël']],
  AT: [[1,1,'Neujahr'],[1,6,'Heilige Drei Könige'],[5,1,'Staatsfeiertag'],[8,15,'Mariä Himmelfahrt'],
       [10,26,'Nationalfeiertag'],[11,1,'Allerheiligen'],[12,8,'Mariä Empfängnis'],
       [12,25,'Christtag'],[12,26,'Stefanitag']],
  CH: [[1,1,'Neujahr'],[8,1,'Bundesfeier'],[12,25,'Weihnachten']],
  PL: [[1,1,'Nowy Rok'],[1,6,'Trzech Króli'],[5,1,'Święto Pracy'],[5,3,'Święto Konstytucji'],
       [8,15,'Wniebowzięcie'],[11,1,'Wszystkich Świętych'],[11,11,'Święto Niepodległości'],
       [12,25,'Boże Narodzenie'],[12,26,'Drugi dzień Bożego Narodzenia']],
  CZ: [[1,1,'Nový rok'],[5,1,'Svátek práce'],[5,8,'Den vítězství'],[7,5,'Cyril a Metoděj'],
       [7,6,'Jan Hus'],[9,28,'Den české státnosti'],[10,28,'Vznik Československa'],
       [11,17,'Den boje za svobodu'],[12,24,'Štědrý den'],[12,25,'1. svátek vánoční'],[12,26,'2. svátek vánoční']],
  SE: [[1,1,'Nyårsdagen'],[1,6,'Trettondedag jul'],[5,1,'Första maj'],[6,6,'Nationaldagen'],
       [12,25,'Juldagen'],[12,26,'Annandag jul']],
  NO: [[1,1,'Nyttårsdag'],[5,1,'Arbeidernes dag'],[5,17,'Grunnlovsdag'],[12,25,'Første juledag'],[12,26,'Andre juledag']],
  DK: [[1,1,'Nytårsdag'],[6,5,'Grundlovsdag'],[12,25,'Juledag'],[12,26,'2. juledag']],
  FI: [[1,1,'Uudenvuodenpäivä'],[1,6,'Loppiainen'],[5,1,'Vappu'],[12,6,'Itsenäisyyspäivä'],
       [12,25,'Joulupäivä'],[12,26,'Tapaninpäivä']],
  GR: [[1,1,'Πρωτοχρονιά'],[1,6,'Θεοφάνεια'],[3,25,'Εικοστή Πέμπτη Μαρτίου'],[5,1,'Εργατική Πρωτομαγιά'],
       [8,15,'Κοίμηση Θεοτόκου'],[10,28,'Επέτειος του Όχι'],[12,25,'Χριστούγεννα'],[12,26,'Σύναξη Θεοτόκου']],
  US: [[1,1,'New Year\'s Day'],[6,19,'Juneteenth'],[7,4,'Independence Day'],
       [11,11,'Veterans Day'],[12,25,'Christmas Day']],
  CA: [[1,1,'New Year\'s Day'],[7,1,'Canada Day'],[12,25,'Christmas Day'],[12,26,'Boxing Day']],
  MX: [[1,1,'Año Nuevo'],[5,1,'Día del Trabajo'],[9,16,'Independencia'],[12,25,'Navidad']],
  BR: [[1,1,'Confraternização'],[4,21,'Tiradentes'],[5,1,'Dia do Trabalhador'],
       [9,7,'Independência'],[10,12,'Nossa Senhora Aparecida'],[11,2,'Finados'],
       [11,15,'Proclamação da República'],[12,25,'Natal']],
  AU: [[1,1,'New Year\'s Day'],[1,26,'Australia Day'],[4,25,'Anzac Day'],
       [12,25,'Christmas Day'],[12,26,'Boxing Day']],
  NZ: [[1,1,'New Year\'s Day'],[1,2,'Day after New Year\'s Day'],[2,6,'Waitangi Day'],
       [4,25,'Anzac Day'],[12,25,'Christmas Day'],[12,26,'Boxing Day']],
  ZA: [[1,1,'New Year\'s Day'],[3,21,'Human Rights Day'],[4,27,'Freedom Day'],[5,1,'Workers\' Day'],
       [6,16,'Youth Day'],[8,9,'National Women\'s Day'],[9,24,'Heritage Day'],
       [12,16,'Day of Reconciliation'],[12,25,'Christmas Day'],[12,26,'Day of Goodwill']],
  IN: [[1,26,'Republic Day'],[8,15,'Independence Day'],[10,2,'Gandhi Jayanti']],
  JP: [[1,1,'元日'],[2,11,'建国記念の日'],[2,23,'天皇誕生日'],[4,29,'昭和の日'],
       [5,3,'憲法記念日'],[5,4,'みどりの日'],[5,5,'こどもの日'],[8,11,'山の日'],
       [11,3,'文化の日'],[11,23,'勤労感謝の日']],
  CN: [[1,1,'元旦'],[5,1,'劳动节'],[10,1,'国庆节']],
  SG: [[1,1,'New Year\'s Day'],[5,1,'Labour Day'],[8,9,'National Day'],[12,25,'Christmas Day']],
  TR: [[1,1,'Yılbaşı'],[4,23,'Ulusal Egemenlik'],[5,1,'Emek ve Dayanışma'],[5,19,'Atatürk\'ü Anma'],
       [7,15,'Demokrasi Bayramı'],[8,30,'Zafer Bayramı'],[10,29,'Cumhuriyet Bayramı']],
  IL: [[5,14,'יום העצמאות']],
};

// Feste mobili legate alla Pasqua: [scarto in giorni, descrizione]
const PASQUALI = {
  IT: [[1,'Lunedì dell\'Angelo']],
  FR: [[1,'Lundi de Pâques'],[39,'Ascension'],[50,'Lundi de Pentecôte']],
  DE: [[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag']],
  ES: [[-2,'Viernes Santo']],
  PT: [[-2,'Sexta-feira Santa'],[0,'Páscoa']],
  GB: [[-2,'Good Friday'],[1,'Easter Monday']],
  IE: [[1,'Easter Monday']],
  NL: [[-2,'Goede Vrijdag'],[1,'Tweede Paasdag'],[39,'Hemelvaartsdag'],[50,'Tweede Pinksterdag']],
  BE: [[1,'Lundi de Pâques'],[39,'Ascension'],[50,'Lundi de Pentecôte']],
  AT: [[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag'],[60,'Fronleichnam']],
  CH: [[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Auffahrt'],[50,'Pfingstmontag']],
  PL: [[0,'Wielkanoc'],[1,'Poniedziałek Wielkanocny'],[60,'Boże Ciało']],
  CZ: [[-2,'Velký pátek'],[1,'Velikonoční pondělí']],
  SE: [[-2,'Långfredagen'],[1,'Annandag påsk'],[39,'Kristi himmelsfärds dag']],
  NO: [[-3,'Skjærtorsdag'],[-2,'Langfredag'],[1,'Andre påskedag'],[39,'Kristi himmelfartsdag'],[50,'Andre pinsedag']],
  DK: [[-3,'Skærtorsdag'],[-2,'Langfredag'],[1,'2. påskedag'],[39,'Kristi himmelfartsdag'],[50,'2. pinsedag']],
  FI: [[-2,'Pitkäperjantai'],[1,'2. pääsiäispäivä'],[39,'Helatorstai']],
  BR: [[-2,'Sexta-feira Santa'],[-47,'Carnaval'],[60,'Corpus Christi']],
  AU: [[-2,'Good Friday'],[1,'Easter Monday']],
  NZ: [[-2,'Good Friday'],[1,'Easter Monday']],
  ZA: [[-2,'Good Friday'],[1,'Family Day']],
  MX: [[-2,'Viernes Santo']],
};

// Feste su n-esimo giorno della settimana: [mese 0-11, giorno settimana, n, descrizione]
const RICORRENTI = {
  GB: [[4,1,1,'Early May Bank Holiday'],[4,1,-1,'Spring Bank Holiday'],[7,1,-1,'Summer Bank Holiday']],
  US: [[0,1,3,'Martin Luther King Jr. Day'],[1,1,3,'Presidents\' Day'],[4,1,-1,'Memorial Day'],
       [8,1,1,'Labor Day'],[9,1,2,'Columbus Day'],[10,4,4,'Thanksgiving']],
  CA: [[8,1,1,'Labour Day'],[9,1,2,'Thanksgiving']],
  AU: [[5,1,2,'Queen\'s Birthday']],
};

export const SUPPORTED = [...new Set([
  ...Object.keys(FISSE), ...Object.keys(PASQUALI), ...Object.keys(RICORRENTI),
])].sort();

// Festivita' di una nazione per un anno. Restituisce [{date, name}]
export const computeHolidays = (country, year) => {
  const cc = String(country || '').toUpperCase();
  const out = new Map();   // la data e' la chiave: niente doppioni

  (FISSE[cc] || []).forEach(([m, d, nome]) => {
    out.set(iso(new Date(year, m - 1, d)), nome);
  });

  const pasqua = easterSunday(year);
  (PASQUALI[cc] || []).forEach(([delta, nome]) => {
    out.set(iso(shift(pasqua, delta)), nome);
  });

  (RICORRENTI[cc] || []).forEach(([mese, gg, n, nome]) => {
    out.set(iso(nthWeekday(year, mese, gg, n)), nome);
  });

  return [...out.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
};
