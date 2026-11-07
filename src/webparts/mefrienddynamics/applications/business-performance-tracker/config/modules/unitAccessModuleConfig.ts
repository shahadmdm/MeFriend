
import type {
  IModuleConfig
} from '../../../../shared/models/IModuleConfig';

export const unitAccessModuleConfig: IModuleConfig = {
  key: 'unitAccess',
  title: 'Unit Access',
  route: 'unit-access',
  icon: 'Permissions',
  description: 'Assign multiple business units to application users.',
  createEnabled: false,
  detailEnabled: false,
  order: 7,
  visible: true
};
