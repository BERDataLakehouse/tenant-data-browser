import React from 'react';
import {
  BaseTreeNodeType,
  TreeNodeType,
  ITreeDataProvider
} from './sharedTypes';
import dataProviders from './providers';

/**
 * Creates a tree query manager from an array of data providers
 *
 * This function processes the provider configurations and creates a unified
 * interface for the tree browser to interact with all providers.
 *
 * @param dataProviders - Array of ITreeDataProvider objects
 * @returns Object with methods to fetch data and initial tree structure
 */
function createTreeQueryManager(dataProviders: ITreeDataProvider[]) {
  const providerNames = dataProviders.map(provider => provider.name);

  // Function to apply provider properties (icons, parent node status, menu items) to nodes
  const applyProviderProperties = (
    nodes: BaseTreeNodeType[],
    provider: ITreeDataProvider
  ): TreeNodeType[] => {
    return nodes.map(node => ({
      ...node,
      icon:
        node.icon ||
        provider.nodeTypeIcons?.[node.type] ||
        React.createElement('span'), // Ensure icon is always present
      isParentNode: provider.parentNodeTypes.includes(node.type),
      menuItems: provider.menuItems?.[node.type],
      children: node.children
        ? applyProviderProperties(node.children, provider)
        : undefined
    }));
  };

  // Function to fetch root nodes for a specific provider
  const fetchRootNodesForProvider = async (
    providerName: string
  ): Promise<TreeNodeType[]> => {
    const provider = dataProviders.find(p => p.name === providerName);
    if (!provider) {
      throw new Error(`Tree data provider '${providerName}' not found`);
    }
    const nodes = await provider.fetchRootNodes();
    return applyProviderProperties(nodes, provider);
  };

  // Function to load child nodes for a specific node
  const loadChildNodesForNode = async (
    nodeId: string,
    treeData: TreeNodeType[]
  ): Promise<TreeNodeType[]> => {
    // Find the node in the tree
    const nodeLocation = findNodeInTree(nodeId, treeData);
    if (!nodeLocation) {
      throw new Error(`Tree node with id '${nodeId}' not found`);
    }

    const { node, ancestors } = nodeLocation;
    // The provider is determined by the root ancestor
    const providerName = ancestors[0].name;
    const provider = dataProviders.find(p => p.name === providerName);

    if (!provider) {
      throw new Error(`Tree data provider '${providerName}' not found`);
    }

    // Get the appropriate child loader for this node type
    const childLoader = provider.fetchChildNodes[node.type];
    if (!childLoader) {
      throw new Error(`No child loader found for node type '${node.type}'`);
    }

    const childNodes = await childLoader(node);
    return applyProviderProperties(childNodes, provider);
  };

  // Create initial tree structure with root nodes for each provider
  const initialTreeStructure: TreeNodeType[] = dataProviders.map(provider => ({
    id: `tree-root-${provider.name}`,
    name: provider.name,
    type: 'ROOT' as const,
    icon: provider.icon || React.createElement('span'),
    isParentNode: true // Root provider nodes are always parent nodes
  }));

  return {
    dataProviders,
    providerNames,
    fetchRootNodesForProvider,
    loadChildNodesForNode,
    initialTreeStructure
  };
}

/**
 * Recursively searches for a node in the tree structure
 *
 * @param nodeId - The ID of the node to find
 * @param treeData - The tree data to search in
 * @param ancestors - Array of ancestor nodes (used for recursion)
 * @returns Object containing the found node and its ancestors, or undefined
 */
function findNodeInTree(
  nodeId: string,
  treeData: TreeNodeType[],
  ancestors: TreeNodeType[] = []
): { node: TreeNodeType; ancestors: TreeNodeType[] } | undefined {
  for (const currentNode of treeData) {
    if (currentNode.id === nodeId) {
      return { node: currentNode, ancestors };
    }

    // Recursively search in children
    if (currentNode.children) {
      const result = findNodeInTree(nodeId, currentNode.children, [
        ...ancestors,
        currentNode
      ]);
      if (result) {
        return result;
      }
    }
  }
  return undefined;
}

/**
 * Immutably updates a node in the tree structure
 *
 * @param treeData - The current tree data
 * @param nodeId - The ID of the node to update
 * @param updatedNode - The new node data
 * @returns New tree data with the node updated
 */
export function updateNodeInTree(
  treeData: TreeNodeType[],
  nodeId: string,
  updatedNode: TreeNodeType
): TreeNodeType[] {
  return treeData.map(node => {
    if (node.id === nodeId) {
      return updatedNode;
    }

    // Recursively update in children if they exist
    if (node.children) {
      const updatedChildren = updateNodeInTree(
        node.children,
        nodeId,
        updatedNode
      );
      // Only create new object if children actually changed
      if (updatedChildren !== node.children) {
        return {
          ...node,
          children: updatedChildren
        };
      }
    }

    return node;
  });
}

// Create and export the configured tree query manager
export const treeQueryManager = createTreeQueryManager(dataProviders);
