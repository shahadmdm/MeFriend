
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
    {
      key: 'Salesperson',
      text: 'Salesperson',
      value: 'Salesperson'
    }
  ];

export const getCollectionReportYearOptions = (
  availableYears: readonly number[],
  currentYear: number = new Date().getFullYear()
): readonly ILookupOption<string>[] => {
  const years = Array.from(
    new Set([
      ...availableYears,
      currentYear,
      currentYear + 1,
      currentYear + 2
    ])
  )
    .filter(year =>
      Number.isInteger(year) &&
      year >= 2000 &&
      year <= 2100
    )
    .sort((first, second) => second - first);

  return years.map(year => ({
    key: String(year),
    text: String(year),
    value: String(year)
  }));
};