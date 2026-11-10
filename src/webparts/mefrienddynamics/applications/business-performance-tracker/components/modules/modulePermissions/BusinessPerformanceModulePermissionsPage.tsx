import * as React from 'react';
import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { Button } from '../../../../../shared/components/buttons/Button';
import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';
import { isBusinessPerformancePermissionModuleKey } from '../../../config/businessPerformanceAccessConfig';
import {
  BusinessPerformancePermissionAdminService
} from '../../../services/access/businessPerformancePermissionAdminService';
import type {
  IModulePermissionsUser,
  IModulePermissionAssignment
} from '../../../services/access/businessPerformancePermissionAdminService';

interface IProps {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl: string;
  /** Render within the Settings panel without another PageContainer. */
  embedded?: boolean;
}

interface IModulePermissionRow extends IModulePermissionAssignment {
  label: string;
}

// Keep labels here; the configuration validator controls which module keys
// are supported. An unregistered key is never edited or written.
const candidateModules: readonly { key: string; label: string }[] = [
  { key: 'bpt.app', label: 'Business Performance Tracker' },
  { key: 'bpt.verticals', label: 'Vertical Master' },
  { key: 'bpt.units', label: 'Unit Master' },
  { key: 'bpt.targets', label: 'Target Master' },
  { key: 'bpt.collectionReport', label: 'Business Report' },
  { key: 'bpt.collectionVerticalReport', label: 'Collection Report' },
  { key: 'bpt.unitAccess', label: 'Unit Access' }
];

const supportedModules = candidateModules.filter(item =>
  isBusinessPerformancePermissionModuleKey(item.key)
);

const emptyRow = (key: string, label: string): IModulePermissionRow => ({
  moduleKey: key,
  label,
  isActive: false,
  canView: false,
  canCreate: false,
  canManage: false
});

const areEqual = (
  left: IModulePermissionRow,
  right: IModulePermissionRow
): boolean =>
  left.moduleKey === right.moduleKey &&
  left.isActive === right.isActive &&
  left.canView === right.canView &&
  left.canCreate === right.canCreate &&
  left.canManage === right.canManage;

export const BusinessPerformanceModulePermissionsPage: React.FC<IProps> = ({
  pageContext,
  spHttpClient,
  webAbsoluteUrl,
  embedded = false
}) => {
  const adminService = React.useMemo(
    () => new BusinessPerformancePermissionAdminService({
      pageContext,
      spHttpClient,
      webAbsoluteUrl
    }),
    [pageContext, spHttpClient, webAbsoluteUrl]
  );

  const [users, setUsers] = React.useState<readonly IModulePermissionsUser[]>([]);
  const [administratorId, setAdministratorId] = React.useState<number>();
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [rows, setRows] = React.useState<readonly IModulePermissionRow[]>([]);
  const [savedRows, setSavedRows] = React.useState<readonly IModulePermissionRow[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState<boolean>(true);
  const [loadingPermissions, setLoadingPermissions] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [message, setMessage] = React.useState<string>('');

  React.useEffect(() => {
    let active = true;
    const loadUsers = async (): Promise<void> => {
      setLoadingUsers(true);
      setError('');
      try {
        const adminId = await adminService.getCurrentAdministratorUserId();
        const fetched = await adminService.getAppUsers();
        if (active) {
          setAdministratorId(adminId);
          setUsers(fetched);
        }
      } catch (loadError) {
        if (active) {
          setError(getUserFriendlyError(loadError));
          setUsers([]);
        }
      } finally {
        if (active) {
          setLoadingUsers(false);
        }
      }
    };
    void loadUsers();
    return () => { active = false; };
  }, [adminService]);

  React.useEffect(() => {
    let active = true;
    const loadPermissions = async (): Promise<void> => {
      setRows([]);
      setSavedRows([]);
      setMessage('');
      setError('');
      if (!selectedUserId) {
        setLoadingPermissions(false);
        return;
      }
      setLoadingPermissions(true);
      try {
        const saved = await adminService.getUserPermissions(Number(selectedUserId));
        if (!active) {
          return;
        }
        const byModule = new Map<string, IModulePermissionAssignment>();
        saved.forEach(item => byModule.set(item.moduleKey, item));
        const nextRows: IModulePermissionRow[] = supportedModules.map(item => ({
          ...emptyRow(item.key, item.label),
          ...(byModule.get(item.key) || {})
        }));
        setRows(nextRows);
        setSavedRows(nextRows.map(item => ({ ...item })));
      } catch (loadError) {
        if (active) {
          setError(getUserFriendlyError(loadError));
        }
      } finally {
        if (active) {
          setLoadingPermissions(false);
        }
      }
    };
    void loadPermissions();
    return () => { active = false; };
  }, [selectedUserId, adminService]);

  const userOptions = React.useMemo<readonly ILookupOption[]>(() =>
    users.map(user => ({
      key: String(user.id),
      value: String(user.id),
      text: `${user.name}${user.email ? ` (${user.email})` : ''}` +
        (user.isActive ? '' : ' - Inactive')
    })),
    [users]
  );

  const changes = React.useMemo(() => rows.filter(row => {
    const previous = savedRows.find(saved => saved.moduleKey === row.moduleKey);
    return !previous || !areEqual(row, previous);
  }), [rows, savedRows]);

  const updateFlag = (
    key: string,
    field: 'isActive' | 'canView' | 'canCreate' | 'canManage',
    checked: boolean
  ): void => {
    setMessage('');
    setRows(previous => previous.map(row => {
      if (row.moduleKey !== key) {
        return row;
      }
      if (field === 'isActive') {
        return checked
          ? { ...row, isActive: true }
          : { ...row, isActive: false, canView: false, canCreate: false, canManage: false };
      }
      if (field === 'canView') {
        return checked
          ? { ...row, isActive: true, canView: true }
          : { ...row, canView: false, canCreate: false, canManage: false };
      }
      if (field === 'canCreate') {
        return { ...row, isActive: true, canView: checked ? true : row.canView, canCreate: checked };
      }
      return { ...row, isActive: true, canView: checked ? true : row.canView, canManage: checked };
    }));
  };

  const handleSave = async (): Promise<void> => {
    if (!selectedUserId || saving || loadingPermissions || changes.length === 0) {
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await adminService.saveUserPermissions(
        Number(selectedUserId),
        changes.map(row => ({
          moduleKey: row.moduleKey,
          isActive: row.isActive,
          canView: row.canView,
          canCreate: row.canCreate,
          canManage: row.canManage
        }))
      );
      const verified = await adminService.getUserPermissions(Number(selectedUserId));
      const byModule = new Map<string, IModulePermissionAssignment>();
      verified.forEach(item => byModule.set(item.moduleKey, item));
      const refreshed = supportedModules.map(item => ({
        ...emptyRow(item.key, item.label),
        ...(byModule.get(item.key) || {})
      }));
      setRows(refreshed);
      setSavedRows(refreshed.map(item => ({ ...item })));
      setMessage('Module permissions saved. Users must reload the application to refresh their access.');
    } catch (saveError) {
      setError(getUserFriendlyError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const selectedId = Number(selectedUserId);
  const busy = loadingUsers || loadingPermissions || saving;

  const content = (
    <div style={{ background: '#fff', border: '1px solid #e4e7ec', padding: 20, borderRadius: 12 }}>
        <div style={{ maxWidth: 580 }}>
          <Dropdown
            label="App User"
            value={selectedUserId}
            options={userOptions}
            searchable
            loading={loadingUsers}
            disabled={busy}
            placeholder="Select an App User"
            onChange={value => setSelectedUserId(typeof value === 'string' ? value : '')}
          />
        </div>
        <p style={{ color: '#667085', fontSize: 13 }}>
          These permissions are per user across Business Performance Tracker; they are not tied to the selected company.
          Collection Report Unit Access is configured separately.
        </p>
        {error ? <p role="alert" style={{ color: '#b42318' }}>{error}</p> : null}
        {message ? <p role="status" style={{ color: '#067647' }}>{message}</p> : null}
        {loadingPermissions ? <p role="status">Loading permissions...</p> : null}
        {!loadingPermissions && selectedUserId && rows.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                    <th scope="col" style={{ padding: 12 }}>Module</th>
                    <th scope="col" style={{ padding: 12 }}>Active</th>
                    <th scope="col" style={{ padding: 12 }}>View</th>
                    <th scope="col" style={{ padding: 12 }}>Create</th>
                    <th scope="col" style={{ padding: 12 }}>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const protectSelfApp =
                      selectedId === administratorId && row.moduleKey === 'bpt.app';
                    return (
                      <tr key={row.moduleKey} style={{ borderBottom: '1px solid #eaecf0' }}>
                        <th scope="row" style={{ padding: 12, textAlign: 'left' }}>
                          <div>{row.label}</div>
                          <div style={{ color: '#667085', fontWeight: 400, fontSize: 11 }}>
                            {row.moduleKey}
                          </div>
                        </th>
                        {(['isActive', 'canView', 'canCreate', 'canManage'] as const).map(flag => (
                          <td key={flag} style={{ padding: 12 }}>
                            <input
                              type="checkbox"
                              aria-label={`${row.label}: ${flag}`}
                              checked={row[flag]}
                              disabled={busy || protectSelfApp}
                              onChange={event => updateFlag(
                                row.moduleKey,
                                flag,
                                event.currentTarget.checked
                              )}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <Button
                label="Save Permissions"
                variant="primary"
                loading={saving}
                disabled={busy || changes.length === 0}
                onClick={() => { void handleSave(); }}
              />
              <Button
                label="Discard Changes"
                disabled={busy || changes.length === 0}
                onClick={() => setRows(savedRows.map(row => ({ ...row })))}
              />
              <span style={{ alignSelf: 'center', color: '#667085', fontSize: 12 }}>
                {changes.length} unsaved module(s)
              </span>
            </div>
          </>
        ) : null}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageContainer
      title="Module Permissions"
      description="Manage per-user access to Business Performance Tracker modules."
    >
      {content}
    </PageContainer>
  );
};
