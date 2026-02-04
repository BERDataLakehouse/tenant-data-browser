import React from 'react';
import { SessionContext } from '@jupyterlab/apputils';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDatabase,
  faTable,
  faUserCircle,
  faUsers,
  faArrowUpRightFromSquare,
  faCode,
  faCopy
} from '@fortawesome/free-solid-svg-icons';
import { BaseTreeNodeType, ITreeDataProvider } from '../sharedTypes';
import { CMD_OPEN_TAB, TenantTabTarget } from '../tenantTab';
import {
  parseKernelOutputJSON,
  queryKernel
} from '../components/kernelCommunication';
import { insertCodeCell } from '../utils/notebookUtils';

/** Response from get_my_groups function */
interface IGroupsResponse {
  username: string;
  groups: string[];
  group_count: number;
}

/** Response from get_namespace_prefix function */
interface INamespacePrefixResponse {
  username: string;
  user_namespace_prefix: string;
  tenant: string | null;
  tenant_namespace_prefix: string | null;
}

const PERSONAL_NODE_ID = '__user_databases__';

type BerdlNodeType = 'userData' | 'tenant' | 'database' | 'table';

const BERDL_METHODS_IMPORT =
  'import tenant_data_browser; (get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, using_mocks) = tenant_data_browser.get_cdm_methods();';

// BERDL Database Provider - fetches tenant, database and table structure
export const berdlProvider: ITreeDataProvider<BerdlNodeType> = {
  name: 'Lakehouse Data',
  supportedNodeTypes: ['userData', 'tenant', 'database', 'table'],
  parentNodeTypes: ['userData', 'tenant', 'database'],
  icon: <FontAwesomeIcon icon={faDatabase} />,
  nodeTypeIcons: {
    userData: <FontAwesomeIcon icon={faUserCircle} />,
    tenant: <FontAwesomeIcon icon={faUsers} />,
    database: <FontAwesomeIcon icon={faDatabase} />,
    table: <FontAwesomeIcon icon={faTable} />
  },
  menuItems: {
    userData: [
      {
        label: 'Open in tab',
        icon: <FontAwesomeIcon size="sm" icon={faArrowUpRightFromSquare} />,
        showAsButton: true,
        action: (_node, _ctx, services) => {
          const target: TenantTabTarget = { type: 'tenant', tenant: undefined };
          services.app.commands.execute(CMD_OPEN_TAB, target);
        }
      },
      {
        label: 'Copy name',
        icon: <FontAwesomeIcon size="sm" icon={faCopy} />,
        action: node => navigator.clipboard.writeText(node.name)
      }
    ],
    tenant: [
      {
        label: 'Open in tab',
        icon: <FontAwesomeIcon size="sm" icon={faArrowUpRightFromSquare} />,
        showAsButton: true,
        action: (node, _ctx, services) => {
          const target: TenantTabTarget = { type: 'tenant', tenant: node.name };
          services.app.commands.execute(CMD_OPEN_TAB, target);
        }
      },
      {
        label: 'Copy name',
        icon: <FontAwesomeIcon size="sm" icon={faCopy} />,
        action: node => navigator.clipboard.writeText(node.name)
      }
    ],
    database: [
      {
        label: 'Open in tab',
        icon: <FontAwesomeIcon size="sm" icon={faArrowUpRightFromSquare} />,
        showAsButton: true,
        action: (node, _ctx, services) => {
          const target: TenantTabTarget = {
            type: 'database',
            databaseName: node.name,
            tenant: node.data?.tenant
          };
          services.app.commands.execute(CMD_OPEN_TAB, target);
        }
      },
      {
        label: 'Copy name',
        icon: <FontAwesomeIcon size="sm" icon={faCopy} />,
        action: node => navigator.clipboard.writeText(node.name)
      },
      {
        label: 'Insert snippet',
        icon: <FontAwesomeIcon size="sm" icon={faCode} />,
        action: (node, _ctx, services) => {
          insertCodeCell(
            services.notebookTracker,
            `spark.sql(f"SHOW TABLES IN ${node.name}").show()`
          );
        }
      }
    ],
    table: [
      {
        label: 'Open in tab',
        icon: <FontAwesomeIcon size="sm" icon={faArrowUpRightFromSquare} />,
        showAsButton: true,
        action: (node, _ctx, services) => {
          const target: TenantTabTarget = {
            type: 'table',
            tableName: node.name,
            databaseName: node.data?.database,
            tenant: node.data?.tenant
          };
          services.app.commands.execute(CMD_OPEN_TAB, target);
        }
      },
      {
        label: 'Copy name',
        icon: <FontAwesomeIcon size="sm" icon={faCopy} />,
        action: node => navigator.clipboard.writeText(node.name)
      },
      {
        label: 'Insert snippet',
        icon: <FontAwesomeIcon size="sm" icon={faCode} />,
        action: (node, _ctx, services) => {
          const db = node.data?.database || '';
          insertCodeCell(
            services.notebookTracker,
            `spark.sql(f"SELECT * FROM ${db}.${node.name} LIMIT 5").show()`
          );
        }
      }
    ]
  },
  fetchRootNodes: async (sessionContext: SessionContext) => {
    const { data, error } = await queryKernel(
      `${BERDL_METHODS_IMPORT} result = get_my_groups(return_json=True); result`,
      sessionContext
    );

    if (error) {
      console.warn('BERDL provider: Failed to fetch tenants:', error);
      throw error;
    }

    const groupsResponse = parseKernelOutputJSON<IGroupsResponse>(data);

    if (!groupsResponse) {
      return [];
    }

    const nodes: BaseTreeNodeType<'userData' | 'tenant'>[] = [];

    // Add personal databases node first (using username)
    nodes.push({
      id: PERSONAL_NODE_ID,
      name: groupsResponse.username,
      type: 'userData',
      icon: <FontAwesomeIcon icon={faUserCircle} />
    });

    // Add tenant/group nodes
    // Strip 'ro' suffix (read-only copies) and deduplicate
    if (groupsResponse.groups) {
      const processedGroups = [
        ...new Set(
          groupsResponse.groups.map(g =>
            g.endsWith('ro') ? g.slice(0, -2) : g
          )
        )
      ];
      for (const groupName of processedGroups) {
        nodes.push({
          id: `tenant://${groupName}`,
          name: groupName,
          type: 'tenant'
        });
      }
    }

    return nodes;
  },
  fetchChildNodes: {
    userData: async (
      node: BaseTreeNodeType<'userData'>,
      sessionContext: SessionContext
    ): Promise<BaseTreeNodeType<'database'>[]> => {
      const { data, error } = await queryKernel(
        `import json; ${BERDL_METHODS_IMPORT} databases = get_databases(use_hms=True, return_json=False, filter_by_namespace=True); prefix_response = get_namespace_prefix(tenant=None, return_json=False); result = {"databases": databases, "prefix": prefix_response}; json.dumps(result)`,
        sessionContext
      );

      if (error) {
        console.warn('BERDL provider: Failed to fetch user databases:', error);
        throw error;
      }

      const response = parseKernelOutputJSON<{
        databases: string[];
        prefix: INamespacePrefixResponse;
      }>(data);

      if (!response || !response.databases) {
        return [];
      }

      const userPrefix = response.prefix.user_namespace_prefix;
      const filteredDatabases = userPrefix
        ? response.databases.filter(db => db.startsWith(userPrefix))
        : [];

      return filteredDatabases.map(databaseName => ({
        id: `${node.id}/${databaseName}`,
        name: databaseName,
        type: 'database' as const,
        data: { tenant: node.name }
      }));
    },
    tenant: async (
      node: BaseTreeNodeType<'tenant'>,
      sessionContext: SessionContext
    ): Promise<BaseTreeNodeType<'database'>[]> => {
      const { data, error } = await queryKernel(
        `import json; ${BERDL_METHODS_IMPORT} databases = get_databases(use_hms=True, return_json=False, filter_by_namespace=True); prefix_response = get_namespace_prefix(tenant="${node.name}", return_json=False); result = {"databases": databases, "prefix": prefix_response}; json.dumps(result)`,
        sessionContext
      );

      if (error) {
        console.warn(
          `BERDL provider: Failed to fetch databases for tenant ${node.name}:`,
          error
        );
        throw error;
      }

      const response = parseKernelOutputJSON<{
        databases: string[];
        prefix: INamespacePrefixResponse;
      }>(data);

      if (!response || !response.databases) {
        return [];
      }

      const tenantPrefix = response.prefix.tenant_namespace_prefix;
      const filteredDatabases = tenantPrefix
        ? response.databases.filter(db => db.startsWith(tenantPrefix))
        : [];

      return filteredDatabases.map(databaseName => ({
        id: `${node.id}/${databaseName}`,
        name: databaseName,
        type: 'database' as const,
        data: { tenant: node.name }
      }));
    },
    database: async (
      node: BaseTreeNodeType<'database'>,
      sessionContext: SessionContext
    ): Promise<BaseTreeNodeType<'table'>[]> => {
      const { data, error } = await queryKernel(
        `${BERDL_METHODS_IMPORT} result = get_tables("${node.name}", use_hms=True, return_json=True); result`,
        sessionContext
      );

      if (error) {
        console.warn(
          `BERDL provider: Failed to fetch tables for database ${node.name}:`,
          error
        );
        throw error;
      }

      const tables = parseKernelOutputJSON<string[]>(data);

      if (!tables) {
        return [];
      }

      return tables.map(tableName => ({
        id: `${node.id}/${tableName}`,
        name: tableName,
        type: 'table' as const,
        data: { tenant: node.data?.tenant, database: node.name }
      }));
    },
    table: async (): Promise<BaseTreeNodeType<'table'>[]> => []
  }
};
