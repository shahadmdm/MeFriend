import type { ILookupOption } from '../../../../shared/models/ILookupOption';

export type CollectionReportCriteria = 'Unit' | 'Salesperson';

export const collectionReportMonthOptions: readonly ILookupOption<string>[] = [
  { key: '1', text: 'January', value: '1' },
  { key: '2', text: 'February', value: '2' },
  { key: '3', text: 'March', value: '3' },
  { key: '4', text: 'April', value: '4' },
  { key: '5', text: 'May', value: '5' },
  { key: '6', text: 'June', value: '6' },
  { key: '7', text: 'July', value: '7' },
  { key: '8', text: 'August', value: '8' },
  { key: '9', text: 'September', value: '9' },
  { key: '10', text: 'October', value: '10' },
  { key: '11', text: 'November', value: '11' },
  { key: '12', text: 'December', value: '12' }
];

export const collectionReportCriteriaOptions:
  readonly ILookupOption<CollectionReportCriteria>[] = [
    { key: 'Unit', text: 'Unit', value: 'Unit' },
    { key: 'Salesperson', text: 'Salesperson', value: 'Salesperson' }
  ];

export interface ICollectionReportPeriod {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  startDate: Date;
  endDate: Date;
  periodicity: number;
  label: string;
}

const formatReportDate = (date: Date): string => {
  const day = ('0' + date.getDate()).slice(-2);
  const month = collectionReportMonthOptions[date.getMonth()].text.slice(0, 3);
  return `${day} ${month} ${date.getFullYear()}`;
};

export const getCollectionReportPeriod = (
  month: number,
  year: number,
  periodicity: number = 1
): ICollectionReportPeriod => {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Invalid report month.');
  }

  if (!Number.isInteger(year) || year < 1 || year > 9999 ||
      (year === 9999 && month === 12)) {
    throw new Error('Invalid report year.');
  }

  if (!Number.isSafeInteger(periodicity) || periodicity < 1) {
    throw new Error('Periodicity must be a positive whole number.');
  }

  const endMonthIndex = (year - 1) * 12 + month - 1;
  if (periodicity - 1 > endMonthIndex) {
    throw new Error('The selected reporting period starts before year 1.');
  }

  const startMonthIndex = endMonthIndex - (periodicity - 1);
  const startYear = Math.floor(startMonthIndex / 12) + 1;
  const startMonth = startMonthIndex % 12 + 1;

  // setFullYear handles years 1–99 without Date constructor's 1900 offset.
  const startDate = new Date(0);
  startDate.setFullYear(startYear, startMonth - 1, 1);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(0);
  endDate.setFullYear(year, month, 0);
  endDate.setHours(0, 0, 0, 0);

  return {
    startYear,
    startMonth,
    endYear: year,
    endMonth: month,
    startDate,
    endDate,
    periodicity,
    label: `${formatReportDate(startDate)} – ${formatReportDate(endDate)}`
  };
};

export const getCollectionReportYearOptions = (
  availableYears: readonly number[],
  currentYear: number = new Date().getFullYear()
): readonly ILookupOption<string>[] => {
  const years = Array.from(new Set([
    ...availableYears,
    currentYear,
    currentYear + 1,
    currentYear + 2
  ]))
    .filter(year => Number.isInteger(year) && year >= 2000 && year <= 2100)
    .sort((first, second) => second - first);

  return years.map(year => ({
    key: String(year),
    text: String(year),
    value: String(year)
  }));
};
