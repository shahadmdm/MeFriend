// import * as React from 'react';

// import {
//   targetsModuleConfig
// } from '../../../config/modules/targetsModuleConfig';

// import type {
//   ITargetListItem
// } from '../../../models/targets';

// import type {
//   TargetService
// } from '../../../services/targets/targetService';

// import type {
//   ISortState,
//   SortDirection
// } from '../../../../../shared/models/ISortState';

// import {
//   EntityDashboard
// } from '../../../../../shared/components/dashboard/EntityDashboard';

// import type {
//   EntityFilterValues,
//   FilterValue
// } from '../../../../../shared/components/filters/EntityFilters';

// import {
//   getUserFriendlyError
// } from '../../../../../shared/api/apiErrorHandler';

// export interface ITargetPageProps {
//   targetService: TargetService;
//   selectedCompanyId?: string;
//   onNavigate: (path: string) => void;
// }

// export const TargetPage: React.FC<ITargetPageProps> = ({
//   targetService,
//   selectedCompanyId,
//   onNavigate
// }) => {
//   const [items, setItems] =
//     React.useState<readonly ITargetListItem[]>([]);

//   const [filterValues, setFilterValues] =
//     React.useState<EntityFilterValues>({});

//   const [appliedFilters, setAppliedFilters] =
//     React.useState<EntityFilterValues>({});

//   const [sorting, setSorting] =
//     React.useState<ISortState | undefined>();

//   const [loading, setLoading] =
//     React.useState<boolean>(true);

//   const [error, setError] =
//     React.useState<string | undefined>();

//   // Tracks the latest loading request.
//   // Prevents an older company request from
//   // overwriting the currently selected company's data.
//   const loadRequestIdRef = React.useRef<number>(0);

//   const loadTargets = React.useCallback(
//     async (): Promise<void> => {
//       const requestId = ++loadRequestIdRef.current;

//       setLoading(true);
//       setError(undefined);
//       setItems([]);

//       try {
//         // Preserve existing behavior until
//         // Company Gate integration.
//         //
//         // Once selectedCompanyId is provided,
//         // retrieve only that company's targets.
//         const records =
//           selectedCompanyId === undefined
//             ? await targetService.getTargets()
//             : await targetService.getTargetsByCompany(
//                 selectedCompanyId
//               );

//         if (requestId === loadRequestIdRef.current) {
//           setItems(records);
//         }
//       } catch (loadError) {
//         if (requestId === loadRequestIdRef.current) {
//           setItems([]);
//           setError(getUserFriendlyError(loadError));
//         }
//       } finally {
//         if (requestId === loadRequestIdRef.current) {
//           setLoading(false);
//         }
//       }
//     },
//     [targetService, selectedCompanyId]
//   );

//   React.useEffect(() => {
//     loadTargets().catch(() => undefined);

//     return () => {
//       // Invalidate pending requests when
//       // the page unmounts or company changes.
//       loadRequestIdRef.current += 1;
//     };
//   }, [loadTargets]);

//   // The Company filter is unnecessary once the
//   // user has selected a company at application entry.
//   const visibleFilters = React.useMemo(() => {
//     const configuredFilters =
//       targetsModuleConfig.filters || [];

//     if (selectedCompanyId === undefined) {
//       return configuredFilters;
//     }

//     return configuredFilters.filter(
//       filter => filter.key !== 'companyId'
//     );
//   }, [selectedCompanyId]);

//   const filteredItems = React.useMemo(() => {
//     const searchText =
//       typeof appliedFilters.searchText === 'string'
//         ? appliedFilters.searchText.trim().toLowerCase()
//         : '';

//     // Only use the old Company filter before
//     // the Company Gate is connected.
//     const companyId =
//       selectedCompanyId === undefined &&
//       typeof appliedFilters.companyId === 'string'
//         ? appliedFilters.companyId
//         : '';

//     const targetType =
//       typeof appliedFilters.targetType === 'string'
//         ? appliedFilters.targetType
//         : '';

//     const status =
//       typeof appliedFilters.status === 'string'
//         ? appliedFilters.status
//         : '';

//     return items.filter(item => {
//       // Additional UI-level company verification.
//       // This does not replace SharePoint authorization.
//       const matchesSelectedCompany =
//         selectedCompanyId === undefined ||
//         item.companyId === selectedCompanyId;

//       const matchesSearch =
//         !searchText ||
//         item.targetName.toLowerCase().includes(searchText) ||
//         item.targetCode.toLowerCase().includes(searchText) ||
//         item.unitCode.toLowerCase().includes(searchText);

//       const matchesCompany =
//         !companyId ||
//         item.companyId === companyId;

//       const matchesType =
//         !targetType ||
//         item.targetType === targetType;

//       const matchesStatus =
//         !status ||
//         (status === 'active' && item.isActive) ||
//         (status === 'inactive' && !item.isActive);

//       return (
//         matchesSelectedCompany &&
//         matchesSearch &&
//         matchesCompany &&
//         matchesType &&
//         matchesStatus
//       );
//     });
//   }, [
//     items,
//     appliedFilters,
//     selectedCompanyId
//   ]);

//   const sortedItems = React.useMemo(() => {
//     if (!sorting) {
//       return filteredItems;
//     }

//     return [...filteredItems].sort((left, right) => {
//       const leftValue =
//         left[sorting.fieldName as keyof ITargetListItem];

//       const rightValue =
//         right[sorting.fieldName as keyof ITargetListItem];

//       let comparison: number;

//       if (
//         typeof leftValue === 'number' &&
//         typeof rightValue === 'number'
//       ) {
//         comparison = leftValue - rightValue;
//       } else {
//         comparison = String(leftValue ?? '').localeCompare(
//           String(rightValue ?? ''),
//           undefined,
//           {
//             sensitivity: 'base',
//             numeric: true
//           }
//         );
//       }

//       return sorting.direction === 'asc'
//         ? comparison
//         : -comparison;
//     });
//   }, [filteredItems, sorting]);

//   const handleFilterChange = React.useCallback(
//     (
//       key: string,
//       value: FilterValue
//     ): void => {
//       setFilterValues(current => ({
//         ...current,
//         [key]: value
//       }));
//     },
//     []
//   );

//   const handleFilterApply = React.useCallback(
//     (): void => {
//       setAppliedFilters({ ...filterValues });
//     },
//     [filterValues]
//   );

//   const handleFilterClear = React.useCallback(
//     (): void => {
//       setFilterValues({});
//       setAppliedFilters({});
//     },
//     []
//   );

//   const handleSort = React.useCallback(
//     (
//       fieldName: string,
//       direction?: SortDirection
//     ): void => {
//       setSorting(
//         direction
//           ? { fieldName, direction }
//           : undefined
//       );
//     },
//     []
//   );

//   const navigateToEdit = React.useCallback(
//     (item: ITargetListItem): void => {
//       // Avoid navigating to a target belonging
//       // to a different company.
//       if (
//         selectedCompanyId !== undefined &&
//         item.companyId !== selectedCompanyId
//       ) {
//         return;
//       }

//       onNavigate(
//         `${targetsModuleConfig.route}/edit/${encodeURIComponent(String(item.id))}`
//       );
//     },
//     [onNavigate, selectedCompanyId]
//   );

//   return (
//     <EntityDashboard<ITargetListItem>
//       title={targetsModuleConfig.title}
//       subtitle={targetsModuleConfig.description}
//       columns={targetsModuleConfig.tableColumns || []}
//       filters={visibleFilters}
//       filterValues={filterValues}
//       items={sortedItems}
//       loading={loading}
//       error={error}
//       createButton={{
//         label: 'Add Target',
//         visible: true
//       }}
//       onCreate={() =>
//         onNavigate(`${targetsModuleConfig.route}/create`)
//       }
//       rowActions={[
//         {
//           key: 'edit',
//           label: 'Edit',
//           icon: 'edit',
//           onClick: navigateToEdit
//         }
//       ]}
//       onFilterChange={handleFilterChange}
//       onFilterApply={handleFilterApply}
//       onFilterClear={handleFilterClear}
//       sorting={sorting}
//       onSort={handleSort}
//       getRowKey={item => String(item.id)}
//       emptyTitle="No targets found"
//       emptyMessage="No performance targets match the selected filters."
//     />
//   );
// };





import * as React from 'react';

import {
  targetsModuleConfig
} from '../../../config/modules/targetsModuleConfig';

import type {
  ITargetListItem
} from '../../../models/targets';

import type {
  TargetService
} from '../../../services/targets/targetService';

import type {
  ISortState,
  SortDirection
} from '../../../../../shared/models/ISortState';

import type {
  IPaginationState
} from '../../../../../shared/models/IPaginationState';

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

const PAGE_SIZE = 10;

export interface ITargetPageProps {
  targetService: TargetService;
  selectedCompanyId?: string;
  onNavigate: (path: string) => void;
}

export const TargetPage: React.FC<ITargetPageProps> = ({
  targetService,
  selectedCompanyId,
  onNavigate
}) => {
  const [items, setItems] =
    React.useState<readonly ITargetListItem[]>([]);

  const [filterValues, setFilterValues] =
    React.useState<EntityFilterValues>({});

  const [appliedFilters, setAppliedFilters] =
    React.useState<EntityFilterValues>({});

  const [sorting, setSorting] =
    React.useState<ISortState | undefined>();

  const [pageNumber, setPageNumber] =
    React.useState<number>(1);

  const [loading, setLoading] =
    React.useState<boolean>(true);

  const [error, setError] =
    React.useState<string | undefined>();

  const loadRequestIdRef = React.useRef<number>(0);

  const loadTargets = React.useCallback(
    async (): Promise<void> => {
      const requestId = ++loadRequestIdRef.current;

      setLoading(true);
      setError(undefined);
      setItems([]);

      try {
        const records =
          selectedCompanyId === undefined
            ? await targetService.getTargets()
            : await targetService.getTargetsByCompany(
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
    [targetService, selectedCompanyId]
  );

  React.useEffect(() => {
    loadTargets().catch(() => undefined);

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadTargets]);

  // Return to the first page when company changes.
  React.useEffect(() => {
    setPageNumber(1);
  }, [selectedCompanyId]);

  // Hide the Company filter after company selection.
  const visibleFilters = React.useMemo(() => {
    const configuredFilters =
      targetsModuleConfig.filters || [];

    if (selectedCompanyId === undefined) {
      return configuredFilters;
    }

    return configuredFilters.filter(
      filter => filter.key !== 'companyId'
    );
  }, [selectedCompanyId]);

  // Apply filters to the complete record collection.
  const filteredItems = React.useMemo(() => {
    const searchText =
      typeof appliedFilters.searchText === 'string'
        ? appliedFilters.searchText.trim().toLowerCase()
        : '';

    const companyId =
      selectedCompanyId === undefined &&
      typeof appliedFilters.companyId === 'string'
        ? appliedFilters.companyId
        : '';

    const targetType =
      typeof appliedFilters.targetType === 'string'
        ? appliedFilters.targetType
        : '';

    const status =
      typeof appliedFilters.status === 'string'
        ? appliedFilters.status
        : '';

    return items.filter(item => {
      const matchesSelectedCompany =
        selectedCompanyId === undefined ||
        item.companyId === selectedCompanyId;

      const matchesSearch =
        !searchText ||
        item.targetName.toLowerCase().includes(searchText) ||
        item.targetCode.toLowerCase().includes(searchText) ||
        item.unitCode.toLowerCase().includes(searchText);

      const matchesCompany =
        !companyId ||
        item.companyId === companyId;

      const matchesType =
        !targetType ||
        item.targetType === targetType;

      const matchesStatus =
        !status ||
        (status === 'active' && item.isActive) ||
        (status === 'inactive' && !item.isActive);

      return (
        matchesSelectedCompany &&
        matchesSearch &&
        matchesCompany &&
        matchesType &&
        matchesStatus
      );
    });
  }, [
    items,
    appliedFilters,
    selectedCompanyId
  ]);

  // Sort all filtered records before pagination.
  const sortedItems = React.useMemo(() => {
    if (!sorting) {
      return filteredItems;
    }

    return [...filteredItems].sort((left, right) => {
      const leftValue =
        left[sorting.fieldName as keyof ITargetListItem];

      const rightValue =
        right[sorting.fieldName as keyof ITargetListItem];

      let comparison: number;

      if (
        typeof leftValue === 'number' &&
        typeof rightValue === 'number'
      ) {
        comparison = leftValue - rightValue;
      } else {
        comparison = String(leftValue ?? '').localeCompare(
          String(rightValue ?? ''),
          undefined,
          {
            sensitivity: 'base',
            numeric: true
          }
        );
      }

      return sorting.direction === 'asc'
        ? comparison
        : -comparison;
    });
  }, [filteredItems, sorting]);

  // Keep the current page within the available range.
  const totalPages = Math.max(
    1,
    Math.ceil(sortedItems.length / PAGE_SIZE)
  );

  const currentPage = Math.min(
    Math.max(1, pageNumber),
    totalPages
  );

  // Pagination metadata for the shared EntityTable.
  const pagination = React.useMemo<IPaginationState>(
    () => ({
      pageNumber: currentPage,
      pageSize: PAGE_SIZE,
      totalCount: sortedItems.length
    }),
    [currentPage, sortedItems.length]
  );

  // Pass only the current page's records to the table.
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return sortedItems.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [sortedItems, currentPage]);

  const handlePageChange = React.useCallback(
    (nextPage: number): void => {
      if (!Number.isInteger(nextPage)) {
        return;
      }

      setPageNumber(
        Math.min(Math.max(1, nextPage), totalPages)
      );
    },
    [totalPages]
  );

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
      setPageNumber(1);
      setAppliedFilters({ ...filterValues });
    },
    [filterValues]
  );

  const handleFilterClear = React.useCallback(
    (): void => {
      setPageNumber(1);
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
      setPageNumber(1);

      setSorting(
        direction
          ? { fieldName, direction }
          : undefined
      );
    },
    []
  );

  const navigateToEdit = React.useCallback(
    (item: ITargetListItem): void => {
      if (
        selectedCompanyId !== undefined &&
        item.companyId !== selectedCompanyId
      ) {
        return;
      }

      onNavigate(
        `${targetsModuleConfig.route}/edit/${encodeURIComponent(String(item.id))}`
      );
    },
    [onNavigate, selectedCompanyId]
  );

  return (
    <EntityDashboard<ITargetListItem>
      title={targetsModuleConfig.title}
      subtitle={targetsModuleConfig.description}
      columns={targetsModuleConfig.tableColumns || []}
      filters={visibleFilters}
      filterValues={filterValues}
      items={paginatedItems}
      loading={loading}
      error={error}
      createButton={{
        label: 'Add Target',
        visible: true
      }}
      onCreate={() =>
        onNavigate(`${targetsModuleConfig.route}/create`)
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
      pagination={pagination}
      onPageChange={handlePageChange}
      sorting={sorting}
      onSort={handleSort}
      getRowKey={item => String(item.id)}
      emptyTitle="No targets found"
      emptyMessage="No performance targets match the selected filters."
    />
  );
};