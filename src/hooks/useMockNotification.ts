import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { showSuccess } from '../utils/errorUtil';
import { fetchGroups } from '../api';

/**
 * Hook to check if CDM methods are using mocks and show a success notification.
 * Checks the using_mocks flag from the groups API response.
 */
export function useMockNotification() {
  const { data } = useQuery({
    queryKey: ['mock-check'],
    queryFn: fetchGroups,
    staleTime: Infinity,
    retry: false
  });

  useEffect(() => {
    if (data?.using_mocks) {
      showSuccess('Tenant Data Browser is using mock data');
    }
  }, [data]);
}
