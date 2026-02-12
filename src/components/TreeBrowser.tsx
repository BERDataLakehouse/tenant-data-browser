import React, {
  useState,
  FC,
  useCallback,
  useRef,
  useEffect,
  useMemo
} from 'react';
import { JupyterFrontEnd, ILayoutRestorer } from '@jupyterlab/application';
import { IStateDB } from '@jupyterlab/statedb';
import { INotebookTracker } from '@jupyterlab/notebook';
import { Tree, TreeApi } from 'react-arborist';
import {
  TreeNodeType,
  TreeNodeMutator,
  IMenuItem,
  IMenuServices
} from '../sharedTypes';
import { treeQueryManager, updateNodeInTree } from '../treeQueryManager';
import { useTreeDimensions } from '../hooks/useTreeDimensions';
import { useContextMenu } from '../hooks/useContextMenu';
import { useMockNotification } from '../hooks/useMockNotification';
import { TreeDataLoader } from '../TreeDataLoader';
import { TreeNodeRenderer } from '../TreeNodeRenderer';
import { ContextMenu } from '../ContextMenu';
import { debounce } from '../utils/debounce';

const STATE_KEY_OPEN_NODES = 'tenant-data-browser:open-nodes';
const DEBOUNCE_DELAY_MS = 500;

interface ITreeBrowserProps {
  jupyterApp: JupyterFrontEnd;
  restorer: ILayoutRestorer;
  stateDB: IStateDB;
  notebookTracker: INotebookTracker;
}

/**
 * Main Tree Browser Component
 *
 * This is the primary component that manages the tree state and renders the tree UI.
 * It automatically handles all configured data providers and their loading states.
 */
export const TreeBrowser: FC<ITreeBrowserProps> = ({
  jupyterApp,
  restorer,
  stateDB,
  notebookTracker
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TreeApi<TreeNodeType>>(null);
  const containerDimensions = useTreeDimensions(containerRef);
  const contextMenu = useContextMenu();

  // Services for menu item actions
  const services: IMenuServices = useMemo(
    () => ({ app: jupyterApp, notebookTracker }),
    [jupyterApp, notebookTracker]
  );

  // Track active node (for touch devices)
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Check if mocks are active and show notification
  useMockNotification();

  // Initialize tree with root nodes for each configured provider
  const [treeData, setTreeData] = useState<TreeNodeType[]>(
    treeQueryManager.initialTreeStructure
  );

  // State for tree node restoration
  const [openNodeIds, setOpenNodeIds] = useState<string[]>([]);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Restore saved open node state on mount
  useEffect(() => {
    const restoreTreeState = async () => {
      try {
        await jupyterApp.restored;
        const savedState = await stateDB.fetch(STATE_KEY_OPEN_NODES);
        if (savedState && Array.isArray(savedState)) {
          setOpenNodeIds(savedState);
        }
      } catch (error) {
        console.warn('Failed to restore tree state:', error);
      }
    };

    restoreTreeState();
  }, [jupyterApp, stateDB]);

  // Debounced state save function
  const debouncedStateSave = useMemo(
    () =>
      debounce(async (openIds: string[]) => {
        try {
          await stateDB.save(STATE_KEY_OPEN_NODES, openIds);
        } catch (error) {
          console.warn('Failed to save tree state:', error);
        }
      }, DEBOUNCE_DELAY_MS),
    [stateDB]
  );

  // Update open state tracking when user interacts with tree
  const handleTreeStateChange = useCallback(() => {
    setHasUserInteracted(true);
    if (treeRef.current) {
      const currentOpenIds = treeRef.current.visibleNodes
        .filter(node => node.isOpen)
        .map(node => node.id);
      setOpenNodeIds(currentOpenIds);
      debouncedStateSave(currentOpenIds);
    }
  }, [debouncedStateSave]);

  // Callback to update individual nodes in the tree structure
  const handleNodeUpdate = useCallback<TreeNodeMutator>(
    (nodeId: string, updatedNode: TreeNodeType) => {
      setTreeData(currentTreeData =>
        updateNodeInTree(currentTreeData, nodeId, updatedNode)
      );
    },
    []
  );

  // Handler for showAsButton menu item clicks
  const handleMenuItemClick = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      node: TreeNodeType,
      item: IMenuItem
    ) => {
      event.stopPropagation();
      item.action(node, services);
    },
    [services]
  );

  // Handler for node becoming active (touch devices)
  const handleNodeActive = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="jp-TreeBrowserWidget"
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        padding: '8px'
      }}
    >
      {/* Invisible component that manages data loading for all providers */}
      <TreeDataLoader treeData={treeData} onNodeUpdate={handleNodeUpdate} />
      {/* The actual tree UI component - takes full height */}
      <Tree
        ref={treeRef}
        data={treeData}
        openByDefault={false}
        width={containerDimensions.width}
        height={containerDimensions.height}
      >
        {nodeProps => (
          <TreeNodeRenderer
            key={nodeProps.node.id}
            {...nodeProps}
            onNodeUpdate={handleNodeUpdate}
            onContextMenuButton={contextMenu.openFromButton}
            onContextMenuRightClick={contextMenu.openFromRightClick}
            onMenuItemClick={handleMenuItemClick}
            services={services}
            activeNodeId={activeNodeId}
            contextMenuNodeId={contextMenu.node?.id ?? null}
            onNodeActive={handleNodeActive}
            onToggle={handleTreeStateChange}
            restoreOpenNodeIds={hasUserInteracted ? [] : openNodeIds}
            treeData={treeData}
          />
        )}
      </Tree>

      {/* Context menu */}
      <ContextMenu state={contextMenu} services={services} />
    </div>
  );
};
