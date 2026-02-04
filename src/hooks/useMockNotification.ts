import { useEffect } from 'react';
import { SessionContext } from '@jupyterlab/apputils';
import { showSuccess } from '../utils/errorUtil';
import { queryKernel } from '../components/kernelCommunication';

const BERDL_METHODS_IMPORT =
  'import tenant_data_browser; (get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, using_mocks) = tenant_data_browser.get_cdm_methods();';

/**
 * Hook to check if CDM methods are using mocks and show a success notification
 */
export function useMockNotification(
  sessionContext: SessionContext | null | undefined
) {
  useEffect(() => {
    const checkMockUsage = async () => {
      if (!sessionContext) {
        return;
      }

      try {
        const { data, error } = await queryKernel(
          `${BERDL_METHODS_IMPORT} using_mocks`,
          sessionContext
        );

        if (error) {
          console.warn('Failed to check mock usage:', error);
          return;
        }

        if (
          data?.data &&
          typeof data.data === 'object' &&
          data.data !== null &&
          'text/plain' in data.data
        ) {
          const textOutput = data.data['text/plain'] as string;
          if (textOutput && textOutput.trim() === 'True') {
            showSuccess('Tenant Data Browser is using mock data');
          }
        }
      } catch (error) {
        console.warn('Error checking mock usage:', error);
      }
    };

    checkMockUsage();
  }, [sessionContext]);
}
