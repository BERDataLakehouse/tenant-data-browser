import { SessionContext } from '@jupyterlab/apputils';
import {
  queryKernel,
  parseKernelOutputJSON
} from '../components/kernelCommunication';

const BERDL_METHODS_IMPORT =
  'import tenant_data_browser; (get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, using_mocks) = tenant_data_browser.get_cdm_methods();';

interface INamespacePrefixResponse {
  username: string;
  user_namespace_prefix: string;
  tenant: string | null;
  tenant_namespace_prefix: string | null;
}

/**
 * Fetches databases filtered by namespace prefix (single kernel call).
 * @param sessionContext - Jupyter kernel session
 * @param tenant - Tenant name, or undefined for user databases
 * @returns Promise resolving to array of database names matching the namespace prefix
 */
export async function fetchFilteredDatabases(
  sessionContext: SessionContext,
  tenant: string | undefined
): Promise<string[]> {
  const tenantParam = tenant === undefined ? 'None' : `"${tenant}"`;

  const { data, error } = await queryKernel(
    `import json; ${BERDL_METHODS_IMPORT} databases = get_databases(use_hms=True, return_json=False, filter_by_namespace=True); prefix_response = get_namespace_prefix(tenant=${tenantParam}, return_json=False); result = {"databases": databases, "prefix": prefix_response}; json.dumps(result)`,
    sessionContext
  );

  if (error) {
    throw error;
  }

  const response = parseKernelOutputJSON<{
    databases: string[];
    prefix: INamespacePrefixResponse;
  }>(data);

  if (!response?.databases) {
    return [];
  }

  const prefix =
    tenant === undefined
      ? response.prefix.user_namespace_prefix
      : response.prefix.tenant_namespace_prefix;

  return prefix ? response.databases.filter(db => db.startsWith(prefix)) : [];
}
