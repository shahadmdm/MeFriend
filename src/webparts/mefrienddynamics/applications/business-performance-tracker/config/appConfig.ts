export const appConfig = {
  appName: 'Business Performance Tracker',
  defaultRoutePath: 'verticals',

  // Backend API configuration.
  backendApiBaseUrl: 'https://bc-api01.mefriend.com',

  backendApi: {
    baseUrl: 'https://bc-api01.mefriend.com',
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
