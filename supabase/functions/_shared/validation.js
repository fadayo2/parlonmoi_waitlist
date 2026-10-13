// Shared by the browser and Edge Function; the database enforces its own checks.
export const COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');

export const LEVELS = Object.freeze({
  A0: 'New to French',
  A1: 'A1 — Beginner',
  A2: 'A2 — Elementary',
  B1: 'B1 — Intermediate',
  B2: 'B2 — Upper intermediate',
  C1: 'C1 — Advanced',
  C2: 'C2 — Proficient',
  native: 'Native speaker',
});

const countries = new Set(COUNTRY_CODES);
const emailPattern = /^[a-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[a-z0-9!#$%&'*+\-/=?^_`{|}~]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeFields(input = {}) {
  const text = (value) => typeof value === 'string' ? value : '';
  return {
    full_name: text(input.full_name).trim().replace(/\s+/gu, ' '),
    email: text(input.email).trim().toLowerCase(),
    country: text(input.country).trim().toUpperCase(),
    french_level: text(input.french_level),
  };
}

export function validateFields(input) {
  const data = normalizeFields(input);
  const errors = {};
  if ([...data.full_name].length < 2 || [...data.full_name].length > 100 || /[\u0000-\u001f\u007f]/u.test(input?.full_name ?? '')) {
    errors.full_name = 'Enter your full name using 2–100 characters.';
  }
  const [local = '', domain = ''] = data.email.split('@');
  if (data.email.length > 254 || local.length > 64 || !emailPattern.test(data.email) || domain.split('.').some(label => label.length > 63)) {
    errors.email = 'Enter a valid email, such as name@example.com, using Latin characters.';
  }
  if (!countries.has(data.country)) errors.country = 'Select your country or territory.';
  if (!Object.hasOwn(LEVELS, data.french_level)) errors.french_level = 'Select the level closest to your French.';
  return { data, errors, valid: Object.keys(errors).length === 0 };
}
