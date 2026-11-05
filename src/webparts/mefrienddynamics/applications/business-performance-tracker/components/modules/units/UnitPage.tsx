
import * as React from 'react';

import {
  unitsModuleConfig
} from '../../../config/modules/unitsModuleConfig';

import type {
  IUnitListItem
} from '../../../models/units';

import type {
  UnitService
} from '../../../services/units/unitService';

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

export interface IUnitPageProps {
  unitService: UnitService;
  onNavigate: (path: string) => void;
}

export const UnitPage: React.FC<IUnitPageProps> = ({
  unitService,
  onNavigate
}) => {
  const [items, setItems] = React.useState<readonly IUnitListItem[]>([]);
  const [filterValues, setFilterValues] = React.useState<EntityFilterValues>({});
  const [appliedFilters, setAppliedFilters] = React.useState<EntityFilterValues>({});
  const [sorting, setSorting] = React.useState<ISortState | undefined>();
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | undefined>();

  const loadUnits = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);

    try {
      const records = await unitService.getUnits();
      setItems(records);
    } catch (loadError) {
      setItems([]);
      setError(getUserFriendlyError(loadError));
    } finally {
      setLoading(false);
    }
  }, [unitService]);

  React.useEffect(() => {
    loadUnits().catch(() => undefined);
  }, [loadUnits]);

  const filteredItems = React.useMemo(() => {
    const searchText =
      typeof appliedFilters.searchText === 'string'
        ? appliedFilters.searchText.trim().toLowerCase()
        : '';

    const status =
      typeof appliedFilters.status === 'string'
        ? appliedFilters.status
        : '';

    return items.filter(item => {
      const matchesSearch =
        !searchText ||
        item.unitName.toLowerCase().indexOf(searchText) !== -1 ||
        item.unitCode.toLowerCase().indexOf(searchText) !== -1;

      const matchesStatus =
        !status ||
        (status === 'active' && item.isActive) ||
        (status === 'inactive' && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [items, appliedFilters]);

  const sortedItems = React.useMemo(() => {
    if (!sorting) {
      return filteredItems;
    }

    return [...filteredItems].sort((left, right) => {
      const leftValue = left[
        sorting.fieldName as keyof IUnitListItem
      ];

      const rightValue = right[
        sorting.fieldName as keyof IUnitListItem
      ];

      const comparison = String(leftValue ?? '').localeCompare(
        String(rightValue ?? ''),
        undefined,
        { sensitivity: 'base', numeric: true }
      );

      return sorting.direction === 'asc'
        ? comparison
        : -comparison;
    });
  }, [filteredItems, sorting]);

  const handleFilterChange = React.useCallback((
    key: string,
    value: FilterValue
  ): void => {
    setFilterValues(current => ({
      ...current,
      [key]: value
    }));
  }, []);

  const handleFilterApply = React.useCallback((): void => {
    setAppliedFilters({ ...filterValues });
  }, [filterValues]);

  const handleFilterClear = React.useCallback((): void => {
    setFilterValues({});
    setAppliedFilters({});
  }, []);

  const handleSort = React.useCallback((
    fieldName: string,
    direction?: SortDirection
  ): void => {
    setSorting(
      direction ? { fieldName, direction } : undefined
    );
  }, []);

  const navigateToEdit = React.useCallback((
    item: IUnitListItem
  ): void => {
    onNavigate(
      `${unitsModuleConfig.route}/edit/${encodeURIComponent(String(item.id))}`
    );
  }, [onNavigate]);

  return (
    <EntityDashboard<IUnitListItem>
      title={unitsModuleConfig.title}
      subtitle={unitsModuleConfig.description}
      columns={unitsModuleConfig.tableColumns || []}
      filters={unitsModuleConfig.filters || []}
      filterValues={filterValues}
      items={sortedItems}
      loading={loading}
      error={error}
      createButton={{
        label: 'Add Unit',
        visible: true
      }}
      onCreate={() =>
        onNavigate(`${unitsModuleConfig.route}/create`)
      }
      rowActions={[
        {
          key: 'edit',
          label: 'Edit',
          icon: 'edit',
          onClick: navigateToEdit
        }
      ]}
      onFilterChange={handleFilterChange}
      onFilterApply={handleFilterApply}
      onFilterClear={handleFilterClear}
      sorting={sorting}
      onSort={handleSort}
      getRowKey={item => String(item.id)}
      emptyTitle="No units found"
      emptyMessage="No business unit records match the selected filters."
    />
  );
};
