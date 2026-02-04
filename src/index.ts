import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';
import { IStateDB } from '@jupyterlab/statedb';
import { INotebookTracker } from '@jupyterlab/notebook';

import { Panel } from '@lumino/widgets';
import { LabIcon } from '@jupyterlab/ui-components';
import { MainAreaWidget, ReactWidget } from '@jupyterlab/apputils';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TreeBrowser } from './components/TreeBrowser';
import {
  CMD_OPEN_TAB,
  TenantTabTarget,
  UpdateTenantTabSelectionFn
} from './tenantTab';
import { TenantTabContent } from './TenantTabContent';
import treeIconSvg from '@fortawesome/fontawesome-free/svgs/solid/sitemap.svg';
import tenantIconSvg from '@fortawesome/fontawesome-free/svgs/solid/users.svg';

const EXTENSION_ID = 'tenant-data-browser';
const PLUGIN_ID = `${EXTENSION_ID}:plugin`;
const TREE_ICON_ID = `${EXTENSION_ID}:tree-icon`;
const TENANT_ICON_ID = `${EXTENSION_ID}:tenant-icon`;
const PANEL_ID = `${EXTENSION_ID}-panel`;

const treeIcon = new LabIcon({
  name: TREE_ICON_ID,
  svgstr: treeIconSvg
});

const tenantIcon = new LabIcon({
  name: TENANT_ICON_ID,
  svgstr: tenantIconSvg
});

/**
 * CDM Tree Browser JupyterLab extension plugin
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'A JupyterLab extension for browsing file/data trees in KBase CDM JupyterLab.',
  autoStart: true,
  requires: [ILayoutRestorer, IStateDB, INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    restorer: ILayoutRestorer,
    stateDB: IStateDB,
    notebookTracker: INotebookTracker
  ) => {
    // Create QueryClient for React Query
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 1000 * 60 * 5 // 5 minutes
        }
      }
    });

    // Track open tenant tabs and their update callbacks
    const openTenantTabs = new Map<string, MainAreaWidget>();
    const tenantUpdateCallbacks = new Map<string, UpdateTenantTabSelectionFn>();

    // Function to open tenant tabs in main area
    const openTenantTab = (target: TenantTabTarget) => {
      // Use tenant name as the unique key (one tab per tenant)
      const tenantKey = target.tenant || '__user_data__';

      // Check if tab already exists for this tenant
      const existingWidget = openTenantTabs.get(tenantKey);
      if (existingWidget && !existingWidget.isDisposed) {
        // Tab exists, update selection and activate it
        const updateCallback = tenantUpdateCallbacks.get(tenantKey);
        if (updateCallback) {
          updateCallback(target);
        }
        app.shell.activateById(existingWidget.id);
        return;
      }

      // Callback registration function for this tab
      const onRegisterUpdateCallback = (
        callback: UpdateTenantTabSelectionFn
      ) => {
        tenantUpdateCallbacks.set(tenantKey, callback);
      };

      const content = ReactWidget.create(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(TenantTabContent, {
            target,
            jupyterApp: app,
            onRegisterUpdateCallback
          })
        )
      );

      const tenantTab = new MainAreaWidget({ content });
      const tabLabel = target.tenant || 'User Data';

      tenantTab.id = `${EXTENSION_ID}-tenant-${tenantKey}`;
      tenantTab.title.label = tabLabel;
      tenantTab.title.icon = tenantIcon;
      tenantTab.title.closable = true;

      // Track this tab and clean up when disposed
      openTenantTabs.set(tenantKey, tenantTab);
      tenantTab.disposed.connect(() => {
        openTenantTabs.delete(tenantKey);
        tenantUpdateCallbacks.delete(tenantKey);
      });

      app.shell.add(tenantTab, 'main');
      app.shell.activateById(tenantTab.id);
    };

    // Register command for opening tenant tabs
    app.commands.addCommand(CMD_OPEN_TAB, {
      label: 'Open in Tenant Tab',
      execute: args => {
        openTenantTab(args as unknown as TenantTabTarget);
      }
    });

    // Create a React widget wrapped with QueryClientProvider
    const widget = ReactWidget.create(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(TreeBrowser, {
          jupyterApp: app,
          restorer,
          stateDB,
          notebookTracker
        })
      )
    );

    // Create sidebar panel
    const panel = new Panel();
    panel.id = PANEL_ID;
    panel.title.closable = true;
    panel.title.icon = treeIcon;
    panel.title.label = '';

    // Configure widget styling
    widget.addClass('jp-TreeBrowserWidget-root');
    widget.node.style.height = '100%';
    widget.node.style.overflow = 'hidden';

    // Assemble and register panel
    panel.addWidget(widget);
    app.shell.add(panel, 'left', { rank: 1 });
    restorer.add(panel, PANEL_ID);
  }
};

export default plugin;
