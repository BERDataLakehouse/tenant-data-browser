/**
 * API client for the Tenant Data Browser server extension.
 *
 * Communicates with the Python server extension endpoints
 * instead of executing code on a kernel.
 */

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

const API_BASE = 'api/tenant-data-browser';

/** Response from the groups endpoint */
export interface IGroupsResponse {
  username: string;
  groups: string[];
  group_count: number;
}

/** Namespace prefix info */
export interface INamespacePrefixResponse {
  username: string;
  user_namespace_prefix: string;
  tenant: string | null;
  tenant_namespace_prefix: string | null;
}

/** Response from the databases endpoint */
export interface IDatabasesResponse {
  databases: string[];
  prefix: INamespacePrefixResponse;
}

/** Error response from server */
interface IErrorResponse {
  error: string;
}

/**
 * Make an authenticated GET request to the server extension.
 */
async function serverGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  const settings = ServerConnection.makeSettings();
  let requestUrl = URLExt.join(settings.baseUrl, API_BASE, path);
  if (params) {
    const paramStr = params.toString();
    if (paramStr) {
      requestUrl += '?' + paramStr;
    }
  }

  const response = await ServerConnection.makeRequest(requestUrl, {}, settings);

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as IErrorResponse;
      if (data.error) {
        message = data.error;
      }
    } catch {
      // Response body is not JSON (e.g., HTML from a proxy error)
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch user's groups.
 */
export async function fetchGroups(): Promise<IGroupsResponse> {
  return serverGet<IGroupsResponse>('groups');
}

/**
 * Fetch databases with namespace prefix info.
 * @param tenant - Optional tenant name to get tenant-specific prefix
 */
export async function fetchDatabases(
  tenant?: string
): Promise<IDatabasesResponse> {
  const params = new URLSearchParams();
  if (tenant !== undefined) {
    params.set('tenant', tenant);
  }
  return serverGet<IDatabasesResponse>('databases', params);
}

/**
 * Fetch tables for a database.
 * @param database - Database name
 */
export async function fetchTables(database: string): Promise<string[]> {
  const params = new URLSearchParams({ database });
  return serverGet<string[]>('tables', params);
}

/**
 * Fetch column schema for a table.
 * @param database - Database name
 * @param table - Table name
 */
export async function fetchSchema(
  database: string,
  table: string
): Promise<string[]> {
  const params = new URLSearchParams({ database, table });
  return serverGet<string[]>('schema', params);
}

/**
 * Fetch namespace prefix info.
 * @param tenant - Optional tenant name
 */
export async function fetchNamespacePrefix(
  tenant?: string
): Promise<INamespacePrefixResponse> {
  const params = new URLSearchParams();
  if (tenant !== undefined) {
    params.set('tenant', tenant);
  }
  return serverGet<INamespacePrefixResponse>('namespace-prefix', params);
}
