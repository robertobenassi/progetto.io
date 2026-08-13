// Elenco delle nazioni raggruppate per area geografica.
// Qui stanno solo i codici ISO 3166-1 alpha-2: i nomi li traduce il browser
// con Intl.DisplayNames, evitando di mantenere a mano 195 nomi per sei lingue.

export const REGIONS = [
  { id: 'europe_west',   codes: ['AT','BE','CH','DE','DK','ES','FI','FR','GB','GR','IE','IS','IT','LI','LU','MC','MT','NL','NO','PT','SE','SM','VA','AD'] },
  { id: 'europe_east',   codes: ['AL','BA','BG','BY','CY','CZ','EE','HR','HU','LT','LV','MD','ME','MK','PL','RO','RS','RU','SI','SK','UA','XK'] },
  { id: 'middle_east',   codes: ['AE','BH','IL','IQ','IR','JO','KW','LB','OM','PS','QA','SA','SY','TR','YE'] },
  { id: 'africa_north',  codes: ['DZ','EG','LY','MA','MR','SD','TN'] },
  { id: 'africa_sub',    codes: ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','MG','ML','MU','MW','MZ','NA','NE','NG','RW','SC','SL','SN','SO','SS','ST','SZ','TD','TG','TZ','UG','ZA','ZM','ZW'] },
  { id: 'asia_central',  codes: ['AF','AM','AZ','GE','KG','KZ','PK','TJ','TM','UZ'] },
  { id: 'asia_south',    codes: ['BD','BT','IN','LK','MV','NP'] },
  { id: 'asia_east',     codes: ['CN','HK','JP','KP','KR','MN','MO','TW'] },
  { id: 'asia_southeast',codes: ['BN','ID','KH','LA','MM','MY','PH','SG','TH','TL','VN'] },
  { id: 'oceania',       codes: ['AU','FJ','NZ','PG','SB','VU','WS'] },
  { id: 'america_north', codes: ['CA','MX','US'] },
  { id: 'america_central',codes: ['BS','BZ','CR','CU','DO','GT','HN','HT','JM','NI','PA','SV','TT'] },
  { id: 'america_south', codes: ['AR','BO','BR','CL','CO','EC','GY','PE','PY','SR','UY','VE'] },
];

export const ALL_COUNTRIES = REGIONS.flatMap(r => r.codes);

export const regionOf = (code) =>
  (REGIONS.find(r => r.codes.includes(code)) || {}).id || null;

// Nome tradotto nella lingua corrente; se il browser non lo conosce
// resta il codice, che e' comunque riconoscibile.
export const countryName = (code, locale) => {
  try {
    return new Intl.DisplayNames([locale || 'it'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
};
