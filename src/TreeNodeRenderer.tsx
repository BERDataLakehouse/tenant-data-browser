import React, { FC, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NodeRendererProps } from 'react-arborist';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFile,
  faFolder,
  faFolderOpen,
  faSpinner,
  faEllipsisVertical
} from '@fortawesome/free-solid-svg-icons';
import {
  TreeNodeType,
  TreeNodeMutator,
  IMenuItem,
  IMenuServices
} from './sharedTypes';
import { treeQueryManager } from './treeQueryManager';
import { showErrorWithRetry } from './utils/errorUtil';

/** Shared styling for action buttons */
const actionButtonSx = {
  backgroundColor: 'grey.200',
  '&:hover': { backgroundColor: 'background.paper' },
  '&:active': { backgroundColor: 'grey.300' }
};

/** Props for the TreeNodeRenderer component */
interface ITreeNodeRendererProps extends NodeRendererProps<TreeNodeType> {
  onNodeUpdate: TreeNodeMutator;
  /** Callback to open context menu from button click */
  onContextMenuButton: (
    event: React.MouseEvent<HTMLElement>,
    node: TreeNodeType
  ) => void;
  /** Callback to open context menu from right-click */
  onContextMenuRightClick: (
    event: React.MouseEvent<HTMLElement>,
    node: TreeNodeType
  ) => void;
  /** Callback for menu item button clicks (showAsButton items) */
  onMenuItemClick: (
    event: React.MouseEvent<HTMLElement>,
    node: TreeNodeType,
    menuItem: IMenuItem
  ) => void;
  /** Services available for menu item actions */
  services: IMenuServices;
  /** Currently active node ID (for touch devices) */
  activeNodeId: string | null;
  /** Node ID that has context menu open */
  contextMenuNodeId: string | null;
  /** Callback when node becomes active */
  onNodeActive: (nodeId: string) => void;
  /** Callback triggered when node open state changes */
  onToggle?: () => void;
  /** Array of node IDs that should be restored to open state */
  restoreOpenNodeIds: string[];
  /** The full tree data for searching nodes */
  treeData: TreeNodeType[];
}

/** Function to get the appropriate icon for a node */
const getNodeIcon = (node: TreeNodeType): React.ReactNode => {
  return node.icon || <FontAwesomeIcon icon={faFile} />;
};

/**
 * Tree Node Renderer Component
 *
 * Renders individual tree nodes and handles lazy loading of child nodes.
 * When a parent node is expanded, this component automatically fetches
 * children using the appropriate provider's fetchChildNodes function.
 */
export const TreeNodeRenderer: FC<ITreeNodeRendererProps> = ({
  node,
  style,
  dragHandle,
  tree,
  onNodeUpdate,
  onContextMenuButton,
  onContextMenuRightClick,
  onMenuItemClick,
  services,
  activeNodeId,
  contextMenuNodeId,
  onNodeActive,
  onToggle,
  restoreOpenNodeIds,
  treeData
}) => {
  // Determine if we need to load children (parent is open but children not loaded)
  // Only load children for nodes that are configured as parent nodes in the provider, excluding ROOT nodes
  const shouldLoadChildren =
    node.parent?.isOpen &&
    node.data.children === undefined &&
    node.data.isParentNode &&
    node.data.type !== 'ROOT';

  // Query to fetch child nodes when needed
  const childNodesQuery = useQuery({
    enabled: shouldLoadChildren,
    queryKey: ['tree-children', node.id],
    queryFn: () => treeQueryManager.loadChildNodesForNode(node.id, treeData),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    retryDelay: 1000
  });

  // Handle loading errors
  useEffect(() => {
    if (childNodesQuery.error) {
      showErrorWithRetry(
        childNodesQuery.error,
        `Failed to load children for ${node.data.name}`,
        () => childNodesQuery.refetch()
      );
    }
  }, [childNodesQuery.error, node.id, node.data.name, childNodesQuery.refetch]);

  // Update tree when child data is loaded
  useEffect(() => {
    if (childNodesQuery.data && node.data.children === undefined) {
      onNodeUpdate(node.id, {
        ...node.data,
        children: childNodesQuery.data
      });
    }
  }, [childNodesQuery.data, node.id, onNodeUpdate]);

  // Auto-restore previously open node state for lazy-loaded nodes
  useEffect(() => {
    const shouldRestore =
      restoreOpenNodeIds.includes(node.id) && !node.isOpen && !node.isLeaf;

    if (shouldRestore) {
      const treeNode = tree.get(node.id);
      if (treeNode) {
        treeNode.open();
        // Notify parent of state change after DOM update
        if (onToggle) {
          setTimeout(onToggle, 0);
        }
      }
    }
  }, [node.id, node.isOpen, node.isLeaf, restoreOpenNodeIds, tree, onToggle]);

  const handleNodeClick = useCallback(() => {
    // Make this node active (for touch devices)
    onNodeActive(node.id);

    if (!node.isLeaf) {
      tree.get(node.id)?.toggle();
      // Notify parent of state change after DOM update
      if (onToggle) {
        setTimeout(onToggle, 0);
      }
    }
  }, [node.id, node.isLeaf, tree, onNodeActive, onToggle]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      onContextMenuRightClick(e, node.data);
    },
    [node.data, onContextMenuRightClick]
  );

  const handleMenuButtonClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      onContextMenuButton(e, node.data);
    },
    [node.data, onContextMenuButton]
  );

  const handleMenuItemButtonClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, menuItem: IMenuItem) => {
      e.stopPropagation();
      onMenuItemClick(e, node.data, menuItem);
    },
    [node.data, onMenuItemClick]
  );

  const isProvider = node.data.type === 'ROOT';
  const isActive = activeNodeId === node.id;
  const hasContextMenuOpen = contextMenuNodeId === node.id;
  const buttonItems =
    node.data.menuItems?.filter(item => item.showAsButton) || [];

  return (
    <div style={style} ref={dragHandle} onContextMenu={handleContextMenu}>
      <Box
        className={`cdm-tree-node-row${hasContextMenuOpen ? ' cdm-tree-node-row-menu-open' : ''}`}
        onClick={handleNodeClick}
        sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
      >
        <Stack
          direction="row"
          spacing={0}
          alignItems="center"
          justifyItems="start"
          sx={{ flex: 1, minWidth: 0 }}
        >
          {/* Provider icon (larger, no folder) */}
          {isProvider && (
            <IconButton size="small">
              {!node.data.children ? (
                <FontAwesomeIcon icon={faSpinner} spin />
              ) : (
                node.data.icon
              )}
            </IconButton>
          )}
          {/* Expand/collapse icon for non-provider parent nodes */}
          {node.data.isParentNode && !isProvider && (
            <IconButton size="small">
              {childNodesQuery.isLoading ? (
                <FontAwesomeIcon fixedWidth size="sm" icon={faSpinner} spin />
              ) : node.data.icon ? (
                node.data.icon
              ) : (
                <FontAwesomeIcon
                  fixedWidth
                  size="sm"
                  icon={node.isOpen ? faFolderOpen : faFolder}
                />
              )}
            </IconButton>
          )}
          {/* Node type icon for leaf nodes */}
          {!node.data.isParentNode && !isProvider && (
            <IconButton size="small">{getNodeIcon(node.data)}</IconButton>
          )}
          <Typography
            variant="body2"
            sx={{
              fontWeight: isProvider ? 'bold' : 'normal',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            height="1.2em"
          >
            {node.data.name}
          </Typography>
        </Stack>

        {/* Menu button area - right side of node row */}
        {!isProvider && (
          <Box
            className={`cdm-tree-menu-buttons${isActive ? ' cdm-tree-menu-buttons-active' : ''}`}
            sx={{ paddingRight: '3px' }}
          >
            <IconButton
              size="small"
              onClick={handleMenuButtonClick}
              aria-label={`More options for ${node.data.name}`}
              aria-haspopup="menu"
              aria-expanded={hasContextMenuOpen}
              sx={actionButtonSx}
            >
              <FontAwesomeIcon size="xs" icon={faEllipsisVertical} />
            </IconButton>
            {buttonItems.map((item, idx) => (
              <IconButton
                key={idx}
                size="small"
                onClick={e => handleMenuItemButtonClick(e, item)}
                aria-label={`${item.label} ${node.data.name}`}
                sx={{ ...actionButtonSx, padding: '4px', fontSize: '0.85rem' }}
              >
                {item.icon}
              </IconButton>
            ))}
          </Box>
        )}
      </Box>
    </div>
  );
};
