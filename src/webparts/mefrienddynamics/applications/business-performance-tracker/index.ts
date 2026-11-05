
import type { IPortalApplication } from '../../portal/config/applications';

import { appConfig } from './config/appConfig';
import { businessPerformanceApplicationConfig } from './config/applicationConfig';
import { moduleDefinitions } from './config/moduleConfig';
import { App } from './components/App/App';

export const businessPerformanceTrackerApplication: IPortalApplication = {
  ...businessPerformanceApplicationConfig,
  defaultPath: appConfig.defaultRoutePath,
  enabled: true,
  legacyPathRoots: moduleDefinitions.map(
    moduleDefinition => moduleDefinition.route
  ),
  component: App
};
