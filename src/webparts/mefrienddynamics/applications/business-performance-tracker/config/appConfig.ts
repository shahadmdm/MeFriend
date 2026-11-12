export const appConfig = {
  appName: 'Business Performance Tracker',
  defaultRoutePath: 'verticals',

  // Backend API configuration.
  // Keep localhost during development.
  backendApiBaseUrl: 'https://localhost:7263',

  backendApi: {
    baseUrl: 'https://localhost:7263',
    anonymous: true,
    useAadHttpClient: false,
    aadResourceUrl: ''
  },

  // Existing SharePoint master data location.
  sharePointSettings: {
    masterDataWebUrl:
      'https://madhyamamgroup.sharepoint.com/sites/Me-Friend'
  }
} as const;
