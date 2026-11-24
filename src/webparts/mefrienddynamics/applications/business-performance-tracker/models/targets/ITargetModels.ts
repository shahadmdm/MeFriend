export type TargetType = 'Unit' | 'Salesperson';

export interface ITargetListItem {
  id: number;
  companyId: string;
  targetType: TargetType;
  targetCode: string;
  targetName: string;
  verticalId: number;
  targetMonth: number;
  targetYear: number;
  targetAmount: number;
  isActive: boolean;
  unitCode: string;
  targetUniqueKey: string;
}

export interface ITargetInput {
  companyId: string;
  targetType: TargetType;
  targetCode: string;
  targetName: string;
  verticalId: number;
  targetMonth: number;
  targetYear: number;
  targetAmount: number;
  isActive: boolean;
  unitCode: string;
}

export interface ISharePointTargetItem {
  Id: number;
  Title?: string;
  CompanyId?: string;
  TargetType?: string;
  TargetCode?: string;
  TargetName?: string;
  VerticalId?: number;
  TargetMonth?: number;
  TargetYear?: number;
  TargetAmount?: number;
  IsActive?: boolean;
  UnitCode?: string;
  TargetUniqueKey?: string;
}

export interface ITargetFilters {
  searchText?: string;
  companyId?: string;
  targetType?: TargetType;
  isActive?: boolean;
}