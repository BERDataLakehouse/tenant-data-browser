import React, { FC, useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { SessionContext } from '@jupyterlab/apputils';
import { useQuery } from '@tanstack/react-query';
import { TenantTabTarget, UpdateTenantTabSelectionFn } from './tenantTab';
import {
  useSessionContext,
  queryKernel,
  parseKernelOutputJSON
} from './components/kernelCommunication';

const BERDL_METHODS_IMPORT =
  'import tenant_data_browser; (get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, using_mocks) = tenant_data_browser.get_cdm_methods();';

interface ITenantTabContentProps {
  target: TenantTabTarget;
  jupyterApp: JupyterFrontEnd;
  /** Callback to register a function for updating selection from outside */
  onRegisterUpdateCallback?: (callback: UpdateTenantTabSelectionFn) => void;
}

/** Shared table styles */
const tableStyles = {
  container: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const
  },
  header: {
    display: 'grid',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #e0e0e0',
    fontWeight: 600,
    fontSize: '12px',
    color: '#333'
  },
  headerCell: {
    padding: '8px 12px',
    borderRight: '1px solid #e0e0e0'
  },
  body: {
    flex: 1,
    overflow: 'auto'
  },
  row: {
    display: 'grid',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '12px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#f8f8f8'
    }
  },
  rowSelected: {
    backgroundColor: '#e3f2fd'
  },
  rowAlt: {
    backgroundColor: '#fafafa'
  },
  cell: {
    padding: '6px 12px',
    borderRight: '1px solid #f0f0f0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  emptyState: {
    padding: '16px',
    color: '#999',
    fontSize: '12px',
    textAlign: 'center' as const
  }
};

/** Databases list component */
const DatabasesList: FC<{
  databases: string[];
  selectedDatabase: string | null;
  onSelectDatabase: (db: string) => void;
  isLoading: boolean;
  error: Error | null;
}> = ({ databases, selectedDatabase, onSelectDatabase, isLoading, error }) => {
  return (
    <Box sx={tableStyles.container}>
      <Box sx={{ ...tableStyles.header, gridTemplateColumns: '1fr' }}>
        <Box sx={tableStyles.headerCell}>Databases</Box>
      </Box>
      <Box sx={tableStyles.body}>
        {isLoading && <Box sx={tableStyles.emptyState}>Loading...</Box>}
        {error && (
          <Box sx={{ ...tableStyles.emptyState, color: '#d32f2f' }}>
            Error: {error.message}
          </Box>
        )}
        {!isLoading &&
          !error &&
          databases.map((db, idx) => (
            <Box
              key={db}
              onClick={() => onSelectDatabase(db)}
              sx={{
                ...tableStyles.row,
                gridTemplateColumns: '1fr',
                ...(idx % 2 === 1 ? tableStyles.rowAlt : {}),
                ...(db === selectedDatabase ? tableStyles.rowSelected : {})
              }}
            >
              <Box sx={tableStyles.cell}>{db}</Box>
            </Box>
          ))}
        {!isLoading && !error && databases.length === 0 && (
          <Box sx={tableStyles.emptyState}>No databases found</Box>
        )}
      </Box>
    </Box>
  );
};

/** Tables list component */
const TablesList: FC<{
  tables: string[];
  selectedTable: string | null;
  onSelectTable: (table: string) => void;
  isLoading: boolean;
  hasSelectedDatabase: boolean;
}> = ({
  tables,
  selectedTable,
  onSelectTable,
  isLoading,
  hasSelectedDatabase
}) => {
  return (
    <Box sx={tableStyles.container}>
      <Box sx={{ ...tableStyles.header, gridTemplateColumns: '2fr 1fr 1fr' }}>
        <Box sx={tableStyles.headerCell}>tablename</Box>
        <Box sx={tableStyles.headerCell}>tableType</Box>
        <Box sx={{ ...tableStyles.headerCell, borderRight: 'none' }}>
          isTemporary
        </Box>
      </Box>
      <Box sx={tableStyles.body}>
        {!hasSelectedDatabase && (
          <Box sx={tableStyles.emptyState}>
            Select a database to view tables
          </Box>
        )}
        {hasSelectedDatabase && isLoading && (
          <Box sx={tableStyles.emptyState}>Loading...</Box>
        )}
        {hasSelectedDatabase &&
          !isLoading &&
          tables.map((table, idx) => (
            <Box
              key={table}
              onClick={() => onSelectTable(table)}
              sx={{
                ...tableStyles.row,
                gridTemplateColumns: '2fr 1fr 1fr',
                ...(idx % 2 === 1 ? tableStyles.rowAlt : {}),
                ...(table === selectedTable ? tableStyles.rowSelected : {})
              }}
            >
              <Box sx={tableStyles.cell}>{table}</Box>
              <Box sx={tableStyles.cell}>MANAGED</Box>
              <Box sx={{ ...tableStyles.cell, borderRight: 'none' }}>false</Box>
            </Box>
          ))}
        {hasSelectedDatabase && !isLoading && tables.length === 0 && (
          <Box sx={tableStyles.emptyState}>No tables in this database</Box>
        )}
      </Box>
    </Box>
  );
};

/** Table Data Dictionary component */
const TableDataDictionary: FC<{
  databaseName: string | null;
  tableName: string | null;
  sessionContext: SessionContext | undefined;
}> = ({ databaseName, tableName, sessionContext }) => {
  const {
    data: schema,
    isLoading,
    error
  } = useQuery({
    queryKey: ['tableSchema', databaseName, tableName],
    queryFn: async () => {
      if (!sessionContext) {
        throw new Error('No session');
      }
      const { data, error } = await queryKernel(
        `${BERDL_METHODS_IMPORT} result = get_table_schema("${databaseName}", "${tableName}", return_json=True); result`,
        sessionContext
      );
      if (error) {
        throw error;
      }
      const schema = parseKernelOutputJSON<string[]>(data);
      if (!schema) {
        throw new Error('No schema data returned');
      }
      return schema;
    },
    enabled: !!databaseName && !!tableName && !!sessionContext
  });

  const showEmptyState = !databaseName || !tableName;

  return (
    <Box sx={tableStyles.container}>
      <Box sx={{ ...tableStyles.header, gridTemplateColumns: '2fr 1fr 2fr' }}>
        <Box sx={tableStyles.headerCell}>col_name</Box>
        <Box sx={tableStyles.headerCell}>data_type</Box>
        <Box sx={{ ...tableStyles.headerCell, borderRight: 'none' }}>
          comment
        </Box>
      </Box>
      <Box sx={tableStyles.body}>
        {showEmptyState && (
          <Box sx={tableStyles.emptyState}>Select a table to view schema</Box>
        )}
        {!showEmptyState && isLoading && (
          <Box sx={tableStyles.emptyState}>Loading...</Box>
        )}
        {!showEmptyState && error && (
          <Box sx={{ ...tableStyles.emptyState, color: '#d32f2f' }}>
            Error: {error instanceof Error ? error.message : 'Unknown error'}
          </Box>
        )}
        {!showEmptyState &&
          !isLoading &&
          !error &&
          schema?.map((columnName, idx) => (
            <Box
              key={idx}
              sx={{
                ...tableStyles.row,
                gridTemplateColumns: '2fr 1fr 2fr',
                cursor: 'default',
                ...(idx % 2 === 1 ? tableStyles.rowAlt : {})
              }}
            >
              <Box sx={tableStyles.cell}>{columnName}</Box>
              <Box sx={tableStyles.cell}>string</Box>
              <Box sx={{ ...tableStyles.cell, borderRight: 'none' }}></Box>
            </Box>
          ))}
        {!showEmptyState && !isLoading && !error && schema?.length === 0 && (
          <Box sx={tableStyles.emptyState}>No columns found</Box>
        )}
      </Box>
    </Box>
  );
};

/** Helper to extract initial database from target */
const getInitialDatabase = (target: TenantTabTarget): string | null => {
  if (target.type === 'database' || target.type === 'table') {
    return target.databaseName;
  }
  return null;
};

/** Helper to extract initial table from target */
const getInitialTable = (target: TenantTabTarget): string | null => {
  if (target.type === 'table') {
    return target.tableName;
  }
  return null;
};

/** Main tenant tab content */
export const TenantTabContent: FC<ITenantTabContentProps> = ({
  target,
  jupyterApp,
  onRegisterUpdateCallback
}) => {
  const {
    sessionContext,
    error: sessionError,
    isConnecting
  } = useSessionContext(jupyterApp);

  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(
    getInitialDatabase(target)
  );
  const [selectedTable, setSelectedTable] = useState<string | null>(
    getInitialTable(target)
  );

  // Register callback for external selection updates
  useEffect(() => {
    if (onRegisterUpdateCallback) {
      const updateSelection: UpdateTenantTabSelectionFn = newTarget => {
        const newDb = getInitialDatabase(newTarget);
        const newTable = getInitialTable(newTarget);
        setSelectedDatabase(newDb);
        setSelectedTable(newTable);
      };
      onRegisterUpdateCallback(updateSelection);
    }
  }, [onRegisterUpdateCallback]);

  const databasesQuery = useQuery({
    queryKey: ['databases', target.tenant],
    queryFn: async () => {
      if (!sessionContext) {
        throw new Error('No session context');
      }
      const { data, error } = await queryKernel(
        `${BERDL_METHODS_IMPORT} result = get_databases(use_hms=True, return_json=True, filter_by_namespace=True); result`,
        sessionContext
      );
      if (error) {
        throw error;
      }
      const databases = parseKernelOutputJSON<string[]>(data);
      return databases || [];
    },
    enabled: !!sessionContext
  });

  const tablesQuery = useQuery({
    queryKey: ['tables', selectedDatabase],
    queryFn: async () => {
      if (!sessionContext || !selectedDatabase) {
        throw new Error('No session context or database');
      }
      const { data, error } = await queryKernel(
        `${BERDL_METHODS_IMPORT} result = get_tables("${selectedDatabase}", use_hms=True, return_json=True); result`,
        sessionContext
      );
      if (error) {
        throw error;
      }
      const tables = parseKernelOutputJSON<string[]>(data);
      return tables || [];
    },
    enabled: !!sessionContext && !!selectedDatabase
  });

  // Clear table selection when database changes from initial target
  const targetDatabase = getInitialDatabase(target);
  useEffect(() => {
    if (selectedDatabase !== targetDatabase) {
      setSelectedTable(null);
    }
  }, [selectedDatabase, targetDatabase]);

  const handleDatabaseSelect = (db: string) => {
    setSelectedDatabase(db);
    setSelectedTable(null);
  };

  const handleTableSelect = (table: string) => {
    setSelectedTable(table);
  };

  if (isConnecting) {
    return (
      <Box sx={{ p: 3, color: '#666', fontSize: '13px' }}>
        Connecting to kernel...
      </Box>
    );
  }

  if (sessionError) {
    return (
      <Box sx={{ p: 3, color: '#d32f2f', fontSize: '13px' }}>
        Failed to connect: {sessionError.message}
      </Box>
    );
  }

  const tenantLabel = target.tenant || 'User Data';

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fff'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #e0e0e0',
          bgcolor: '#fafafa'
        }}
      >
        <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#333' }}>
          Tenant Explorer:{' '}
          <Box component="span" sx={{ fontWeight: 600 }}>
            {tenantLabel}
          </Box>
        </Typography>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {/* Top section: Databases and Tables */}
        <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
          {/* Databases */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0
            }}
          >
            <DatabasesList
              databases={databasesQuery.data || []}
              selectedDatabase={selectedDatabase}
              onSelectDatabase={handleDatabaseSelect}
              isLoading={databasesQuery.isLoading}
              error={
                databasesQuery.error instanceof Error
                  ? databasesQuery.error
                  : null
              }
            />
          </Box>

          {/* Tables */}
          <Box
            sx={{
              flex: 2,
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0
            }}
          >
            <TablesList
              tables={tablesQuery.data || []}
              selectedTable={selectedTable}
              onSelectTable={handleTableSelect}
              isLoading={tablesQuery.isLoading}
              hasSelectedDatabase={!!selectedDatabase}
            />
          </Box>
        </Box>

        {/* Bottom section: Data Dictionary */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          <Typography
            sx={{ fontSize: '13px', fontWeight: 600, color: '#333', mb: 1 }}
          >
            Table Data Dictionary
            {selectedTable && selectedDatabase
              ? `: ${selectedDatabase}.${selectedTable}`
              : ''}
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TableDataDictionary
              databaseName={selectedDatabase}
              tableName={selectedTable}
              sessionContext={sessionContext}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
