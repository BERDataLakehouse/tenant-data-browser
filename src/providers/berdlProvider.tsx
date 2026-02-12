import React from 'react';
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
  fetchGroups,
  fetchDatabases,
  fetchTables,
  IGroupsResponse
} from '../api';
import { insertCodeCell } from '../utils/notebookUtils';

const PERSONAL_NODE_ID = '__user_databases__';

type BerdlNodeType = 'userData' | 'tenant' | 'database' | 'table';

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
        action: (_node, services) => {
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
        action: (node, services) => {
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
        action: (node, services) => {
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
        action: (node, services) => {
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
        action: (node, services) => {
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
        action: (node, services) => {
          const db = node.data?.database || '';
          insertCodeCell(
            services.notebookTracker,
            `spark.sql(f"SELECT * FROM ${db}.${node.name} LIMIT 5").show()`
          );
        }
      }
    ]
  },
  fetchRootNodes: async () => {
    const groupsResponse: IGroupsResponse = await fetchGroups();

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
      node: BaseTreeNodeType<'userData'>
    ): Promise<BaseTreeNodeType<'database'>[]> => {
      const databases = await fetchDatabases(undefined);
      return databases.map(databaseName => ({
        id: `${node.id}/${databaseName}`,
        name: databaseName,
        type: 'database' as const,
        data: { tenant: node.name }
      }));
    },
    tenant: async (
      node: BaseTreeNodeType<'tenant'>
    ): Promise<BaseTreeNodeType<'database'>[]> => {
      const databases = await fetchDatabases(node.name);
      return databases.map(databaseName => ({
        id: `${node.id}/${databaseName}`,
        name: databaseName,
        type: 'database' as const,
        data: { tenant: node.name }
      }));
    },
    database: async (
      node: BaseTreeNodeType<'database'>
    ): Promise<BaseTreeNodeType<'table'>[]> => {
      const tables = await fetchTables(node.name);

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
