
import * as React from 'react';

import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../../shared/services/sharepoint/sharePointRestClient';

import {
  Dropdown
} from '../../../../../shared/components/dropdowns/Dropdown';

import {
  Button
} from '../../../../../shared/components/buttons/Button';

import type {
  ILookupOption
} from '../../../../../shared/models/ILookupOption';

import {
  getUserFriendlyError
} from '../../../../../shared/api/apiErrorHandler';

import {
  mefriendListTitles
} from '../../../../bc-extension/config/sharePointConfig';

import type {
  UnitService
} from '../../../services/units/unitService';

import type {
  BusinessPerformanceUnitAccessService,
  ICompanyUnitAssignment
} from '../../../services/access/businessPerformanceUnitAccessService';

interface IAppUserItem {
  Id?: number;
  ID?: number;
  Title?: string;
  Email?: string;
  IsActive?: boolean;
}

interface IUserRecord {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

interface IAssignmentDisplayRow {
  userId: number;
  name: string;
  email: string;
  isActive: boolean;
  unitNames: readonly string[];
}

interface IProps {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl: string;
  selectedCompanyId: string;
  unitService: UnitService;
  unitAccessService: BusinessPerformanceUnitAccessService;
}

export const BusinessPerformanceUnitAccessManager:
  React.FC<IProps> = ({
    pageContext,
    spHttpClient,
    webAbsoluteUrl,
    selectedCompanyId,
    unitService,
    unitAccessService
  }) => {
    const restClient = React.useMemo(
      () =>
        new SharePointRestClient({
          pageContext,
          spHttpClient,
          webAbsoluteUrl
        }),
      [
        pageContext,
        spHttpClient,
        webAbsoluteUrl
      ]
    );

    const [users, setUsers] =
      React.useState<readonly IUserRecord[]>([]);

    const [unitOptions, setUnitOptions] =
      React.useState<readonly ILookupOption[]>([]);

    const [selectedUserId, setSelectedUserId] =
      React.useState<string>('');

    const [selectedUnitIds, setSelectedUnitIds] =
      React.useState<readonly string[]>([]);

    const [companyAssignments, setCompanyAssignments] =
      React.useState<readonly ICompanyUnitAssignment[]>([]);

    const [loadingOptions, setLoadingOptions] =
      React.useState<boolean>(true);

    const [loadingAssignments, setLoadingAssignments] =
      React.useState<boolean>(false);

    const [assignmentsReady, setAssignmentsReady] =
      React.useState<boolean>(false);

    const [loadingList, setLoadingList] =
      React.useState<boolean>(false);

    const [saving, setSaving] =
      React.useState<boolean>(false);

    const [isDirty, setIsDirty] =
      React.useState<boolean>(false);

    const [reloadListKey, setReloadListKey] =
      React.useState<number>(0);

    const [error, setError] =
      React.useState<string>('');

    const [listError, setListError] =
      React.useState<string>('');

    const [message, setMessage] =
      React.useState<string>('');

    // Load App Users and Unit Master.
    React.useEffect(() => {
      let active = true;

      const loadOptions = async (): Promise<void> => {
        setLoadingOptions(true);
        setError('');

        try {
          const [userItems, unitItems] =
            await Promise.all([
              restClient.readItems<IAppUserItem>(
                mefriendListTitles.appUsers,
                {
                  select: [
                    'Id',
                    'Title',
                    'Email',
                    'IsActive'
                  ],
                  orderBy: 'Title asc'
                }
              ),
              unitService.getUnits()
            ]);

          if (!active) {
            return;
          }

          const mappedUsers: IUserRecord[] =
            userItems
              .map(item => {
                const id =
                  item.Id || item.ID || 0;

                return {
                  id,
                  name:
                    item.Title ||
                    item.Email ||
                    `User ${id}`,
                  email: item.Email || '',
                  isActive:
                    item.IsActive === true
                };
              })
              .filter(user =>
                Number.isSafeInteger(user.id) &&
                user.id > 0
              );

          setUsers(mappedUsers);

          setUnitOptions(
            unitItems
              .map(unit => ({
                key: String(unit.id),
                value: String(unit.id),
                text:
                  `${unit.unitName} (${unit.unitCode || unit.id})` +
                  (unit.isActive ? '' : ' - Inactive')
              }))
              .sort(
                (a, b) =>
                  a.text.localeCompare(b.text)
              )
          );
        } catch (loadError) {
          if (active) {
            setError(
              getUserFriendlyError(loadError)
            );
          }
        } finally {
          if (active) {
            setLoadingOptions(false);
          }
        }
      };

      void loadOptions();

      return () => {
        active = false;
      };
    }, [
      restClient,
      unitService
    ]);

    // Refresh the saved user-unit list.
    React.useEffect(() => {
      let active = true;

      const loadList = async (): Promise<void> => {
        setLoadingList(true);
        setListError('');
        setCompanyAssignments([]);

        if (!selectedCompanyId) {
          setLoadingList(false);
          return;
        }

        try {
          const assignments =
            await unitAccessService.getCompanyAssignments(
              selectedCompanyId
            );

          if (active) {
            setCompanyAssignments(assignments);
          }
        } catch (loadError) {
          if (active) {
            setListError(
              getUserFriendlyError(loadError)
            );
          }
        } finally {
          if (active) {
            setLoadingList(false);
          }
        }
      };

      void loadList();

      return () => {
        active = false;
      };
    }, [
      selectedCompanyId,
      unitAccessService,
      reloadListKey
    ]);

    // Load the selected user's currently saved units.
    React.useEffect(() => {
      let active = true;

      setSelectedUnitIds([]);
      setIsDirty(false);
      setAssignmentsReady(false);
      setMessage('');
      setError('');

      if (!selectedUserId || !selectedCompanyId) {
        setLoadingAssignments(false);

        return () => {
          active = false;
        };
      }

      const loadAssignedUnits =
        async (): Promise<void> => {
          setLoadingAssignments(true);

          try {
            const ids =
              await unitAccessService.getAssignedUnitIds(
                Number(selectedUserId),
                selectedCompanyId
              );

            if (active) {
              setSelectedUnitIds(
                ids.map(String)
              );
              setAssignmentsReady(true);
            }
          } catch (loadError) {
            if (active) {
              setError(
                getUserFriendlyError(loadError)
              );
            }
          } finally {
            if (active) {
              setLoadingAssignments(false);
            }
          }
        };

      void loadAssignedUnits();

      return () => {
        active = false;
      };
    }, [
      selectedUserId,
      selectedCompanyId,
      unitAccessService
    ]);

    const userOptions = React.useMemo<
      readonly ILookupOption[]
    >(
      () =>
        users
          .filter(user => user.isActive)
          .map(user => ({
            key: String(user.id),
            value: String(user.id),
            text: user.email
              ? `${user.name} (${user.email})`
              : user.name
          })),
      [users]
    );

    // Group saved assignments by user.
    const assignmentDisplayRows =
      React.useMemo<
        readonly IAssignmentDisplayRow[]
      >(() => {
        const userById =
          new Map<number, IUserRecord>();

        users.forEach(user => {
          userById.set(user.id, user);
        });

        const unitNameById =
          new Map<number, string>();

        unitOptions.forEach(option => {
          unitNameById.set(
            Number(option.value),
            option.text
          );
        });

        const unitsByUser =
          new Map<number, number[]>();

        companyAssignments.forEach(assignment => {
          const existing =
            unitsByUser.get(assignment.appUserId) || [];

          if (
            existing.indexOf(assignment.unitId) === -1
          ) {
            existing.push(assignment.unitId);
          }

          unitsByUser.set(
            assignment.appUserId,
            existing
          );
        });

        return Array.from(unitsByUser.keys())
          .map(userId => {
            const user = userById.get(userId);

            const unitIds =
              unitsByUser.get(userId) || [];

            const names = unitIds
              .map(id =>
                unitNameById.get(id) ||
                `Unit ID ${id}`
              )
              .sort(
                (a, b) =>
                  a.localeCompare(b)
              );

            return {
              userId,
              name:
                user?.name || `App User ID ${userId}`,
              email: user?.email || '',
              isActive: user?.isActive === true,
              unitNames: names
            };
          })
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
                undefined,
                { sensitivity: 'base' }
              )
          );
      }, [
        users,
        unitOptions,
        companyAssignments
      ]);

    const handleSave = async (): Promise<void> => {
      if (
        !selectedUserId ||
        !selectedCompanyId ||
        !assignmentsReady ||
        loadingAssignments ||
        loadingOptions ||
        saving
      ) {
        return;
      }

      setSaving(true);
      setError('');
      setMessage('');

      try {
        await unitAccessService.saveAssignments({
          appUserId: Number(selectedUserId),
          companyId: selectedCompanyId,
          unitIds: selectedUnitIds.map(Number)
        });

        const savedIds =
          await unitAccessService.getAssignedUnitIds(
            Number(selectedUserId),
            selectedCompanyId
          );

        setSelectedUnitIds(
          savedIds.map(String)
        );

        setIsDirty(false);

        // Reload list so changes appear immediately.
        setReloadListKey(
          previous => previous + 1
        );

        setMessage(
          'Unit permissions saved successfully.'
        );
      } catch (saveError) {
        setError(
          getUserFriendlyError(saveError)
        );
      } finally {
        setSaving(false);
      }
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          width: '100%',
          minWidth: 0
        }}
      >
        <section
          aria-label="User Unit Permissions"
          style={{
            background: '#fff',
            border: '1px solid #e6e3f0',
            borderRadius: 12,
            padding: 20
          }}
        >
          <h2 style={{ margin: '0 0 8px' }}>
            Unit Access
          </h2>

          <p
            style={{
              color: '#667085',
              fontSize: 13,
              margin: '0 0 20px'
            }}
          >
            Assign multiple units to an App User
            for the currently selected company.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(240px, 1fr))',
              alignItems: 'start',
              gap: 16
            }}
          >
            <Dropdown
              label="App User"
              value={selectedUserId}
              options={userOptions}
              searchable
              loading={loadingOptions}
              disabled={saving}
              placeholder="Search and select user"
              onChange={value => {
                setSelectedUserId(
                  typeof value === 'string'
                    ? value
                    : ''
                );
              }}
            />

            <Dropdown
              key={`${selectedCompanyId}:${selectedUserId}`}
              label="Allowed Units"
              values={selectedUnitIds}
              options={unitOptions}
              multiSelect
              searchable
              loading={loadingAssignments}
              placeholder="Search and select units"
              disabled={
                !selectedUserId ||
                !assignmentsReady ||
                loadingOptions ||
                loadingAssignments ||
                saving
              }
              onChange={value => {
                const next = Array.isArray(value)
                  ? value.filter(
                      (item): item is string =>
                        typeof item === 'string'
                    )
                  : [];

                setSelectedUnitIds(next);
                setIsDirty(true);
                setMessage('');
              }}
            />
          </div>

          {error ? (
            <p
              role="alert"
              style={{ color: '#b42318' }}
            >
              {error}
            </p>
          ) : null}

          {message ? (
            <p
              role="status"
              style={{ color: '#067647' }}
            >
              {message}
            </p>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <Button
              label="Save Unit Permissions"
              variant="primary"
              loading={saving}
              disabled={
                !selectedUserId ||
                !assignmentsReady ||
                loadingOptions ||
                loadingAssignments ||
                saving ||
                !isDirty ||
                Boolean(error)
              }
              onClick={() => {
                void handleSave();
              }}
            />
          </div>
        </section>

        {/* Saved user and unit assignment list */}
        <section
          aria-label="Assigned Unit Access List"
          style={{
            background: '#fff',
            border: '1px solid #e6e3f0',
            borderRadius: 12,
            padding: 20,
            minWidth: 0
          }}
        >
          <h3 style={{ margin: '0 0 6px' }}>
            Assigned Unit Access
          </h3>

          <p
            style={{
              color: '#667085',
              fontSize: 13,
              margin: '0 0 16px'
            }}
          >
            Saved user and unit assignments for
            the selected company.
          </p>

          {loadingOptions || loadingList ? (
            <p role="status">
              Loading user-unit assignments...
            </p>
          ) : listError ? (
            <p
              role="alert"
              style={{ color: '#b42318' }}
            >
              {listError}
            </p>
          ) : error && users.length === 0 ? (
            <p role="alert">
              Unable to load the App Users list.
            </p>
          ) : assignmentDisplayRows.length === 0 ? (
            <p style={{ color: '#667085' }}>
              No units have been assigned to users
              for this company.
            </p>
          ) : (
            <>
              <p
                style={{
                  color: '#475467',
                  fontSize: 12,
                  margin: '0 0 12px'
                }}
              >
                {assignmentDisplayRows.length}
                {' '}user(s) with assigned units
              </p>

              <div
                style={{
                  overflowX: 'auto',
                  width: '100%'
                }}
              >
                <table
                  style={{
                    width: '100%',
                    minWidth: 560,
                    borderCollapse: 'collapse',
                    fontSize: 13
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: '#f5f3fa',
                        textAlign: 'left'
                      }}
                    >
                      <th
                        scope="col"
                        style={{
                          padding: 12,
                          width: 50
                        }}
                      >
                        No.
                      </th>

                      <th
                        scope="col"
                        style={{ padding: 12 }}
                      >
                        App User
                      </th>

                      <th
                        scope="col"
                        style={{ padding: 12 }}
                      >
                        Assigned Units
                      </th>

                      <th
                        scope="col"
                        style={{
                          padding: 12,
                          width: 70
                        }}
                      >
                        Count
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {assignmentDisplayRows.map(
                      (row, index) => (
                        <tr
                          key={row.userId}
                          style={{
                            borderBottom:
                              '1px solid #eaecf0'
                          }}
                        >
                          <td
                            style={{
                              padding: 12,
                              verticalAlign: 'top'
                            }}
                          >
                            {index + 1}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              verticalAlign: 'top'
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 600
                              }}
                            >
                              {row.name}
                            </div>

                            {row.email ? (
                              <div
                                style={{
                                  color: '#667085',
                                  fontSize: 12,
                                  marginTop: 3
                                }}
                              >
                                {row.email}
                              </div>
                            ) : null}

                            {!row.isActive ? (
                              <div
                                style={{
                                  color: '#b42318',
                                  fontSize: 11,
                                  marginTop: 4
                                }}
                              >
                                Inactive or unavailable user
                              </div>
                            ) : null}
                          </td>

                          <td
                            style={{
                              padding: 12,
                              verticalAlign: 'top'
                            }}
                          >
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: 18
                              }}
                            >
                              {row.unitNames.map(
                                (unitName, unitIndex) => (
                                  <li
                                    key={`${row.userId}-${unitIndex}`}
                                    style={{
                                      marginBottom: 4
                                    }}
                                  >
                                    {unitName}
                                  </li>
                                )
                              )}
                            </ul>
                          </td>

                          <td
                            style={{
                              padding: 12,
                              verticalAlign: 'top',
                              fontWeight: 600
                            }}
                          >
                            {row.unitNames.length}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    );
  };
