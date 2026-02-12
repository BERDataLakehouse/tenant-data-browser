import React, { FC, useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TenantTabTarget, UpdateTenantTabSelectionFn } from './tenantTab';
import { fetchDatabases, fetchTables, fetchSchema } from './api';

interface ITenantTabContentProps {
  target: TenantTabTarget;
  /** Callback to register a function for updating selection from outside */
  onRegisterUpdateCallback?: (callback: UpdateTenantTabSelectionFn) => void;
}

/** Shared table styles */
const tableStyles = {
  container: {
    border: '1px solid var(--jp-border-color2)',
    borderRadius: '4px',
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const
  },
  header: {
    display: 'grid',
    backgroundColor: 'var(--jp-layout-color2)',
    borderBottom: '1px solid var(--jp-border-color2)',
    fontWeight: 600,
    fontSize: '12px',
    color: 'var(--jp-ui-font-color0)'
  },
  headerCell: {
    padding: '8px 12px',
    borderRight: '1px solid var(--jp-border-color2)'
  },
  body: {
    flex: 1,
    overflow: 'auto'
  },
  row: {
    display: 'grid',
    borderBottom: '1px solid var(--jp-border-color3)',
    fontSize: '12px',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'var(--jp-layout-color2)'
    }
  },
  rowSelected: {
    backgroundColor: 'color-mix(in srgb, var(--jp-brand-color1) 25%, transparent)',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--jp-brand-color1) 35%, transparent)'
    }
  },
  rowAlt: {
    backgroundColor: 'var(--jp-layout-color1)'
  },
  cell: {
    padding: '6px 12px',
    borderRight: '1px solid var(--jp-border-color3)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const
  },
  emptyState: {
    padding: '16px',
    color: 'var(--jp-ui-font-color2)',
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
          <Box
            sx={{ ...tableStyles.emptyState, color: 'var(--jp-error-color1)' }}
          >
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
}> = ({ databaseName, tableName }) => {
  const {
    data: schema,
    isLoading,
    error
  } = useQuery({
    queryKey: ['tableSchema', databaseName, tableName],
    queryFn: () => fetchSchema(databaseName!, tableName!),
    enabled: !!databaseName && !!tableName
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
          <Box
            sx={{ ...tableStyles.emptyState, color: 'var(--jp-error-color1)' }}
          >
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
  onRegisterUpdateCallback
}) => {
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
    queryFn: () => fetchDatabases(target.tenant)
  });

  const tablesQuery = useQuery({
    queryKey: ['tables', selectedDatabase],
    queryFn: () => fetchTables(selectedDatabase!),
    enabled: !!selectedDatabase
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

  const tenantLabel = target.tenant || 'User Data';

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'var(--jp-layout-color0)'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid var(--jp-border-color2)',
          bgcolor: 'var(--jp-layout-color1)'
        }}
      >
        <Typography
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--jp-ui-font-color0)'
          }}
        >
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
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--jp-ui-font-color0)',
              mb: 1
            }}
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
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
