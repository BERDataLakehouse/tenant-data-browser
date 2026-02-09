import { useEffect } from 'react';
import { PageConfig } from '@jupyterlab/coreutils';
import { showSuccess } from '../utils/errorUtil';

/**
 * Hook to check if CDM methods are using mocks and show a notification.
 * Reads the static page config value injected by the server extension.
 */
export function useMockNotification() {
  useEffect(() => {
    if (PageConfig.getOption('tenantDataBrowserUsingMocks') === 'true') {
      showSuccess('Tenant Data Browser is using mock data');
    }
  }, []);
}
