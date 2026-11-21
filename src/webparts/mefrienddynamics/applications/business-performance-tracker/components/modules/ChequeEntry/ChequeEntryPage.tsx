import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import type { UnitService } from '../../../services/units/unitService';
import type {
  BusinessPerformanceUnitAccessService
} from '../../../services/access/businessPerformanceUnitAccessService';
import { AppLoader } from '../../../../../shared/components/loaders/AppLoader';
import { ErrorState } from '../../../../../shared/components/errorState/ErrorState';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';
import ChequeEntryForm, {
  IBranchOption,
  IChequeEntryPayload
} from './ChequeEntryForm';
import { ChequeEntryList } from './ChequeEntryList';
import { ChequeEntryDetails } from './ChequeEntryDetails';
import {
  ChequeEntrySharePointService,
  IChequeEntryListItem
} from '../../../services/ChequeEntry/ChequeEntrySharePointService';

export interface IChequeEntryPageProps {
  spHttpClient: SPHttpClient;
  webAbsoluteUrl: string;
  selectedCompanyId: string;
  unitService: UnitService;
  unitAccessService: BusinessPerformanceUnitAccessService;
  /** User ID from the verified BPT authorization gate (not the SP user ID). */
  appUserId?: number;
  /** Independent Cheque Entry create/edit permissions. */
  canCreate: boolean;
  canManage: boolean;
  /** Existing SharePoint list with the documented column internal names. */
  listTitle: string;
}

const normalizeBranch = (value: string): string => value.trim().toUpperCase();

interface IChequeUnitScope {
  companyId: string;
  appUserId: number;
  branches: IBranchOption[];
  codes: readonly string[];
}

/** Resolve SharePoint unit lookup IDs against ACTIVE Unit Master records. */
const getAllowedBranches = (
  assignedIds: readonly number[],
  units: readonly { id: number; unitCode?: string; unitName: string; isActive: boolean }[]
): IBranchOption[] => {
  const allowedIds = new Set(assignedIds);
  const seen = new Set<string>();
  const options: IBranchOption[] = [];
  units.forEach(unit => {
    const code = (unit.unitCode || '').trim();
    const normalizedCode = normalizeBranch(code);
    if (!allowedIds.has(unit.id) || !unit.isActive || !normalizedCode ||
        seen.has(normalizedCode)) return;
    seen.add(normalizedCode);
    const name = (unit.unitName || '').trim() || code;
    options.push({ id: code, name: name === code ? code : name + ' (' + code + ')' });
  });
  options.sort((left, right) => left.name.localeCompare(right.name));
  return options;
};

export const ChequeEntryPage: React.FC<IChequeEntryPageProps> = props => {
  const [unitScope, setUnitScope] = React.useState<IChequeUnitScope>();
  const [loadingBranches, setLoadingBranches] = React.useState(true);
  const [branchError, setBranchError] = React.useState('');
  const [unitRefreshVersion, setUnitRefreshVersion] = React.useState(0);
  const currentUnitScope = unitScope &&
    unitScope.companyId === props.selectedCompanyId &&
    unitScope.appUserId === props.appUserId ? unitScope : undefined;
  const branches = currentUnitScope ? currentUnitScope.branches : [];
  const [entries, setEntries] = React.useState<readonly IChequeEntryListItem[]>([]);
  const [loadingEntries, setLoadingEntries] = React.useState(true);
  const [entryError, setEntryError] = React.useState('');
  const [hasMore, setHasMore] = React.useState(false);
  const [mode, setMode] = React.useState<'list' | 'create' | 'view' | 'edit'>('list');
  const [selectedEntry, setSelectedEntry] =
    React.useState<IChequeEntryListItem | undefined>();
  const [openingEntry, setOpeningEntry] = React.useState(false);
  const [openError, setOpenError] = React.useState('');
  const openRequestId = React.useRef(0);
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const listRequestId = React.useRef(0);

  // Unit Access is per App User AND selected company. Fail closed if
  // assignments cannot be verified; never use all global Unit Master rows.
  React.useEffect(() => {
    let active = true;
    setLoadingBranches(true);
    setBranchError('');
    setUnitScope(undefined);
    setMode('list');
    setSelectedEntry(undefined);
    openRequestId.current += 1;
    listRequestId.current += 1;

    if (!props.selectedCompanyId || !props.appUserId ||
        !Number.isSafeInteger(props.appUserId) || props.appUserId <= 0) {
      setBranchError('Unable to verify your Cheque Entry unit access.');
      setLoadingBranches(false);
      return () => { active = false; };
    }

    const loadScope = async (): Promise<void> => {
      try {
        const [assignedIds, units] = await Promise.all([
          props.unitAccessService.getAssignedUnitIds(
            props.appUserId as number, props.selectedCompanyId
          ),
          props.unitService.getUnits()
        ]);
        if (!active) return;
        const allowedBranches = getAllowedBranches(assignedIds, units);
        if (allowedBranches.length === 0) {
          setBranchError(
            'No active units are assigned to you for this company. ' +
            'Ask an administrator to configure Settings → Unit Access.'
          );
          return;
        }
        setUnitScope({
          companyId: props.selectedCompanyId,
          appUserId: props.appUserId as number,
          branches: allowedBranches,
          codes: allowedBranches.map(branch => branch.id)
        });
      } catch (loadError) {
        if (active) {
          setBranchError('Could not verify Cheque Entry unit access: ' +
            getUserFriendlyError(loadError));
        }
      } finally {
        if (active) setLoadingBranches(false);
      }
    };
    void loadScope();
    return () => { active = false; };
  }, [props.selectedCompanyId, props.appUserId,
    props.unitAccessService, props.unitService, unitRefreshVersion]);

  // Recheck the actual saved assignments before sensitive operations.
  const getFreshAllowedCodes = React.useCallback(async (): Promise<Set<string>> => {
    if (!props.selectedCompanyId || !props.appUserId ||
        !Number.isSafeInteger(props.appUserId) || props.appUserId <= 0) {
      throw new Error('Unable to identify your authorized units.');
    }
    const [assignedIds, units] = await Promise.all([
      props.unitAccessService.getAssignedUnitIds(props.appUserId, props.selectedCompanyId),
      props.unitService.getUnits()
    ]);
    const codes = getAllowedBranches(assignedIds, units).map(branch =>
      normalizeBranch(branch.id)
    );
    if (codes.length === 0) {
      throw new Error('You have no active units assigned for this company.');
    }
    return new Set(codes);
  }, [props.selectedCompanyId, props.appUserId,
    props.unitAccessService, props.unitService]);

  const service = React.useMemo(() => new ChequeEntrySharePointService({
    spHttpClient: props.spHttpClient,
    webAbsoluteUrl: props.webAbsoluteUrl,
    listTitle: props.listTitle
  }), [props.spHttpClient, props.webAbsoluteUrl, props.listTitle]);

  // Request only assigned branches from SharePoint (not the whole company).
  // Avoid queries entirely while Unit Access is unverified.
  React.useEffect(() => {
    const requestId = ++listRequestId.current;
    setLoadingEntries(true);
    setEntryError('');
    setEntries([]);
    setHasMore(false);
    if (!currentUnitScope) {
      setLoadingEntries(false);
      return () => { listRequestId.current += 1; };
    }
    void service.getEntriesForCompany(props.selectedCompanyId, currentUnitScope.codes)
      .then(result => {
        if (listRequestId.current !== requestId) return;
        const allowed = new Set(currentUnitScope.codes.map(normalizeBranch));
        setEntries(result.entries.filter(entry => allowed.has(
          normalizeBranch(entry.branchId)
        )));
        setHasMore(result.hasMore);
      })
      .catch(loadError => {
        if (listRequestId.current !== requestId) return;
        setEntryError(getUserFriendlyError(loadError));
      })
      .then(() => {
        if (listRequestId.current === requestId) setLoadingEntries(false);
      });
    return () => { listRequestId.current += 1; };
  }, [service, props.selectedCompanyId, currentUnitScope, refreshVersion]);

  React.useEffect(() => {
    openRequestId.current += 1;
    setMode('list');
    setSelectedEntry(undefined);
    setOpenError('');
  }, [props.selectedCompanyId]);

  const handleSave = React.useCallback(
    async (entry: IChequeEntryPayload): Promise<void> => {
      if (loadingBranches || branchError || !currentUnitScope ||
          !branches.some(branch => normalizeBranch(branch.id) ===
            normalizeBranch(entry.branchId))) {
        throw new Error('Select an authorized active branch before saving.');
      }
      if (mode === 'edit' && !props.canManage) {
        throw new Error('You do not have permission to edit cheques.');
      }
      if (mode !== 'edit' && !props.canCreate) {
        throw new Error('You do not have permission to create cheques.');
      }
      const freshAllowed = await getFreshAllowedCodes();
      if (!freshAllowed.has(normalizeBranch(entry.branchId)) ||
          (mode === 'edit' && selectedEntry &&
           !freshAllowed.has(normalizeBranch(selectedEntry.branchId)))) {
        throw new Error('You no longer have Unit Access for this cheque branch.');
      }
      // Do not mix the POST result with a subsequent GET; if a reload fails,
      // we must not report the successful POST as a failed Save.
      if (mode === 'edit') {
        if (!selectedEntry) {
          throw new Error('Selected cheque is unavailable. Reopen it from the list.');
        }
        await service.update(selectedEntry, entry, props.selectedCompanyId);
      } else {
        await service.save(entry, props.selectedCompanyId);
      }
    }, [service, props.selectedCompanyId, props.canCreate, props.canManage,
      branches, currentUnitScope, loadingBranches, branchError, mode,
      selectedEntry, getFreshAllowedCodes]
  );

  const handleSaved = React.useCallback((): void => {
    setMode('list');
    setSelectedEntry(undefined);
    setRefreshVersion(previous => previous + 1);
  }, []);

  const openEntry = React.useCallback(async (
    item: IChequeEntryListItem,
    nextMode: 'view' | 'edit'
  ): Promise<void> => {
    if (nextMode === 'edit' && !props.canManage) {
      setOpenError('You do not have permission to edit cheques.');
      return;
    }
    const requestId = ++openRequestId.current;
    setOpeningEntry(true);
    setOpenError('');
    try {
      const freshAllowed = await getFreshAllowedCodes();
      if (!freshAllowed.has(normalizeBranch(item.branchId))) {
        throw new Error('You do not have Unit Access to this cheque branch.');
      }
      const current = await service.getEntryForCompany(item.id, props.selectedCompanyId);
      if (!freshAllowed.has(normalizeBranch(current.branchId))) {
        throw new Error('You do not have Unit Access to this cheque branch.');
      }
      if (openRequestId.current !== requestId) return;
      if (nextMode === 'edit' && (current.billsReadError || !current.etag)) {
        throw new Error('This cheque cannot be edited because bill data or version information is missing.');
      }
      setSelectedEntry(current);
      setMode(nextMode);
    } catch (error) {
      if (openRequestId.current === requestId) {
        setOpenError('Unable to open cheque: ' + getUserFriendlyError(error));
      }
    } finally {
      if (openRequestId.current === requestId) setOpeningEntry(false);
    }
  }, [service, props.selectedCompanyId, props.canManage, getFreshAllowedCodes]);

  if (loadingBranches) {
    return <AppLoader label="Checking Cheque Entry unit access" />;
  }
  if (branchError || !currentUnitScope) {
    return <ErrorState title="Cheque Entry unit access"
      message={branchError || 'Unit Access is required to open Cheque Entry.'} />;
  }

  if (mode === 'view' && selectedEntry) {
    const editable = props.canManage && Boolean(currentUnitScope) &&
      !loadingBranches && !branchError &&
      !selectedEntry.billsReadError && Boolean(selectedEntry.etag) &&
      branches.some(branch => branch.id === selectedEntry.branchId);
    return (
      <ChequeEntryDetails
        entry={selectedEntry}
        branches={branches}
        onBack={() => setMode('list')}
        onEdit={editable ? () => setMode('edit') : undefined}
      />
    );
  }

  if (mode === 'create' || mode === 'edit') {
    if ((mode === 'create' && !props.canCreate) || (mode === 'edit' && !props.canManage)) {
      return (
        <ErrorState title="Cheque Entry access denied"
          message="You do not have permission to perform this action." />
      );
    }
    if (loadingBranches) {
      return <AppLoader label="Loading branches from Unit Master" />;
    }
    if (branchError) {
      return <ErrorState title="Unable to load branches" message={branchError} />;
    }
    if (branches.length === 0) {
      return (
        <ErrorState title="No active branches"
          message="No active units with a Unit Code were found in Unit Master." />
      );
    }
    return (
      <ChequeEntryForm
        key={mode === 'edit' && selectedEntry ? String(selectedEntry.id) : 'new'}
        branches={branches}
        editing={mode === 'edit'}
        initialEntry={mode === 'edit' ? selectedEntry : undefined}
        onSave={handleSave}
        onSaved={handleSaved}
        onBack={() => setMode('list')}
      />
    );
  }

  return (
    <ChequeEntryList
      entries={entries}
      branches={branches}
      loading={loadingEntries || openingEntry}
      error={entryError}
      hasMore={hasMore}
      canAdd={props.canCreate && Boolean(currentUnitScope) &&
        !loadingBranches && !branchError && branches.length > 0}
      canEdit={props.canManage}
      branchWarning={openError || branchError || (!loadingBranches && branches.length === 0
        ? 'Unit Master has no active branches. You can still review saved cheques.'
        : undefined)}
      onAdd={() => {
        if (!props.canCreate) return;
        setSelectedEntry(undefined);
        setMode('create');
      }}
      onView={item => { void openEntry(item, 'view'); }}
      onEdit={item => { void openEntry(item, 'edit'); }}
      onRefresh={() => {
        setUnitRefreshVersion(previous => previous + 1);
        setRefreshVersion(previous => previous + 1);
      }}
    />
  );
};
