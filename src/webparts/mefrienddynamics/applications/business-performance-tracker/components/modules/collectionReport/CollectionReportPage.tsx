import * as React from 'react';

import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { Button } from '../../../../../shared/components/buttons/Button';
import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';

import { collectionReportModuleConfig } from '../../../config/modules/collectionReportModuleConfig';

import {
  collectionReportMonthOptions,
  collectionReportCriteriaOptions,
  getCollectionReportYearOptions,
  getCollectionReportPeriod
} from '../../../config/modules/collectionReportFilterConfig';

import type {
  CollectionReportCriteria
} from '../../../config/modules/collectionReportFilterConfig';

import type { ITargetListItem } from '../../../models/targets';
import type { IVerticalListItem } from '../../../models/verticals';

import type { TargetService } from '../../../services/targets/targetService';
import type { VerticalService } from '../../../services/verticals/verticalService';
import type { BusinessReportApiService } from '../../../services/businessReport/businessReportApiService';
import type { UnitService } from '../../../services/units/unitService';
import type {
  BusinessPerformanceUnitAccessService
} from '../../../services/access/businessPerformanceUnitAccessService';
import type {
  ISalespersonLookupItem
} from '../../../../bc-extension/services/salespersons/salespersonService';

import type { ILookupOption } from '../../../../../shared/models/ILookupOption';

import type { IBusinessReportTotal, IBusinessReportCell } from '../../../services/businessReport/businessReportMapper';
import { getBusinessReportCell } from '../../../services/businessReport/businessReportMapper';

import {
  bcCompanies,
  getBcCompanyLabel
} from '../../../../bc-extension/config/bcCompanies';

import { BusinessBreakdownModal } from './BusinessBreakdownModal';

import styles from './CollectionReportPage.module.scss';


export interface ICollectionReportPageProps {
  targetService: TargetService;
  verticalService: VerticalService;
  unitService: UnitService;
  unitAccessService: BusinessPerformanceUnitAccessService;
  appUserId?: number;
  loadSalespersons: (
    companyId: string,
    searchText?: string
  ) => Promise<readonly ISalespersonLookupItem[]>;
  businessReportApiService?: BusinessReportApiService;
  selectedCompanyId?: string;
}

interface IReportSelection {
  month: string;
  year: string;
  criteria: CollectionReportCriteria;
  periodicity: number;
  periodLabel: string;
  companyId?: string;
}

interface IReportRow {
  key: string;
  name: string;
  code: string;
  companyId: string;
  targetsByVertical: Map<number, ITargetListItem>;
}

// Compact table sizing: allow more business verticals to fit without scrolling.
const numberColumnWidth = 44;
const targetColumnWidth = 116;
const businessColumnWidth = 122;
const percentageColumnWidth = 72;
const verticalGroupWidth =
  targetColumnWidth + businessColumnWidth + percentageColumnWidth;

// Presentation only. Keep achievement calculations unchanged.
const renderAchievement = (percentage: number | undefined): React.ReactNode => {
  if (percentage === undefined || !Number.isFinite(percentage)) {
    return <span className={styles.fallback}>—</span>;
  }

  return (
    <span className={styles.achievementValue}>
      {percentage.toFixed(1)}%
    </span>
  );
};

const normalizeCode = (code: string): string =>
  code.trim().toUpperCase();

const getCompanyDisplayName = (companyId: string): string => {
  const company = bcCompanies.find(
    item =>
      item.id.toLowerCase() === companyId.trim().toLowerCase()
  );

  return company
    ? getBcCompanyLabel(company)
    : `Unknown Company (${companyId || 'Missing ID'})`;
};

// Sum one monthly target per company, criteria, code and vertical.
// The representative record retains its identity and inactive status.
const aggregatePeriodTargets = (
  targets: readonly ITargetListItem[]
): readonly ITargetListItem[] => {
  const grouped = new Map<string, ITargetListItem>();

  for (const target of targets) {
    const key = JSON.stringify([
      target.companyId.trim().toUpperCase(),
      target.targetType,
      normalizeCode(target.targetCode),
      target.verticalId
    ]);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...target });
      continue;
    }

    grouped.set(key, {
      ...existing,
      targetAmount: existing.targetAmount + target.targetAmount,
      // Show inactive only when every contributing target is inactive.
      isActive: existing.isActive || target.isActive
    });
  }

  return Array.from(grouped.values());
};

const buildReportRows = (
  targets: readonly ITargetListItem[]
): readonly IReportRow[] => {
  const grouped = new Map<string, IReportRow>();

  for (const item of targets) {
    // Never merge targets belonging to different companies.
    const key = JSON.stringify([
      item.companyId,
      item.targetType,
      normalizeCode(item.targetCode)
    ]);

    let row = grouped.get(key);

    if (!row) {
      row = {
        key,
        name: item.targetName,
        code: item.targetCode,
        companyId: item.companyId,
        targetsByVertical: new Map<number, ITargetListItem>()
      };

      grouped.set(key, row);
    }

    row.targetsByVertical.set(item.verticalId, item);
  }

  return Array.from(grouped.values()).sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        undefined,
        { sensitivity: 'base' }
      ) ||
      first.companyId.localeCompare(second.companyId) ||
      first.code.localeCompare(second.code)
  );
};

export const CollectionReportPage:
  React.FC<ICollectionReportPageProps> = ({
  targetService,
  verticalService,
  unitService,
  unitAccessService,
  appUserId,
  businessReportApiService,
  selectedCompanyId
}) => {
    const today = new Date();
    const currentMonth = String(today.getMonth() + 1);
    const currentYear = today.getFullYear();

    const [month, setMonth] =
      React.useState<string>(currentMonth);

    const [year, setYear] =
      React.useState<string>(String(currentYear));

    const [criteria, setCriteria] =
      React.useState<CollectionReportCriteria>('Salesperson');

    const [periodicity, setPeriodicity] = React.useState<string>('1');

    const parsedPeriodicity = Number(periodicity);
    const periodInputValid = /^\d+$/.test(periodicity) &&
      Number.isSafeInteger(parsedPeriodicity) && parsedPeriodicity >= 1;
    const previewPeriod = (() => {
      if (!periodInputValid) {
        return undefined;
      }
      try {
        return getCollectionReportPeriod(Number(month), Number(year), parsedPeriodicity);
      } catch {
        return undefined;
      }
    })();

    const [appliedSelection, setAppliedSelection] =
      React.useState<IReportSelection | undefined>();

    const [reportTargets, setReportTargets] =
      React.useState<readonly ITargetListItem[]>([]);

    const [reportVerticals, setReportVerticals] =
      React.useState<readonly IVerticalListItem[]>([]);

    const [reportTotals, setReportTotals] =
      React.useState<readonly IBusinessReportTotal[]>([]);

    const [loading, setLoading] =
      React.useState<boolean>(false);

    const [error, setError] =
      React.useState<string | undefined>();

    const [businessBreakdown, setBusinessBreakdown] = React.useState<{
      name: string;
      code: string;
      verticalName: string;
      cell: IBusinessReportCell;
    } | undefined>();

    const openBusinessBreakdown = (
      row: IReportRow,
      vertical: IVerticalListItem,
      cell: IBusinessReportCell
    ): void => {
      setBusinessBreakdown({
        name: row.name,
        code: row.code,
        verticalName: vertical.verticalName,
        cell
      });
    };

    // Invalidate in-flight requests when the selected company
    // changes or this page is unmounted.
    const reportRequestId = React.useRef<number>(0);


    const [unitAccess, setUnitAccess] = React.useState<{
    companyId: string;
    appUserId: number;
    unitCodes: readonly string[];
  } | undefined>();

  const [unitAccessLoading, setUnitAccessLoading] =
    React.useState<boolean>(true);

  const [unitAccessError, setUnitAccessError] =
    React.useState<string | undefined>();

  const [selectedCodes, setSelectedCodes] =
  React.useState<readonly string[]>(['__ALL__']);

  const [lookupOptions, setLookupOptions] =
    React.useState<readonly ILookupOption[]>([]);

  const [lookupLoading, setLookupLoading] =
    React.useState<boolean>(false);

  const [lookupError, setLookupError] =
    React.useState<string | undefined>();

  React.useEffect(() => {
    let active = true;

    setUnitAccess(undefined);
    setUnitAccessLoading(true);
    setUnitAccessError(undefined);

    if (
      !selectedCompanyId ||
      !appUserId ||
      !Number.isSafeInteger(appUserId) ||
      appUserId <= 0
    ) {
      setUnitAccessError('Unable to verify your Unit permissions.');
      setUnitAccessLoading(false);
      return () => { active = false; };
    }

    const companyId = selectedCompanyId;
    const userId = appUserId;

    const loadAccess = async (): Promise<void> => {
      try {
        const [assignedIds, units] = await Promise.all([
          unitAccessService.getAssignedUnitIds(userId, companyId),
          unitService.getUnits()
        ]);

        if (!active) return;

        const assignedSet = new Set<number>(assignedIds);

        const unitCodes = Array.from(new Set(
          units
            .filter(unit =>
              unit.isActive &&
              assignedSet.has(unit.id)
            )
            .map(unit => normalizeCode(unit.unitCode))
            .filter(code => code.length > 0)
        ));

        if (unitCodes.length === 0) {
          setUnitAccessError(
            'No active Units assigned to you for this company.'
          );
          return;
        }

        setUnitAccess({ companyId, appUserId: userId, unitCodes });
      } catch (loadError) {
        if (active) {
          setUnitAccessError(getUserFriendlyError(loadError));
        }
      } finally {
        if (active) {
          setUnitAccessLoading(false);
        }
      }
    };

    void loadAccess();

    return () => { active = false; };
  }, [
    selectedCompanyId,
    appUserId,
    unitService,
    unitAccessService
  ]);


  React.useEffect(() => {
  let active = true;

  setSelectedCodes(['__ALL__']);
  setLookupOptions([]);
  setLookupError(undefined);

  if (
    !selectedCompanyId ||
    !unitAccess ||
    unitAccess.companyId !== selectedCompanyId ||
    unitAccess.appUserId !== appUserId
  ) {
    setLookupLoading(false);
    return () => { active = false; };
  }

  const companyId = selectedCompanyId;
  const allowedCodes = new Set(
    unitAccess.unitCodes.map(normalizeCode)
  );

  setLookupLoading(true);

  const loadOptions = async (): Promise<void> => {
    try {
      let options: ILookupOption[] = [];

      if (criteria === 'Unit') {
        const units = await unitService.getUnits();

        options = units
          .filter(unit =>
            unit.isActive &&
            allowedCodes.has(normalizeCode(unit.unitCode))
          )
          .map(unit => ({
            key: normalizeCode(unit.unitCode),
            value: normalizeCode(unit.unitCode),
            text: `${unit.unitName} (${unit.unitCode})`
          }));
      } else {
        const targets =
          await targetService.getTargetsByCompany(companyId);

        const unique = new Map<string, ILookupOption>();

        targets
          .filter(target =>
            target.targetType === 'Salesperson' &&
            allowedCodes.has(normalizeCode(target.unitCode))
          )
          .forEach(target => {
            const code = normalizeCode(target.targetCode);

            if (code && !unique.has(code)) {
              unique.set(code, {
                key: code,
                value: code,
                text: `${target.targetName || code} (${code})`
              });
            }
          });

        options = Array.from(unique.values());
      }

      if (active) {
        setLookupOptions(
          options.sort((a, b) => a.text.localeCompare(b.text))
        );
      }
    } catch (loadError) {
      if (active) {
        setLookupError(getUserFriendlyError(loadError));
      }
    } finally {
      if (active) {
        setLookupLoading(false);
      }
    }
  };

  void loadOptions();

  return () => { active = false; };
}, [
  selectedCompanyId,
  appUserId,
  criteria,
  unitAccess,
  unitService,
  targetService
]);


    React.useEffect(() => {
      setAppliedSelection(undefined);
      setReportTargets([]);
      setReportVerticals([]);
      setReportTotals([]);
      setBusinessBreakdown(undefined);
      setError(undefined);
      setLoading(false);

      return () => {
        reportRequestId.current += 1;
      };
    }, [selectedCompanyId]);

    const yearOptions = React.useMemo(
      () => getCollectionReportYearOptions(
        [
          currentYear - 2,
          currentYear - 1,
          currentYear
        ],
        currentYear
      ),
      [currentYear]
    );


    const selectorOptions = React.useMemo<readonly ILookupOption[]>(
    () =>
      unitAccess &&
      unitAccess.companyId === selectedCompanyId &&
      unitAccess.appUserId === appUserId
        ? [
            {
              key: '__ALL__',
              value: '__ALL__',
              text: criteria === 'Unit'
                ? 'All permitted units'
                : 'All permitted salespersons'
            },
            ...lookupOptions
          ]
        : [],
    [criteria, lookupOptions, unitAccess, selectedCompanyId, appUserId]
  );

    const handleSubmit = React.useCallback(
      async (): Promise<void> => {
        if (!previewPeriod) {
          setError('Enter a valid positive whole number of months within the supported date range.');
          return;
        }

        if (
          !selectedCompanyId ||
          !appUserId ||
          !Number.isSafeInteger(appUserId) ||
          appUserId <= 0
        ) {
          setError('Unable to verify your Unit permissions.');
          return;
        }

        const requestId = ++reportRequestId.current;
        const selection: IReportSelection = {
          month,
          year,
          criteria,
          periodicity: parsedPeriodicity,
          periodLabel: previewPeriod.label,
          companyId: selectedCompanyId
        };

        setAppliedSelection(selection);
        setReportTargets([]);
        setReportVerticals([]);
        setReportTotals([]);
        setBusinessBreakdown(undefined);
        setError(undefined);
        setLoading(true);

        try {
          // Recheck permissions before loading report data.
          const [assignedIds, units] = await Promise.all([
            unitAccessService.getAssignedUnitIds(
              appUserId,
              selectedCompanyId
            ),
            unitService.getUnits()
          ]);

          if (requestId !== reportRequestId.current) {
            return;
          }

          const assignedSet = new Set<number>(assignedIds);

          const allowedUnitCodes = new Set<string>(
            units
              .filter(unit => unit.isActive && assignedSet.has(unit.id))
              .map(unit => normalizeCode(unit.unitCode))
              .filter(code => code.length > 0)
          );

          if (allowedUnitCodes.size === 0) {
            throw new Error('No active Units assigned to you for this company.');
          }

          const allSelected =
            selectedCodes.indexOf('__ALL__') !== -1;

          const selectedCodeSet = new Set<string>(
            selectedCodes
              .filter(code => code !== '__ALL__')
              .map(normalizeCode)
          );

          if (!allSelected && selectedCodeSet.size === 0) {
            throw new Error('Select at least one Unit or Salesperson.');
          }

          const [targets, verticals, totals] = await Promise.all([
            selectedCompanyId === undefined
              ? targetService.getTargets()
              : targetService.getTargetsByCompany(selectedCompanyId),
            selectedCompanyId === undefined
              ? verticalService.getVerticals()
              : verticalService.getVerticalsByCompany(selectedCompanyId),
            selectedCompanyId !== undefined && businessReportApiService
              ? businessReportApiService.getBusinessReportTotals({
                  companyId: selectedCompanyId,
                  month: Number(selection.month),
                  year: Number(selection.year),
                  targetType: selection.criteria,
                  periodicity: selection.periodicity,
                  groupByBranch: true
                })
              : Promise.resolve([] as readonly IBusinessReportTotal[])
          ]);

          if (requestId !== reportRequestId.current) {
            return;
          }

          const selectedPeriod = getCollectionReportPeriod(
            Number(selection.month),
            Number(selection.year),
            selection.periodicity
          );
          const startMonthIndex =
            (selectedPeriod.startYear - 1) * 12 + selectedPeriod.startMonth - 1;
          const endMonthIndex =
            (selectedPeriod.endYear - 1) * 12 + selectedPeriod.endMonth - 1;

            // Exclude the Collection vertical from the Business Report.
            // Collection reporting is handled by a separate module.
            const collectionVerticalIds = new Set<number>(
              verticals
                .filter(vertical =>
                  vertical.verticalName.trim().toLowerCase() === 'collection'
                )
                .map(vertical => vertical.id)
            );

          const filteredTargets = aggregatePeriodTargets(targets.filter(item => {
            const targetMonthIndex = (item.targetYear - 1) * 12 + item.targetMonth - 1;
              return (selectedCompanyId === undefined ||
                  item.companyId === selectedCompanyId) &&
                !collectionVerticalIds.has(item.verticalId) &&
                item.targetType === selection.criteria &&
                allowedUnitCodes.has(
                  selection.criteria === 'Unit'
                    ? normalizeCode(item.targetCode)
                    : normalizeCode(item.unitCode)
                ) &&
                (
                  allSelected ||
                  selectedCodeSet.has(normalizeCode(item.targetCode))
                ) &&
                Number.isInteger(item.targetMonth) &&
              item.targetMonth >= 1 && item.targetMonth <= 12 &&
              targetMonthIndex >= startMonthIndex &&
              targetMonthIndex <= endMonthIndex;
          }));

          const companyIds = new Set(
            filteredTargets.map(item => item.companyId)
          );

          // Require branch-specific data. Never silently use
          // company-wide salesperson totals for Unit Access.
          if (totals.some(item => !normalizeCode(item.branchCode || ''))) {
            throw new Error(
              'Business Report API did not return branch-specific data.'
            );
          }

          // Include only target codes visible in this report.
          const visibleTargetCodes = new Set<string>(
            filteredTargets.map(item => normalizeCode(item.targetCode))
          );

          // Keep Business values only from the user's permitted
          // Units and from the filtered report targets.
          const scopedTotals: readonly IBusinessReportTotal[] =
            totals.filter(item =>
              item.targetType === selection.criteria &&
              allowedUnitCodes.has(normalizeCode(item.branchCode || '')) &&
              visibleTargetCodes.has(normalizeCode(item.targetCode))
            );

          const referencedVerticalIds = new Set(
            filteredTargets.map(item => item.verticalId)
          );

          // Retain active verticals belonging to the reporting
          // company and inactive verticals referenced by its targets.
          // When no company is selected (transitional legacy mode),
          // preserve the report's existing multi-company behavior.
          const applicableVerticals = verticals.filter(
            vertical =>
              !collectionVerticalIds.has(vertical.id) &&
              (selectedCompanyId === undefined ||
                vertical.companyId === selectedCompanyId) &&
              companyIds.has(vertical.companyId) &&
              (
                vertical.isActive ||
                referencedVerticalIds.has(vertical.id)
              )
          );

          const matchedVerticalIds = new Set(
            applicableVerticals.map(vertical => vertical.id)
          );

          // Do not silently hide targets whose vertical
          // reference is missing or belongs to another company.
          const missingVerticals = new Map<
            number,
            IVerticalListItem
          >();

          for (const target of filteredTargets) {
            if (!matchedVerticalIds.has(target.verticalId)) {
              missingVerticals.set(target.verticalId, {
                id: target.verticalId,
                companyId: target.companyId,
                verticalName:
                  `Unknown Vertical (ID ${target.verticalId})`,
                isActive: false,
                verticalUniqueKey: ''
              });
            }
          }

          const sortedVerticals = [
            ...applicableVerticals,
            ...Array.from(missingVerticals.values())
          ].sort(
            (first, second) =>
              first.verticalName.localeCompare(
                second.verticalName,
                undefined,
                { sensitivity: 'base' }
              ) ||
              first.companyId.localeCompare(second.companyId)
          );

          // Validate every displayed target/vertical combination once.
          // Mixed currencies must be reported as an error, not added.
          for (const target of filteredTargets) {
            const vertical = sortedVerticals.find(item =>
              item.id === target.verticalId &&
              item.companyId === target.companyId
            );
            if (vertical && businessReportApiService) {
              getBusinessReportCell(
                target,
                vertical,
                scopedTotals,
                Array.from(allowedUnitCodes)
              );
            }
          }

          if (requestId === reportRequestId.current) {
            setReportTargets(filteredTargets);
            setReportVerticals(sortedVerticals);
            setReportTotals(scopedTotals);
          }
        } catch (loadError) {
          if (requestId === reportRequestId.current) {
            setReportTargets([]);
            setReportVerticals([]);
            setReportTotals([]);
            setError(getUserFriendlyError(loadError));
          }
        } finally {
          if (requestId === reportRequestId.current) {
            setLoading(false);
          }
        }
      },
      [month, year, criteria, parsedPeriodicity, previewPeriod, targetService, verticalService, businessReportApiService, selectedCompanyId, unitAccessService, unitService, appUserId, selectedCodes]
    );

    const reportRows = React.useMemo(
      () => buildReportRows(
        selectedCompanyId === undefined
          ? reportTargets
          : reportTargets.filter(
              item => item.companyId === selectedCompanyId
            )
      ),
      [reportTargets, selectedCompanyId]
    );

    // Display only verticals with an assigned target in this report.
    // Keep other employees' empty cells in the desktop comparison table.
    const displayVerticals = React.useMemo(
      () => reportVerticals.filter(vertical =>
        reportRows.some(row =>
          row.companyId === vertical.companyId &&
          row.targetsByVertical.has(vertical.id)
        )
      ),
      [reportVerticals, reportRows]
    );

    // Never show a report generated for the previous company.
    const visibleSelection =
      appliedSelection?.companyId === selectedCompanyId
        ? appliedSelection
        : undefined;

    // Size the identity column to the report's longest name, within compact
    // limits. Long names can wrap rather than forcing horizontal scrolling.
    const longestNameLength = reportRows.reduce(
      (maxLength, row) => Math.max(maxLength, row.name.trim().length),
      0
    );
    const isSalespersonReport = visibleSelection?.criteria === 'Salesperson';
    const identityColumnWidth = Math.min(
      isSalespersonReport ? 250 : 205,
      Math.max(
        isSalespersonReport ? 180 : 150,
        Math.ceil(longestNameLength * 7.4 + 28)
      )
    );
    const tableWidth =
      numberColumnWidth + identityColumnWidth +
      displayVerticals.length * verticalGroupWidth;


    const getVerticalHeader = (
      vertical: IVerticalListItem
    ): React.ReactNode => {
      const duplicateNameCount = displayVerticals.filter(
        item =>
          item.verticalName.trim().toLowerCase() ===
          vertical.verticalName.trim().toLowerCase()
      ).length;

      return (
        <>
          <span>{vertical.verticalName}</span>

          {duplicateNameCount > 1 ? (
            <div
              style={{
                fontSize: 11,
                fontWeight: 400,
                marginTop: 4,
                whiteSpace: 'normal',
                overflowWrap: 'anywhere'
              }}
            >
            Company: {getCompanyDisplayName(vertical.companyId)}
            </div>
          ) : null}
        </>
      );
    };

    return (
      <PageContainer
        title={collectionReportModuleConfig.title}
        description={collectionReportModuleConfig.description}
      >
        <div className={styles.reportLayout}>
          <section className={styles.filterPanel} aria-label="Report filters">
            <div className={styles.filterIntro}>
              <div>
                <h3 className={styles.filterTitle}>Report filters</h3>
                <p className={styles.filterDescription}>
                  Choose a reporting period and view performance by unit or salesperson.
                </p>
              </div>
            </div>
            <div className={styles.filterGrid}>
              <Dropdown
                label="Month"
                value={month}
                options={collectionReportMonthOptions}
                required
                onChange={value => {
                  if (typeof value === 'string') {
                    setMonth(value);
                  }
                }}
              />

              <Dropdown
                label="Year"
                value={year}
                options={yearOptions}
                required
                onChange={value => {
                  if (typeof value === 'string') {
                    setYear(value);
                  }
                }}
              />

              <Dropdown
                label="Criteria"
                value={criteria}
                options={collectionReportCriteriaOptions}
                required
                onChange={value => {
                  if (value === 'Unit' || value === 'Salesperson') {
                    setCriteria(value);
                  }
                }}
              />

              <Dropdown
                key={`${selectedCompanyId}:${criteria}`}
                label={criteria === 'Unit' ? 'Units' : 'Salespersons'}
                values={selectedCodes}
                options={selectorOptions}
                multiSelect
                searchable
                loading={lookupLoading}
                placeholder={
                  criteria === 'Unit'
                    ? 'Search and select units'
                    : 'Search and select salespersons'
                }
                disabled={
                  lookupLoading ||
                  unitAccessLoading ||
                  !unitAccess ||
                  Boolean(unitAccessError)
                }
                onChange={value => {
                  const next = Array.isArray(value)
                    ? value.filter(
                        (code): code is string => typeof code === 'string'
                      )
                    : [];

                  if (
                    next.indexOf('__ALL__') !== -1 &&
                    selectedCodes.indexOf('__ALL__') === -1
                  ) {
                    setSelectedCodes(['__ALL__']);
                    return;
                  }

                  const specificCodes = next.filter(
                    code => code !== '__ALL__'
                  );

                  setSelectedCodes(
                    specificCodes.length > 0
                      ? specificCodes
                      : ['__ALL__']
                  );
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label htmlFor="business-report-periodicity" style={{ fontWeight: 600, fontSize: 13 }}>
                  Periodicity (months) <span aria-hidden="true">*</span>
                </label>
                <input
                  id="business-report-periodicity"
                  aria-label="Periodicity in months"
                  aria-invalid={!previewPeriod}
                  type="number"
                  min={1}
                  step={1}
                  value={periodicity}
                  onChange={event => setPeriodicity(event.currentTarget.value)}
                  style={{ minHeight: 38, padding: '8px 10px', border: '1px solid #a5a5a5', borderRadius: 5, width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              <div className={styles.submitControl}>
                <Button
                  label="Submit"
                  variant="primary"
                  loading={loading}
                  disabled={false}
                  onClick={() => {
                    handleSubmit().catch(() => undefined);
                  }}
                />
              </div>
            </div>
            <p aria-live="polite" style={{ margin: '12px 0 0', fontSize: 13 }}>
              {previewPeriod
                ? `Reporting period: ${previewPeriod.label} (${parsedPeriodicity} ${parsedPeriodicity === 1 ? 'month' : 'months'})`
                : 'Enter a valid positive whole number of months within the supported date range.'}
            </p>
          </section>

          {visibleSelection ? (
            <section className={styles.reportView} aria-label="Business report results">
              <div className={styles.reportHeader}>
                <div>
                  <p className={styles.reportEyebrow}>PERFORMANCE OVERVIEW</p>
                  <h3 className={styles.reportTitle}>
                    {visibleSelection.criteria} Business Report
                  </h3>
                  <p className={styles.reportPeriod}>
                    Performance against aggregated targets, grouped by business vertical.
                  </p>
                </div>
                <div className={styles.periodBadge}>
                  {visibleSelection.periodLabel} ({visibleSelection.periodicity} {visibleSelection.periodicity === 1 ? 'month' : 'months'})
                </div>
              </div>

              {!loading && !error && reportRows.length > 0 ? (
                <div className={styles.overviewGrid} aria-label="Report overview">
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>
                      {visibleSelection.criteria === 'Unit' ? 'Units' : 'Salespersons'}
                    </span>
                    <strong className={styles.overviewValue}>{reportRows.length}</strong>
                  </div>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Verticals with targets</span>
                    <strong className={styles.overviewValue}>{displayVerticals.length}</strong>
                  </div>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Business data</span>
                    <strong className={styles.overviewText}>
                      {businessReportApiService ? 'Business Central' : 'Not connected'}
                    </strong>
                  </div>
                </div>
              ) : null}

              <div className={styles.reportNotice} role="note">
                <span className={styles.noticeMarker} aria-hidden="true">i</span>
                <span>
                  Vertical names and targets for the selected reporting period are retrieved from SharePoint.
                  {businessReportApiService
                    ? ' Final Business uses Business Central posted invoice lines plus signed posted credit memo lines (local demo only).'
                    : ' Business values and achievement percentages are pending API connection.'}
                </span>
              </div>

              {loading ? (
                <div className={styles.reportState} role="status">
                  Loading targets, verticals and Business amounts...
                </div>
              ) : error ? (
                <div
                  className={`${styles.reportState} ${styles.reportError}`}
                  role="alert"
                >
                  {error}
                </div>
              ) : reportRows.length === 0 ? (
                <div className={styles.reportState}>
                  No targets found for the selected reporting period and Criteria.
                </div>
              ) : (
                <>
                  <div className={styles.tableShell}>
                    <div className={styles.tableToolbar}>
                      <div className={styles.tableToolbarTitle}>
                        Detailed performance
                        <span className={styles.tableRowCount}>{reportRows.length} rows</span>
                      </div>
                      {displayVerticals.length > 3 ? (
                        <span className={styles.scrollHint}>
                          Scroll horizontally for more verticals ↔
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={styles.tableScroll}
                      tabIndex={0}
                      role="region"
                      aria-label="Scroll business report table horizontally"
                    >
                      <table
                        className={styles.reportTable}
                        style={{ minWidth: tableWidth }}
                      >
                        <caption className={styles.srOnly}>
                          {visibleSelection.criteria} Business Report for {visibleSelection.periodLabel}
                        </caption>
                        <colgroup>
                          <col style={{ width: numberColumnWidth }} />
                          <col style={{ width: identityColumnWidth }} />
                          {displayVerticals.map(vertical => (
                            <React.Fragment key={vertical.id}>
                              <col style={{ width: targetColumnWidth }} />
                              <col style={{ width: businessColumnWidth }} />
                              <col style={{ width: percentageColumnWidth }} />
                            </React.Fragment>
                          ))}
                        </colgroup>

                        <thead>
                          <tr>
                            <th
                              className={styles.stickyNumber}
                              rowSpan={2}
                              scope="col"
                            >
                              No.
                            </th>
                            <th
                              className={styles.stickyIdentity}
                              rowSpan={2}
                              scope="col"
                            >
                              {visibleSelection.criteria}
                            </th>
                            {displayVerticals.map(vertical => (
                              <th
                                className={styles.verticalHeader}
                                colSpan={3}
                                key={vertical.id}
                                scope="colgroup"
                              >
                                {getVerticalHeader(vertical)}
                              </th>
                            ))}
                          </tr>
                          <tr>
                            {displayVerticals.map(vertical => (
                              <React.Fragment key={vertical.id}>
                                <th className={styles.metricHeader} scope="col">
                                  Target
                                </th>
                                <th className={`${styles.metricHeader} ${styles.businessHeading}`} scope="col">
                                  Business
                                </th>
                                <th className={styles.metricHeader} scope="col">
                                  %
                                </th>
                              </React.Fragment>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {reportRows.map((row, index) => (
                            <tr key={row.key}>
                              <td className={styles.stickyNumber}>
                                {index + 1}
                              </td>
                              <td className={styles.stickyIdentity}>
                                <div className={styles.identityName}>
                                  {row.name}
                                </div>
                                <div className={styles.identityCode}>
                                  Code: {row.code}
                                </div>
                                {selectedCompanyId === undefined ? (
                                  <div className={styles.identityCode}>
                                    Company: {getCompanyDisplayName(row.companyId)}
                                  </div>
                                ) : null}
                              </td>
                              {displayVerticals.map(vertical => {
                                const target =
                                  row.companyId === vertical.companyId
                                    ? row.targetsByVertical.get(vertical.id)
                                    : undefined;
                                const businessCell = target && businessReportApiService
                                  ? getBusinessReportCell(target, vertical, reportTotals)
                                  : undefined;

                                return (
                                  <React.Fragment key={vertical.id}>
                                    <td className={styles.metricCell}>
                                      {target ? (
                                        <>
                                          <AmountDisplay amount={target.targetAmount} />
                                          {!target.isActive ? (
                                            <div className={styles.inactiveLabel}>
                                              Inactive
                                            </div>
                                          ) : null}
                                        </>
                                      ) : (
                                        <span className={styles.fallback}>—</span>
                                      )}
                                    </td>
                                    <td className={`${styles.metricCell} ${styles.businessCell}`}>
                                      {businessCell?.businessAmount !== undefined
                                        ? (
                                          <button
                                            type="button"
                                            onClick={() => openBusinessBreakdown(row, vertical, businessCell)}
                                            aria-label={`View business breakdown for ${row.name}, ${vertical.verticalName}`}
                                            title="View Original Business, Credit Memo and Final Business"
                                            style={{
                                              background: 'transparent',
                                              border: 0,
                                              padding: 0,
                                              color: 'inherit',
                                              font: 'inherit',
                                              cursor: 'pointer',
                                              textDecoration: 'underline',
                                              textUnderlineOffset: 3
                                            }}
                                          >
                                            <AmountDisplay amount={businessCell.businessAmount} />
                                          </button>
                                        )
                                        : <span className={styles.fallback}>—</span>}
                                    </td>
                                    <td className={styles.metricCell}>
                                      {renderAchievement(businessCell?.achievementPercentage)}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className={styles.mobileList}>
                    {reportRows.map((row, index) => (
                      <article className={styles.mobileCard} key={row.key}>
                        <div className={styles.mobileCardHeader}>
                          <div className={styles.mobileCardName}>
                            {row.name}
                          </div>
                          <div className={styles.mobileCardCode}>
                            No. {index + 1} · Code: {row.code}
                          </div>
                          {selectedCompanyId === undefined ? (
                            <div className={styles.mobileCardCode}>
                              Company: {getCompanyDisplayName(row.companyId)}
                            </div>
                          ) : null}
                        </div>

                        {displayVerticals
                          .filter(vertical =>
                            row.companyId === vertical.companyId &&
                            row.targetsByVertical.has(vertical.id)
                          )
                          .map(vertical => {
                            const target =
                              row.companyId === vertical.companyId
                                ? row.targetsByVertical.get(vertical.id)
                                : undefined;
                            const businessCell = target && businessReportApiService
                              ? getBusinessReportCell(target, vertical, reportTotals)
                              : undefined;

                          return (
                            <div className={styles.mobileVertical} key={vertical.id}>
                              <div className={styles.mobileVerticalTitle}>
                                {getVerticalHeader(vertical)}
                              </div>
                              <div className={styles.mobileMetrics}>
                                <div className={styles.mobileMetric}>
                                  <span className={styles.mobileMetricLabel}>
                                    Target
                                  </span>
                                  <div className={styles.mobileMetricValue}>
                                    {target ? (
                                      <>
                                        <AmountDisplay amount={target.targetAmount} />
                                        {!target.isActive ? (
                                          <div className={styles.inactiveLabel}>
                                            Inactive
                                          </div>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className={styles.fallback}>—</span>
                                    )}
                                  </div>
                                </div>
                                <div className={styles.mobileMetric}>
                                  <span className={styles.mobileMetricLabel}>
                                    Business
                                  </span>
                                  <div className={styles.mobileMetricValue}>
                                    {businessCell?.businessAmount !== undefined
                                      ? (
                                          <button
                                            type="button"
                                            onClick={() => openBusinessBreakdown(row, vertical, businessCell)}
                                            aria-label={`View business breakdown for ${row.name}, ${vertical.verticalName}`}
                                            title="View Original Business, Credit Memo and Final Business"
                                            style={{
                                              background: 'transparent',
                                              border: 0,
                                              padding: 0,
                                              color: 'inherit',
                                              font: 'inherit',
                                              cursor: 'pointer',
                                              textDecoration: 'underline',
                                              textUnderlineOffset: 3
                                            }}
                                          >
                                            <AmountDisplay amount={businessCell.businessAmount} />
                                          </button>
                                        )
                                      : <span className={styles.fallback}>—</span>}
                                  </div>
                                </div>
                                <div className={styles.mobileMetric}>
                                  <span className={styles.mobileMetricLabel}>
                                    %
                                  </span>
                                  <div className={styles.mobileMetricValue}>
                                    {renderAchievement(businessCell?.achievementPercentage)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          ) : (
            <div className={styles.emptyPrompt}>
              <span className={styles.emptyPromptSymbol} aria-hidden="true">▤</span>
              <strong>Ready to view performance?</strong>
              <span>Select Month, Year, Periodicity and Criteria, then click Submit to generate the Business Report.</span>
            </div>
          )}
          <BusinessBreakdownModal
            isOpen={businessBreakdown !== undefined}
            name={businessBreakdown?.name || ''}
            code={businessBreakdown?.code || ''}
            verticalName={businessBreakdown?.verticalName || ''}
            cell={businessBreakdown?.cell}
            onDismiss={() => setBusinessBreakdown(undefined)}
          />
        </div>
      </PageContainer>
    );
  };