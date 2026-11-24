export interface IUnitListItem {
  id: number;
  unitName: string;
  unitCode: string;
  isActive: boolean;
}

export interface IUnitInput {
  unitName: string;
  unitCode: string;
  isActive: boolean;
}

export interface ISharePointUnitItem {
  Id: number;
  Title?: string;
  UnitName?: string;
  UnitCode?: string;
  IsActive?: boolean;
}

export interface IUnitFilters {
  searchText?: string;
  isActive?: boolean;
}