/**
 * Tenant Tab Command and Types
 *
 * This module defines the command ID and types for opening tenant tabs.
 * Import from here in both index.ts (to register) and providers (to execute).
 */

/** Command ID for opening tenant tabs */
export const CMD_OPEN_TAB = 'tenant-data-browser:open-tab';

/** Target for opening tenant tab */
export type TenantTabTarget =
  | { type: 'tenant'; tenant?: string }
  | { type: 'database'; databaseName: string; tenant?: string }
  | { type: 'table'; tableName: string; databaseName: string; tenant?: string };

/** Function signature for updating selection in an existing tab */
export type UpdateTenantTabSelectionFn = (target: TenantTabTarget) => void;
