import * as React from 'react';
import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { Button } from '../../../../../shared/components/buttons/Button';
import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';
import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import { InputField } from '../../../../../shared/components/inputs/InputField';
import { collectionVerticalReportModuleConfig } from '../../../config/modules/collectionVerticalReportModuleConfig';
import { collectionReportMonthOptions, collectionReportCriteriaOptions, getCollectionReportYearOptions } from '../../../config/modules/collectionReportFilterConfig';
import type { CollectionReportCriteria } from '../../../config/modules/collectionReportFilterConfig';
import type { IVerticalListItem } from '../../../models/verticals';
import type { TargetService } from '../../../services/targets/targetService';
import type { VerticalService } from '../../../services/verticals/verticalService';
import type { UnitService } from '../../../services/units/unitService';
import type { BusinessPerformanceUnitAccessService } from '../../../services/access/businessPerformanceUnitAccessService';
import type { ISalespersonLookupItem } from '../../../../bc-extension/services/salespersons/salespersonService';
import type { CollectionVerticalReportApiService } from '../../../services/businessReport/collectionVerticalReportApiService';
import type { ICollectionReportTotal } from '../../../services/businessReport/collectionVerticalReportApiService';
import styles from './CollectionVerticalReportPage.module.scss';
export interface ICollectionVerticalReportPageProps {
    targetService: TargetService;
    verticalService: VerticalService;
    unitService: UnitService;
    // The signed-in App User, resolved by the existing authorization gate.
    appUserId?: number;
    unitAccessService: BusinessPerformanceUnitAccessService;
    loadSalespersons: (companyId: string, searchText?: string) => Promise<readonly ISalespersonLookupItem[]>;
    collectionVerticalReportApiService?: CollectionVerticalReportApiService;
    selectedCompanyId?: string;
}
interface IReportSelection {
    companyId: string;
    month: string;
    year: string;
    periodicity: number;
    criteria: CollectionReportCriteria;
    selectedCodes: readonly string[];
    selectedName: string;
    periodLabel: string;
}
interface IAllowedUnitAccess {
    companyId: string;
    appUserId: number;
    unitCodes: readonly string[];
}
interface IPeriodMonth {
    month: number;
    year: number;
}
interface IReportRow {
    key: string;
    code: string;
    name: string;
    companyId: string;
    targetAmount: number;
    businessAmount?: number;
    achievementPercentage?: number;
}
interface IReportRowBuilder {
    key: string;
    code: string;
    name: string;
    companyId: string;
    targetAmount: number;
    // A salesperson can have monthly targets in several permitted units.
    // Keep the branch set so period totals are counted only once per branch.
    branchCodes: Set<string>;
}
const numberColumnWidth = 44;
const targetColumnWidth = 116;
const businessColumnWidth = 122;
const percentageColumnWidth = 72;
const collectionVerticalName = 'collection';
const allOptionValue = '\_\_ALL\_\_';
const normalizeCode = (code: string): string => code.trim().toUpperCase();
// SharePoint assignment IDs must resolve to active Unit Master codes.
// Missing, inactive, or code-less units never grant report access.
const getAuthorizedUnitCodes = (assignedUnitIds: readonly number[], units: readonly {
    id: number;
    unitCode?: string;
    isActive: boolean;
}[]): readonly string[] => {
    const assignedIdSet = new Set<number>(assignedUnitIds);
    const codes = units
        .filter(unit => assignedIdSet.has(unit.id) && unit.isActive === true)
        .map(unit => normalizeCode(unit.unitCode || ''))
        .filter(code => code.length > 0);
    return Array.from(new Set<string>(codes));
};
const getMonthName = (month: number): string => collectionReportMonthOptions.find(item => Number(item.value) === month)?.text || String(month);
// Periodicity N = selected month + previous N-1 months.
const getPeriodMonths = (month: number, year: number, count: number): readonly IPeriodMonth[] => {
    if (!Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        !Number.isInteger(year) ||
        year < 1 ||
        year > 9999 ||
        !Number.isInteger(count) ||
        count < 1 ||
        count > 24) {
        throw new Error('Invalid month, year or periodicity.');
    }
    const endMonthIndex = (year - 1) * 12 + (month - 1);
    if (endMonthIndex - count + 1 < 0 ||
        endMonthIndex >= 9999 * 12 - 1) {
        throw new Error('Periodicity is outside the supported date range.');
    }
    const result: IPeriodMonth[] = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const index = endMonthIndex - offset;
        result.push({
            year: Math.floor(index / 12) + 1,
            month: index % 12 + 1
        });
    }
    return result;
};
const monthKey = (month: number, year: number): string => `${year}-${month < 10 ? '0' : ''}${month}`;
const getPeriodLabel = (months: readonly IPeriodMonth[]): string => {
    const start = months[0];
    const end = months[months.length - 1];
    if (!start || !end) {
        return '';
    }
    const first = `${getMonthName(start.month)} ${start.year}`;
    const last = `${getMonthName(end.month)} ${end.year}`;
    return months.length === 1
        ? first
        : `${first} – ${last}`;
};
const isCollectionVertical = (vertical: IVerticalListItem): boolean => vertical.verticalName
    .trim()
    .toLowerCase() === collectionVerticalName;
const renderAchievement = (percentage: number | undefined): React.ReactNode => percentage !== undefined &&
    Number.isFinite(percentage)
    ? (<span className={styles.achievementValue}>
        {percentage.toFixed(1)}%
      </span>)
    : (<span className={styles.fallback}>
        —
      </span>);
const makeOption = (code: string, name: string): ILookupOption => ({
    key: normalizeCode(code),
    value: code,
    text: `${name} (${code})`
});
export const CollectionVerticalReportPage: React.FC<ICollectionVerticalReportPageProps> = ({ targetService, verticalService, unitService, appUserId, unitAccessService, loadSalespersons, collectionVerticalReportApiService, selectedCompanyId }) => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const [month, setMonth] = React.useState<string>(String(today.getMonth() + 1));
    const [year, setYear] = React.useState<string>(String(currentYear));
    const [periodicity, setPeriodicity] = React.useState<string>('1');
    const [criteria, setCriteria] = React.useState<CollectionReportCriteria>('Salesperson');
    // Multiple selected unit/salesperson codes.
    const [selectedCodes, setSelectedCodes] = React.useState<readonly string[]>([
        allOptionValue
    ]);
    const [lookupOptions, setLookupOptions] = React.useState<readonly ILookupOption[]>([]);
    const [lookupLoading, setLookupLoading] = React.useState<boolean>(false);
    const [lookupError, setLookupError] = React.useState<string | undefined>();
    const [appliedSelection, setAppliedSelection] = React.useState<IReportSelection | undefined>();
    const [reportRows, setReportRows] = React.useState<readonly IReportRow[]>([]);
    const [loading, setLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | undefined>();
    const reportRequestId = React.useRef(0);
    const [unitAccess, setUnitAccess] = React.useState<IAllowedUnitAccess | undefined>();
    const [unitAccessLoading, setUnitAccessLoading] = React.useState<boolean>(true);
    const [unitAccessError, setUnitAccessError] = React.useState<string | undefined>();
    // Resolve Unit Access for the signed-in user and selected company.
    // A missing assignment, invalid identity, or lookup failure denies access.
    React.useEffect(() => {
        let active = true;
        setUnitAccess(undefined);
        setUnitAccessError(undefined);
        setUnitAccessLoading(true);
        setLookupOptions([]);
        setSelectedCodes([allOptionValue]);
        reportRequestId.current += 1;
        setAppliedSelection(undefined);
        setReportRows([]);
        setError(undefined);
        setLoading(false);
        if (!selectedCompanyId || !appUserId ||
            !Number.isSafeInteger(appUserId) || appUserId <= 0) {
            setUnitAccessError('Unable to verify Collection Report unit permissions.');
            setUnitAccessLoading(false);
            return () => { active = false; };
        }
        const loadUnitAccess = async (): Promise<void> => {
            try {
                const [assignedIds, units] = await Promise.all([
                    unitAccessService.getAssignedUnitIds(appUserId, selectedCompanyId),
                    unitService.getUnits()
                ]);
                if (!active) {
                    return;
                }
                const unitCodes = getAuthorizedUnitCodes(assignedIds, units);
                if (unitCodes.length === 0) {
                    setUnitAccessError('No active units are assigned to you for this company. Contact the administrator.');
                }
                else {
                    setUnitAccess({ companyId: selectedCompanyId, appUserId, unitCodes });
                }
            }
            catch (loadFailure) {
                if (active) {
                    setUnitAccessError('Unable to verify Collection Report unit permissions: ' +
                        getUserFriendlyError(loadFailure));
                }
            }
            finally {
                if (active) {
                    setUnitAccessLoading(false);
                }
            }
        };
        void loadUnitAccess();
        return () => { active = false; };
    }, [selectedCompanyId, appUserId, unitAccessService, unitService]);
    React.useEffect(() => {
        reportRequestId.current += 1;
        setAppliedSelection(undefined);
        setReportRows([]);
        setError(undefined);
        setLoading(false);
        setSelectedCodes([allOptionValue]);
        return () => {
            reportRequestId.current += 1;
        };
    }, [selectedCompanyId]);
    const yearOptions = React.useMemo(() => getCollectionReportYearOptions([
        currentYear - 2,
        currentYear - 1,
        currentYear
    ], currentYear), [currentYear]);
    // Load units or salespersons according to Criteria.
    React.useEffect(() => {
        let active = true;
        setLookupOptions([]);
        setLookupError(undefined);
        const verifiedAccess = unitAccess?.companyId === selectedCompanyId &&
            unitAccess?.appUserId === appUserId ? unitAccess : undefined;
        setLookupLoading(Boolean(selectedCompanyId) && Boolean(verifiedAccess));
        if (!selectedCompanyId || !verifiedAccess) {
            return () => {
                active = false;
            };
        }
        const loadOptions = async (): Promise<void> => {
            try {
                const companyTargets = await targetService.getTargetsByCompany(selectedCompanyId);
                if (!active) {
                    return;
                }
                const allowedCodes = new Set(verifiedAccess.unitCodes.map(normalizeCode));
                // Only users' assigned units may contribute filter choices.
                const permittedTargets = companyTargets.filter(item => item.targetType === criteria &&
                    (criteria === 'Unit'
                        ? allowedCodes.has(normalizeCode(item.targetCode))
                        : allowedCodes.has(normalizeCode(item.unitCode || ''))));
                const permittedSalespersonCodes = new Set(permittedTargets
                    .filter(item => item.targetType === 'Salesperson')
                    .map(item => normalizeCode(item.targetCode)));
                const optionsByCode = new Map<string, ILookupOption>();
                const add = (code: string, name: string): void => {
                    if (!code.trim()) {
                        return;
                    }
                    optionsByCode.set(normalizeCode(code), makeOption(code, name || code));
                };
                // Include codes configured in Target Master.
                permittedTargets.forEach(item => add(item.targetCode, item.targetName));
                try {
                    if (criteria === 'Unit') {
                        const units = await unitService.getUnits();
                        if (!active) {
                            return;
                        }
                        units
                            .filter(item => item.isActive &&
                            allowedCodes.has(normalizeCode(item.unitCode || '')))
                            .forEach(item => add(item.unitCode || '', item.unitName));
                    }
                    else {
                        const salespersons = await loadSalespersons(selectedCompanyId);
                        if (!active) {
                            return;
                        }
                        salespersons
                            .filter(item => permittedSalespersonCodes.has(normalizeCode(item.code)))
                            .forEach(item => add(item.code, item.name));
                    }
                }
                catch (lookupFailure) {
                    if (active) {
                        setLookupError(`Some ${criteria.toLowerCase()} options could not be loaded: ` +
                            getUserFriendlyError(lookupFailure));
                    }
                }
                if (active) {
                    setLookupOptions(Array.from(optionsByCode.values()).sort((first, second) => first.text.localeCompare(second.text)));
                }
            }
            catch (loadFailure) {
                if (active) {
                    setLookupError(getUserFriendlyError(loadFailure));
                    setLookupOptions([]);
                }
            }
            finally {
                if (active) {
                    setLookupLoading(false);
                }
            }
        };
        loadOptions().catch(() => undefined);
        return () => {
            active = false;
        };
    }, [
        selectedCompanyId,
        criteria,
        targetService,
        unitService,
        loadSalespersons,
        appUserId,
        unitAccess
    ]);
    const selectorOptions = React.useMemo<readonly ILookupOption[]>(() => unitAccess && unitAccess.companyId === selectedCompanyId
        ? [
            {
                key: allOptionValue,
                value: allOptionValue,
                text: criteria === 'Unit'
                    ? 'All permitted units'
                    : 'All permitted salespersons'
            },
            ...lookupOptions
        ]
        : [], [criteria, lookupOptions, unitAccess, selectedCompanyId]);
    const handleSubmit = React.useCallback(async (): Promise<void> => {
        const requestId = ++reportRequestId.current;
        setReportRows([]);
        setAppliedSelection(undefined);
        setError(undefined);
        setLoading(true);
        try {
            if (!selectedCompanyId) {
                throw new Error('Select a company to view the Collection Report.');
            }
            if (!appUserId || !Number.isSafeInteger(appUserId) || appUserId <= 0) {
                throw new Error('Unable to identify the current App User.');
            }
            // Recheck assignments at submission rather than trusting the dropdown.
            // Permission checks precede all report data requests.
            const [freshAssignedIds, allUnits] = await Promise.all([
                unitAccessService.getAssignedUnitIds(appUserId, selectedCompanyId),
                unitService.getUnits()
            ]);
            if (requestId !== reportRequestId.current) {
                return;
            }
            const freshAllowedCodes = getAuthorizedUnitCodes(freshAssignedIds, allUnits);
            if (freshAllowedCodes.length === 0) {
                setUnitAccess(undefined);
                setUnitAccessError('No active units are assigned to you for this company.');
                throw new Error('No active units assigned for this company.');
            }
            setUnitAccess({
                companyId: selectedCompanyId,
                appUserId,
                unitCodes: freshAllowedCodes
            });
            setUnitAccessError(undefined);
            const allowedUnitCodeSet = new Set(freshAllowedCodes.map(normalizeCode));
            const months = getPeriodMonths(Number(month), Number(year), Number(periodicity));
            // Determine All or specific selections.
            const allSelected = selectedCodes.indexOf(allOptionValue) !== -1;
            const selectedCodeSet = new Set(selectedCodes
                .filter(code => code !== allOptionValue)
                .map(normalizeCode));
            const selectedName = allSelected
                ? (criteria === 'Unit'
                    ? 'All permitted units'
                    : 'All permitted salespersons')
                : selectedCodes.length === 1
                    ? (selectorOptions.find(option => option.value === selectedCodes[0])?.text || selectedCodes[0])
                    : `${selectedCodes.length} ${criteria === 'Unit'
                        ? 'units'
                        : 'salespersons'} selected`;
            const selection: IReportSelection = {
                companyId: selectedCompanyId,
                month,
                year,
                periodicity: Number(periodicity),
                criteria,
                selectedCodes: selectedCodes.slice(),
                selectedName,
                periodLabel: getPeriodLabel(months)
            };
            setAppliedSelection(selection);
            const [targets, verticals] = await Promise.all([
                targetService.getTargetsByCompany(selectedCompanyId),
                verticalService.getVerticalsByCompany(selectedCompanyId)
            ]);
            if (requestId !== reportRequestId.current) {
                return;
            }
            const collectionVerticals = verticals.filter(item => item.companyId === selectedCompanyId &&
                isCollectionVertical(item));
            if (collectionVerticals.length !== 1) {
                throw new Error(collectionVerticals.length === 0
                    ? 'Collection vertical is not configured for the selected company.'
                    : 'Multiple Collection verticals found for the selected company.');
            }
            const collectionVertical = collectionVerticals[0];
            const selectedMonths = new Set(months.map(item => monthKey(item.month, item.year)));
            // Filter Target Master by selected codes.
            const matchingTargets = targets.filter(item => item.companyId === selectedCompanyId &&
                item.verticalId === collectionVertical.id &&
                item.targetType === criteria &&
                // Unit targets use targetCode, salesperson targets use unitCode.
                (criteria === 'Unit'
                    ? allowedUnitCodeSet.has(normalizeCode(item.targetCode))
                    : allowedUnitCodeSet.has(normalizeCode(item.unitCode || ''))) &&
                selectedMonths.has(monthKey(item.targetMonth, item.targetYear)) &&
                (allSelected ||
                    selectedCodeSet.has(normalizeCode(item.targetCode))));
            // Prevent duplicate monthly target counting.
            const uniqueTargets = new Set<string>();
            for (const target of matchingTargets) {
                // A salesperson may have distinct monthly targets in two units.
                const key = JSON.stringify([
                    normalizeCode(target.targetCode),
                    criteria === 'Salesperson'
                        ? normalizeCode(target.unitCode || '')
                        : '',
                    target.targetYear,
                    target.targetMonth
                ]);
                if (uniqueTargets.has(key)) {
                    throw new Error(`Duplicate Collection targets found for ${target.targetCode}.`);
                }
                uniqueTargets.add(key);
            }
            // Targets are monthly, but the Collection API now aggregates the
            // complete requested period. Make exactly one API call, not one
            // call for each month with a configured target.
            let collectionTotals: readonly ICollectionReportTotal[] | undefined;
            if (collectionVerticalReportApiService && matchingTargets.length > 0) {
                collectionTotals = await collectionVerticalReportApiService
                    .getCollectionReportTotals({
                        companyId: selectedCompanyId,
                        month: Number(month),
                        year: Number(year),
                        targetType: criteria,
                        periodicity: Number(periodicity),
                        // Filter BC collection lines to branches represented by
                        // permitted SharePoint targets in the selected period.
                        branchCodes: Array.from(new Set<string>(
                            matchingTargets.map(item =>
                                normalizeCode(criteria === 'Unit'
                                    ? item.targetCode
                                    : item.unitCode || '')
                            ).filter(code => code.length > 0)
                        )),
                        ...(criteria === 'Salesperson'
                            ? {
                                salespersonCodes: Array.from(new Set<string>(
                                    matchingTargets.map(item =>
                                        normalizeCode(item.targetCode)
                                    ).filter(code => code.length > 0)
                                ))
                            }
                            : {})
                    });
                if (requestId !== reportRequestId.current) {
                    return;
                }
            }
            // Group SharePoint monthly targets into one report row per
            // selected unit or salesperson. Collect the distinct permitted
            // branches for each row before matching the period's collections.
            const grouped = new Map<string, IReportRowBuilder>();
            for (const target of matchingTargets) {
                const code = normalizeCode(target.targetCode);
                const branchCode = criteria === 'Unit'
                    ? code
                    : normalizeCode(target.unitCode || '');
                const groupKey = JSON.stringify([
                    target.companyId,
                    criteria,
                    code
                ]);
                let row = grouped.get(groupKey);
                if (!row) {
                    row = {
                        key: groupKey,
                        code: target.targetCode,
                        name: target.targetName,
                        companyId: target.companyId,
                        targetAmount: 0,
                        branchCodes: new Set<string>()
                    };
                    grouped.set(groupKey, row);
                }
                row.targetAmount += target.targetAmount;
                row.branchCodes.add(branchCode);
            }
            // Backend totals are already combined across periodicity months.
            // Index by both target and branch to avoid counting the same
            // salesperson's collection twice when targets exist in multiple
            // months and to preserve Unit Access at display level.
            const totalsByTargetAndBranch = new Map<
                string,
                { receipt: number; payment: number }
            >();
            for (const total of collectionTotals || []) {
                const code = normalizeCode(total.targetCode);
                const branchCode = normalizeCode(total.branchCode);
                if (total.targetType !== criteria ||
                    !code ||
                    !branchCode ||
                    !allowedUnitCodeSet.has(branchCode)) {
                    continue;
                }
                const key = JSON.stringify([code, branchCode]);
                const existing = totalsByTargetAndBranch.get(key) || {
                    receipt: 0,
                    payment: 0
                };
                existing.receipt += total.receiptCollection;
                existing.payment += total.paymentCollection;
                totalsByTargetAndBranch.set(key, existing);
            }
            const rows: readonly IReportRow[] = Array.from(grouped.values())
                .map(row => {
                    let receipt = 0;
                    let payment = 0;
                    // Use each branch exactly once for the full period.
                    for (const branch of Array.from(row.branchCodes)) {
                        const key = JSON.stringify([
                            normalizeCode(row.code),
                            branch
                        ]);
                        const amount = totalsByTargetAndBranch.get(key);
                        receipt += amount?.receipt || 0;
                        payment += amount?.payment || 0;
                    }
                    // Business = receiptCollection + paymentCollection.
                    // The API already totals both over the selected period.
                    const businessAmount = collectionTotals === undefined
                        ? undefined
                        : receipt + payment;
                    return {
                        key: row.key,
                        code: row.code,
                        name: row.name,
                        companyId: row.companyId,
                        targetAmount: row.targetAmount,
                        businessAmount,
                        achievementPercentage: businessAmount !== undefined &&
                            row.targetAmount > 0
                            ? (businessAmount / row.targetAmount) * 100
                            : undefined
                    };
                })
                .sort((first, second) =>
                    first.name.localeCompare(second.name, undefined, {
                        sensitivity: 'base'
                    }) || first.code.localeCompare(second.code));
            if (requestId === reportRequestId.current) {
                setReportRows(rows);
            }
        }
        catch (loadFailure) {
            if (requestId === reportRequestId.current) {
                setReportRows([]);
                setError(getUserFriendlyError(loadFailure));
            }
        }
        finally {
            if (requestId === reportRequestId.current) {
                setLoading(false);
            }
        }
    }, [
        month,
        year,
        periodicity,
        criteria,
        selectedCodes,
        selectedCompanyId,
        selectorOptions,
        targetService,
        verticalService,
        unitService,
        unitAccessService,
        appUserId,
        collectionVerticalReportApiService
    ]);
    const visibleSelection = unitAccess &&
        unitAccess.companyId === selectedCompanyId &&
        unitAccess.appUserId === appUserId &&
        appliedSelection?.companyId === selectedCompanyId
        ? appliedSelection
        : undefined;
    const overviewTotals = React.useMemo(() => {
        const target = reportRows.reduce(
            (sum, row) => sum + row.targetAmount, 0);
        const hasBusinessData = reportRows.length > 0 &&
            reportRows.every(row => row.businessAmount !== undefined);
        const business = hasBusinessData
            ? reportRows.reduce(
                (sum, row) => sum + (row.businessAmount || 0), 0)
            : undefined;
        return {
            target,
            business,
            percentage: business !== undefined && target > 0
                ? (business / target) * 100
                : undefined
        };
    }, [reportRows]);
    const longestNameLength = reportRows.reduce((max, row) => Math.max(max, row.name.trim().length), 0);
    const identityColumnWidth = Math.min(visibleSelection?.criteria === 'Salesperson'
        ? 250
        : 205, Math.max(visibleSelection?.criteria === 'Salesperson'
        ? 180
        : 150, Math.ceil(longestNameLength * 7.4 + 28)));
    const tableWidth = numberColumnWidth +
        identityColumnWidth +
        targetColumnWidth +
        businessColumnWidth +
        percentageColumnWidth;
    return (<PageContainer title={collectionVerticalReportModuleConfig.title} description={collectionVerticalReportModuleConfig.description}>
        <div className={styles.reportLayout}>
          <section className={styles.filterPanel} aria-label="Report filters">
            <div className={styles.filterIntro}>
              <div>
                <h3 className={styles.filterTitle}>
                  Report filters
                </h3>
                <p className={styles.filterDescription}>
                  Select ending Month/Year, number
                  of months and units or salespersons.
                </p>
              </div>
            </div>
            {/* First row */}
            <div className={`${styles.filterGrid} ${styles.filterGridThreeColumns}`}>
              <Dropdown label="Month" value={month} options={collectionReportMonthOptions} required onChange={value => {
            if (typeof value === 'string') {
                setMonth(value);
            }
        }}/>
              <Dropdown label="Year" value={year} options={yearOptions} required onChange={value => {
            if (typeof value === 'string') {
                setYear(value);
            }
        }}/>
            <InputField label="Periodicity (months)" type="number" min={1} max={24} required value={periodicity} placeholder="Enter number of months" onChange={value => {
            setPeriodicity(value);
        }}/>
            </div>
            {/* Second row */}
            <div className={`${styles.filterGrid} ${styles.filterGridThreeColumns} ${styles.filterGridSecondRow}`} style={{ marginTop: 12 }}>
              <Dropdown label="Criteria" value={criteria} options={collectionReportCriteriaOptions} required onChange={value => {
            if (value === 'Unit' ||
                value === 'Salesperson') {
                setCriteria(value);
                setSelectedCodes([
                    allOptionValue
                ]);
            }
        }}/>
              {/* Searchable multi-select dropdown */}
              <Dropdown key={`${selectedCompanyId}:${criteria}`} label={criteria === 'Unit'
            ? 'Units'
            : 'Salespersons'} values={selectedCodes} options={selectorOptions} multiSelect searchable loading={lookupLoading} placeholder={criteria === 'Unit'
            ? 'Search and select units'
            : 'Search and select salespersons'} onChange={value => {
            const next = Array.isArray(value)
                ? value.filter((code): code is string => typeof code === 'string')
                : [];
            // Clicking All clears specific selections.
            if (next.indexOf(allOptionValue) !== -1 &&
                selectedCodes.indexOf(allOptionValue) === -1) {
                setSelectedCodes([allOptionValue]);
                return;
            }
            // Selecting a specific item removes All.
            const specificCodes = next.filter(code => code !== allOptionValue);
            setSelectedCodes(specificCodes.length > 0
                ? specificCodes
                : [allOptionValue]);
        }} disabled={lookupLoading ||
            unitAccessLoading ||
            !unitAccess ||
            !selectedCompanyId ||
            Boolean(unitAccessError)}/>
              <div className={styles.submitControl}>
                <Button label="Submit" variant="primary" loading={loading} disabled={loading ||
            lookupLoading ||
            unitAccessLoading ||
            !unitAccess ||
            !selectedCompanyId ||
            Boolean(unitAccessError)} onClick={() => {
            handleSubmit().catch(() => undefined);
        }}/>
              </div>
            </div>
            {unitAccessLoading ? (<div className={styles.reportNotice} role="status">
                Verifying your assigned units...
              </div>) : unitAccessError ? (<div className={styles.reportNotice} role="alert">
                {unitAccessError}
              </div>) : unitAccess ? (<div className={styles.reportNotice} role="status">
                Collection Report restricted to {unitAccess.unitCodes.length}{' '}
                assigned unit(s): {unitAccess.unitCodes.join(', ')}.
              </div>) : null}
            {lookupError ? (<div className={styles.reportNotice} role="status">
                {lookupError}
              </div>) : null}
          </section>
          {visibleSelection ? (<section className={styles.reportView} aria-label="Collection report results">
              <div className={styles.reportHeader}>
                <div>
                  <p className={styles.reportEyebrow}>
                    PERFORMANCE OVERVIEW
                  </p>
                  <h3 className={styles.reportTitle}>
                    {visibleSelection.criteria}
                    {' '}Collection Report
                  </h3>
                  <p className={styles.reportPeriod}>
                    {visibleSelection.selectedName}
                    {' · '}
                    {visibleSelection.periodicity}
                    {' '}month(s), ending{' '}
                    {getMonthName(Number(visibleSelection.month))}
                    {' '}
                    {visibleSelection.year}
                  </p>
                </div>
                <div className={styles.periodBadge}>
                  {visibleSelection.periodLabel}
                </div>
              </div>
              {!loading && !error && reportRows.length > 0 ? (
                <div className={styles.overviewGrid} aria-label="Report overview">
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Total Targets</span>
                    <strong className={styles.overviewValue}>
                      <AmountDisplay amount={overviewTotals.target}/>
                    </strong>
                  </div>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Total Collection</span>
                    <strong className={styles.overviewText}>
                      {overviewTotals.business === undefined
                        ? <span className={styles.fallback}>—</span>
                        : <AmountDisplay amount={overviewTotals.business}/>}
                    </strong>
                  </div>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Overall %</span>
                    <strong className={styles.overviewText}>
                      {renderAchievement(overviewTotals.percentage)}
                    </strong>
                  </div>
                </div>
              ) : null}
              <div className={styles.reportNotice} role="note">
                <span className={styles.noticeMarker} aria-hidden="true">
                  i
                </span>
                <span>
                  Collection targets come from SharePoint. Collection equals
                  receiptCollection + paymentCollection from the Business
                  Central advertisingCollections API for the selected period.
                  Achievement % = Collection / Target x 100.
                  Records without salesperson codes cannot be allocated to a
                  salesperson. Unit Access is filtered in this page only;
                  the current demo API does not enforce it server-side.
                </span>
              </div>
              {loading ? (<div className={styles.reportState} role="status">
                  Loading Collection targets and
                  Collection amounts...
                </div>) : error ? (<div className={`${styles.reportState} ${styles.reportError}`} role="alert">
                  {error}
                </div>) : reportRows.length === 0 ? (<div className={styles.reportState}>
                  No Collection targets found for the
                  selected period and filters.
                </div>) : (<>
                  <div className={styles.tableShell}>
                    <div className={styles.tableToolbar}>
                      <div className={styles.tableToolbarTitle}>
                        Detailed performance
                        <span className={styles.tableRowCount}>
                          {reportRows.length} rows
                        </span>
                      </div>
                    </div>
                    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Scroll Collection report table horizontally">
                      <table className={styles.reportTable} style={{ minWidth: tableWidth }}>
                        <caption className={styles.srOnly}>
                          {visibleSelection.criteria}
                          {' '}Collection Report for{' '}
                          {visibleSelection.periodLabel}
                        </caption>
                        <colgroup>
                          <col style={{
                    width: numberColumnWidth
                }}/>
                          <col style={{
                    width: identityColumnWidth
                }}/>
                          <col style={{
                    width: targetColumnWidth
                }}/>
                          <col style={{
                    width: businessColumnWidth
                }}/>
                          <col style={{
                    width: percentageColumnWidth
                }}/>
                        </colgroup>
                        <thead>
                          <tr>
                            <th className={styles.stickyNumber} scope="col">
                              No.
                            </th>
                            <th className={styles.stickyIdentity} scope="col">
                              {visibleSelection.criteria}
                            </th>
                            <th className={styles.metricHeader} scope="col">
                              Target
                            </th>
                            <th className={`${styles.metricHeader} ${styles.businessHeading}`} scope="col">
                              Collection
                            </th>
                            <th className={styles.metricHeader} scope="col">
                              %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportRows.map((row, index) => (<tr key={row.key}>
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
                              </td>
                              <td className={styles.metricCell}>
                                <AmountDisplay amount={row.targetAmount}/>
                              </td>
                              <td className={`${styles.metricCell} ${styles.businessCell}`}>
                                {row.businessAmount === undefined
                        ? (<span className={styles.fallback}>—</span>)
                        : (<AmountDisplay amount={row.businessAmount}/>)}
                              </td>
                              <td className={styles.metricCell}>
                                {renderAchievement(row.achievementPercentage)}
                              </td>
                            </tr>))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className={styles.mobileList}>
                    {reportRows.map((row, index) => (<article className={styles.mobileCard} key={row.key}>
                        <div className={styles.mobileCardHeader}>
                          <div className={styles.mobileCardName}>
                            {row.name}
                          </div>
                          <div className={styles.mobileCardCode}>
                            No. {index + 1}
                            {' · '}Code: {row.code}
                          </div>
                        </div>
                        <div className={styles.mobileVertical}>
                          <div className={styles.mobileVerticalTitle}>
                            Collection
                          </div>
                          <div className={styles.mobileMetrics}>
                            <div className={styles.mobileMetric}>
                              <span className={styles.mobileMetricLabel}>
                                Target
                              </span>
                              <div className={styles.mobileMetricValue}>
                                <AmountDisplay amount={row.targetAmount}/>
                              </div>
                            </div>
                            <div className={styles.mobileMetric}>
                              <span className={styles.mobileMetricLabel}>
                                Collection
                              </span>
                              <div className={styles.mobileMetricValue}>
                                {row.businessAmount === undefined
                        ? (<span className={styles.fallback}>—</span>)
                        : (<AmountDisplay amount={row.businessAmount}/>)}
                              </div>
                            </div>
                            <div className={styles.mobileMetric}>
                              <span className={styles.mobileMetricLabel}>
                                %
                              </span>
                              <div className={styles.mobileMetricValue}>
                                {renderAchievement(row.achievementPercentage)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>))}
                  </div>
                </>)}
            </section>) : (<div className={styles.emptyPrompt}>
              <span className={styles.emptyPromptSymbol} aria-hidden="true">
                ▤
              </span>
              <strong>
                Ready to view performance?
              </strong>
              <span>
                Select Month, Year, Periodicity,
                Criteria and one or more names,
                then Submit.
              </span>
            </div>)}
        </div>
      </PageContainer>);
};
