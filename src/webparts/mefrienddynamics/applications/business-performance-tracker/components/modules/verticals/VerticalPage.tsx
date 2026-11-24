import * as React from 'react';

import {
  verticalsModuleConfig
} from '../../../config/modules/verticalsModuleConfig';

import type {
  IVerticalListItem
} from '../../../models/verticals';

import type {
  VerticalService
} from '../../../services/verticals/verticalService';

import type {
  ISortState,
  SortDirection
} from '../../../../../shared/models/ISortState';

import {
  EntityDashboard
} from '../../../../../shared/components/dashboard/EntityDashboard';

import type {
  EntityFilterValues,
  FilterValue
} from '../../../../../shared/components/filters/EntityFilters';

import {
  getUserFriendlyError
} from '../../../../../shared/api/apiErrorHandler';

export interface IVerticalPageProps {
  verticalService: VerticalService;
  selectedCompanyId?: string;
  onNavigate: (path: string) => void;

  /**
   * Permission to create Vertical records.
   *
   * Optional for backward compatibility.
   * App.tsx will supply the actual permission.
   */
  canCreate?: boolean;

  /**
   * Permission to manage/edit Vertical records.
   *
   * Optional for backward compatibility.
   * App.tsx will supply the actual permission.
   */
  canManage?: boolean;
}

export const VerticalPage: React.FC<IVerticalPageProps> = ({
  verticalService,
  selectedCompanyId,
  onNavigate,
  canCreate = true,
  canManage = true
}) => {
  const [items, setItems] =
    React.useState<readonly IVerticalListItem[]>([]);

  const [filterValues, setFilterValues] =
    React.useState<EntityFilterValues>({});

  const [appliedFilters, setAppliedFilters] =
    React.useState<EntityFilterValues>({});

  const [sorting, setSorting] =
    React.useState<ISortState | undefined>();

  const [loading, setLoading] =
    React.useState<boolean>(true);

  const [error, setError] =
    React.useState<string | undefined>();

  const loadRequestIdRef = React.useRef<number>(0);

  const loadVerticals = React.useCallback(
    async (): Promise<void> => {
      const requestId = ++loadRequestIdRef.current;

      setLoading(true);
      setError(undefined);
      setItems([]);

      try {
        // Preserve existing development behavior
        // when no selected company is supplied.
        //
        // With a selected company, retrieve only
        // that company's vertical records.
        const records =
          selectedCompanyId === undefined
            ? await verticalService.getVerticals()
            : await verticalService.getVerticalsByCompany(
                selectedCompanyId
              );

        if (requestId === loadRequestIdRef.current) {
          setItems(records);
        }
      } catch (loadError) {
        if (requestId === loadRequestIdRef.current) {
          setItems([]);
          setError(getUserFriendlyError(loadError));
        }
      } finally {
        if (requestId === loadRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [verticalService, selectedCompanyId]
  );

  React.useEffect(() => {
    loadVerticals().catch(() => undefined);

    return () => {
      // Ignore results from a previous company
      // or an unmounted page.
      loadRequestIdRef.current += 1;
    };
  }, [loadVerticals]);

  const filteredItems = React.useMemo(() => {
    const searchText =
      typeof appliedFilters.searchText === 'string'
        ? appliedFilters.searchText.trim().toLowerCase()
        : '';

    const companyId =
      typeof appliedFilters.companyId === 'string'
        ? appliedFilters.companyId
        : '';

    const status =
      typeof appliedFilters.status === 'string'
        ? appliedFilters.status
        : '';

    return items.filter(item => {
      // Additional display-level protection.
      // This is not a substitute for SharePoint
      // authorization.
      const matchesSelectedCompany =
        selectedCompanyId === undefined ||
        item.companyId === selectedCompanyId;

      const matchesSearch =
        !searchText ||
        item.verticalName
          .toLowerCase()
          .indexOf(searchText) !== -1;

      const matchesCompany =
        !companyId ||
        item.companyId === companyId;

      const matchesStatus =
        !status ||
        (status === 'active' && item.isActive) ||
        (status === 'inactive' && !item.isActive);

      return (
        matchesSelectedCompany &&
        matchesSearch &&
        matchesCompany &&
        matchesStatus
      );
    });
  }, [items, appliedFilters, selectedCompanyId]);

  const sortedItems = React.useMemo(() => {
    if (!sorting) {
      return filteredItems;
    }

    return [...filteredItems].sort((left, right) => {
      const leftValue = left[
        sorting.fieldName as keyof IVerticalListItem
      ];

      const rightValue = right[
        sorting.fieldName as keyof IVerticalListItem
      ];

      const comparison = String(
        leftValue ?? ''
      ).localeCompare(
        String(rightValue ?? ''),
        undefined,
        {
          sensitivity: 'base',
          numeric: true
        }
      );

      return sorting.direction === 'asc'
        ? comparison
        : -comparison;
    });
  }, [filteredItems, sorting]);

  const handleFilterChange = React.useCallback(
    (
      key: string,
      value: FilterValue
    ): void => {
      setFilterValues(current => ({
        ...current,
        [key]: value
      }));
    },
    []
  );

  const handleFilterApply = React.useCallback(
    (): void => {
      setAppliedFilters({ ...filterValues });
    },
    [filterValues]
  );

  const handleFilterClear = React.useCallback(
    (): void => {
      setFilterValues({});
      setAppliedFilters({});
    },
    []
  );

  const handleSort = React.useCallback(
    (
      fieldName: string,
      direction?: SortDirection
    ): void => {
      setSorting(
        direction
          ? { fieldName, direction }
          : undefined
      );
    },
    []
  );

  const navigateToCreate = React.useCallback(
    (): void => {
      // Do not navigate if Create is not allowed.
      if (!canCreate) {
        return;
      }

      onNavigate(
        `${verticalsModuleConfig.route}/create`
      );
    },
    [onNavigate, canCreate]
  );

  const navigateToEdit = React.useCallback(
    (item: IVerticalListItem): void => {
      // Do not navigate if Manage is not allowed.
      if (!canManage) {
        return;
      }

      // Do not navigate to a different company's
      // vertical when a company is selected.
      if (
        selectedCompanyId !== undefined &&
        item.companyId !== selectedCompanyId
      ) {
        return;
      }

      onNavigate(
        `${verticalsModuleConfig.route}/edit/${encodeURIComponent(String(item.id))}`
      );
    },
    [onNavigate, selectedCompanyId, canManage]
  );

  return (
    <EntityDashboard<IVerticalListItem>
      title={verticalsModuleConfig.title}
      subtitle={verticalsModuleConfig.description}
      columns={verticalsModuleConfig.tableColumns || []}
      filters={verticalsModuleConfig.filters || []}
      filterValues={filterValues}
      items={sortedItems}
      loading={loading}
      error={error}
      createButton={{
        label: 'Add Vertical',
        visible: canCreate
      }}
      onCreate={navigateToCreate}
      rowActions={
        canManage
          ? [
              {
                key: 'edit',
                label: 'Edit',
                icon: 'edit',
                onClick: navigateToEdit
              }
            ]
          : []
      }
      onFilterChange={handleFilterChange}
      onFilterApply={handleFilterApply}
      onFilterClear={handleFilterClear}
      sorting={sorting}
      onSort={handleSort}
      getRowKey={item => String(item.id)}
      emptyTitle="No verticals found"
      emptyMessage="No business vertical records match the selected filters."
    />
  );
};