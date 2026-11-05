export type AppRouteKey =
  | 'verticals'
  | 'verticalCreate'
  | 'verticalEdit'
  | 'units'
  | 'unitCreate'
  | 'unitEdit'
  | 'targets'
  | 'targetCreate'
  | 'targetEdit'
  | 'collectionReport';

export interface IAppRouteDefinition {
  key: AppRouteKey;
  path: string;
  title: string;
  moduleKey: string;
  showInNavigation: boolean;
}

export interface IResolvedRoute extends IAppRouteDefinition {
  params: IReadonlyRouteParams;
}

export interface IReadonlyRouteParams {
  readonly id?: string;
}