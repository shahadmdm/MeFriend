export interface IVerticalListItem {
  id: number;
  companyId: string;
  verticalName: string;
  bcItemId?: string;
  isActive: boolean;
  verticalUniqueKey: string;
}

export interface IVerticalInput {
  companyId: string;
  verticalName: string;
  bcItemId: string;
  isActive: boolean;
}

export interface ISharePointVerticalItem {
  Id: number;
  Title?: string;
  CompanyId?: string;
  VerticalName?: string;
  BcItemId?: string;
  IsActive?: boolean;
  VerticalUniqueKey?: string;
}

export interface IVerticalFilters {
  searchText?: string;
  companyId?: string;
  isActive?: boolean;
}