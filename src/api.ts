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
 * Fetch databases filtered by namespace prefix.
 * @param tenant - Optional tenant name to filter by tenant namespace
 */
export async function fetchDatabases(tenant?: string): Promise<string[]> {
  const params = new URLSearchParams();
  if (tenant !== undefined) {
    params.set('tenant', tenant);
  }
  return serverGet<string[]>('databases', params);
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
