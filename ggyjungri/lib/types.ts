export type Major = { id: string; name: string; en: string };
export type Minor = { id: string; major: string; name: string; en: string; color: string };
export type Classes = { major: Major[]; minor: Minor[] };

export type Ingredient = {
  id: string;
  class: string;
  ko: string;
  en: string;
  sedating: boolean;
  pregnancyDUR2: boolean;
  caffeine?: boolean;
  notes?: string;
};

export type Series = { id: string; name: string; maker: string; homepage: string | null };

export type Product = {
  id: string;
  series: string;
  name: string;
  mfdsCode: string;
  kpicId: string | null;
  form: string;
  pack: string;
  unit: string;
  perDoseMax: number;
  timesPerDayMax: number;
  age: string;
  dosageText: string;
  /** 1정수(1캡슐·1병·1포)당 mg */
  ingredients: Record<string, number>;
  durNotes: string[];
  price: number | null;
  verified: boolean;
  sources: { mfds: string | null; kpic: string | null; maker: string | null };
  checkedAt: string;
  /** 식약처 허가 업체 (판매사와 다를 때 표시) */
  permitHolder?: string;
  notes: string;
};
