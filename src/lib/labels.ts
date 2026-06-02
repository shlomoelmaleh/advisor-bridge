// Shared Hebrew labels + option lists for the DB enum-like string fields.
// Single source of truth so the case form, the appetite form, and every
// display screen stay in sync — and so raw English values never leak into
// the RTL Hebrew UI. Each labeller falls back to the raw value if unknown.

export interface Option {
  value: string;
  label: string;
}

export const REGION_OPTIONS: readonly Option[] = [
  { value: 'center', label: 'מרכז' },
  { value: 'tel_aviv', label: 'תל אביב' },
  { value: 'jerusalem', label: 'ירושלים' },
  { value: 'north', label: 'צפון' },
  { value: 'south', label: 'דרום' },
  { value: 'sharon', label: 'שרון' },
  { value: 'shfela', label: 'שפלה' },
];

export const PROPERTY_TYPE_OPTIONS: readonly Option[] = [
  { value: 'apartment', label: 'דירה' },
  { value: 'private_house', label: 'בית פרטי' },
  { value: 'penthouse', label: 'פנטהאוז' },
  { value: 'commercial', label: 'מסחרי' },
  { value: 'land', label: 'קרקע' },
];

export const BORROWER_TYPE_OPTIONS: readonly Option[] = [
  { value: 'employee', label: 'שכיר' },
  { value: 'self_employed', label: 'עצמאי' },
];

export const APPETITE_LEVEL_OPTIONS: readonly Option[] = [
  { value: 'high', label: 'גבוה' },
  { value: 'medium', label: 'בינוני' },
  { value: 'low', label: 'נמוך' },
];

const toMap = (opts: readonly Option[]): Record<string, string> =>
  Object.fromEntries(opts.map((o) => [o.value, o.label]));

const REGION_MAP = toMap(REGION_OPTIONS);
const PROPERTY_TYPE_MAP = toMap(PROPERTY_TYPE_OPTIONS);
const BORROWER_TYPE_MAP = toMap(BORROWER_TYPE_OPTIONS);
const APPETITE_LEVEL_MAP = toMap(APPETITE_LEVEL_OPTIONS);

export const regionLabel = (v?: string | null): string => (v ? REGION_MAP[v] ?? v : '');
export const propertyTypeLabel = (v?: string | null): string => (v ? PROPERTY_TYPE_MAP[v] ?? v : '');
export const borrowerTypeLabel = (v?: string | null): string => (v ? BORROWER_TYPE_MAP[v] ?? v : '');
export const appetiteLevelLabel = (v?: string | null): string => (v ? APPETITE_LEVEL_MAP[v] ?? v : '');

/** Join a list of region values into a Hebrew comma-separated string. */
export const regionsLabel = (values?: string[] | null): string =>
  values && values.length ? values.map(regionLabel).join(', ') : '';

/** Join a list of borrower-type values into a Hebrew comma-separated string. */
export const borrowerTypesLabel = (values?: string[] | null): string =>
  values && values.length ? values.map(borrowerTypeLabel).join(', ') : '';
