import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import type { UnitService } from '../../../services/units/unitService';
import { AppLoader } from '../../../../../shared/components/loaders/AppLoader';
import { ErrorState } from '../../../../../shared/components/errorState/ErrorState';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';
import ChequeEntryForm, {
  IBranchOption,
  IChequeEntryPayload
} from './ChequeEntryForm';
import { ChequeEntryList } from './ChequeEntryList';
import {
  ChequeEntrySharePointService,
  IChequeEntryListItem
} from '../../../services/ChequeEntry/ChequeEntrySharePointService';

export interface IChequeEntryPageProps {
  spHttpClient: SPHttpClient;
  webAbsoluteUrl: string;
  selectedCompanyId: string;
  unitService: UnitService;
  /** Existing SharePoint list with the documented column internal names. */
  listTitle: string;
}

export const ChequeEntryPage: React.FC<IChequeEntryPageProps> = props => {
  const [branches, setBranches] = React.useState<IBranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = React.useState(true);
  const [branchError, setBranchError] = React.useState('');
  const [entries, setEntries] = React.useState<readonly IChequeEntryListItem[]>([]);
  const [loadingEntries, setLoadingEntries] = React.useState(true);
  const [entryError, setEntryError] = React.useState('');
  const [hasMore, setHasMore] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const listRequestId = React.useRef(0);

  // Unit Master is global; active records with a Unit Code become branches.
  React.useEffect(() => {
    let active = true;
    setLoadingBranches(true);
    setBranchError('');
    setBranches([]);

    void props.unitService.getUnits()
      .then(units => {
        if (!active) return;
        const seenCodes = new Set<string>();
        const options: IBranchOption[] = [];
        units.forEach(unit => {
          const code = (unit.unitCode || '').trim();
          if (!unit.isActive || !code) return;
          const uniqueCode = code.toUpperCase();
          if (seenCodes.has(uniqueCode)) return;
          seenCodes.add(uniqueCode);
          const name = (unit.unitName || '').trim() || code;
          options.push({
            id: code,
            name: name === code ? code : name + ' (' + code + ')'
          });
        });
        options.sort((a, b) => a.name.localeCompare(b.name));
        setBranches(options);
      })
      .catch(error => {
        if (!active) return;
        setBranchError('Could not load branches from Unit Master: ' +
          getUserFriendlyError(error));
      })
      .then(() => { if (active) setLoadingBranches(false); });

    return () => { active = false; };
  }, [props.unitService]);

  const service = React.useMemo(() => new ChequeEntrySharePointService({
    spHttpClient: props.spHttpClient,
    webAbsoluteUrl: props.webAbsoluteUrl,
    listTitle: props.listTitle
  }), [props.spHttpClient, props.webAbsoluteUrl, props.listTitle]);

  // Refresh on first open, company switch and successful save.
  // Ignore results from older requests if the user changes company quickly.
  React.useEffect(() => {
    const currentRequestId = ++listRequestId.current;
    setLoadingEntries(true);
    setEntryError('');
    setEntries([]);
    setHasMore(false);

    void service.getEntriesForCompany(props.selectedCompanyId)
      .then(result => {
        if (listRequestId.current !== currentRequestId) return;
        setEntries(result.entries);
        setHasMore(result.hasMore);
      })
      .catch(error => {
        if (listRequestId.current !== currentRequestId) return;
        setEntryError(getUserFriendlyError(error));
      })
      .then(() => {
        if (listRequestId.current === currentRequestId) setLoadingEntries(false);
      });

    return () => { listRequestId.current += 1; };
  }, [service, props.selectedCompanyId, refreshVersion]);

  React.useEffect(() => {
    setShowForm(false);
  }, [props.selectedCompanyId]);

  const handleSave = React.useCallback(
    async (entry: IChequeEntryPayload): Promise<void> => {
      if (loadingBranches || branchError ||
          !branches.some(branch => branch.id === entry.branchId)) {
        throw new Error('Select an active branch from Unit Master before saving.');
      }
      // Do not mix the POST result with a subsequent GET; if a reload fails,
      // we must not report the successful POST as a failed Save.
      await service.save(entry, props.selectedCompanyId);
    }, [service, props.selectedCompanyId, branches, loadingBranches, branchError]
  );

  const handleSaved = React.useCallback((): void => {
    setShowForm(false);
    setRefreshVersion(previous => previous + 1);
  }, []);

  if (showForm) {
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
        branches={branches}
        onSave={handleSave}
        onSaved={handleSaved}
        onBack={() => setShowForm(false)}
      />
    );
  }

  return (
    <ChequeEntryList
      entries={entries}
      branches={branches}
      loading={loadingEntries}
      error={entryError}
      hasMore={hasMore}
      canAdd={!loadingBranches && !branchError && branches.length > 0}
      branchWarning={branchError || (!loadingBranches && branches.length === 0
        ? 'Unit Master has no active branches. You can still review saved cheques.'
        : undefined)}
      onAdd={() => setShowForm(true)}
      onRefresh={() => setRefreshVersion(previous => previous + 1)}
    />
  );
};
