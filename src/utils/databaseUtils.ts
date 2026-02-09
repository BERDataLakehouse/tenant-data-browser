import { fetchDatabases } from '../api';

/**
 * Fetches databases filtered by namespace prefix via server API.
 * @param tenant - Tenant name, or undefined for user databases
 * @returns Promise resolving to array of database names matching the namespace prefix
 */
export async function fetchFilteredDatabases(
  tenant: string | undefined
): Promise<string[]> {
  const response = await fetchDatabases(tenant);

  if (!response?.databases) {
    return [];
  }

  const prefix =
    tenant === undefined
      ? response.prefix.user_namespace_prefix
      : response.prefix.tenant_namespace_prefix;

  return prefix ? response.databases.filter(db => db.startsWith(prefix)) : [];
}
