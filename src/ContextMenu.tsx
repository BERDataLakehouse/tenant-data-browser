import React, { FC } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { IMenuItem, IMenuServices } from './sharedTypes';
import { IContextMenu } from './hooks/useContextMenu';

interface IContextMenuProps {
  state: IContextMenu;
  services: IMenuServices;
}

export const ContextMenu: FC<IContextMenuProps> = ({
  state,
  services
}) => {
  const { node, anchorPosition, isOpen, close } = state;

  if (!node || !anchorPosition) {
    return null;
  }

  // Separate showAsButton items from other items
  const providerItems = node.menuItems || [];
  const quickActions = providerItems.filter(item => item.showAsButton);
  const otherItems = providerItems.filter(item => !item.showAsButton);

  const renderItem = (item: IMenuItem, index: number) => (
    <MenuItem
      key={index}
      onClick={() => {
        item.action(node, services);
        close();
      }}
    >
      {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
      <ListItemText>{item.label}</ListItemText>
    </MenuItem>
  );

  const hasQuickActions = quickActions.length > 0;
  const hasOtherItems = otherItems.length > 0;

  const handleBackdropContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    close();
  };

  return (
    <Menu
      open={isOpen}
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      MenuListProps={{ dense: true }}
      slotProps={{
        paper: {
          onContextMenu: (e: React.MouseEvent) => e.preventDefault()
        },
        backdrop: {
          onContextMenu: handleBackdropContextMenu
        }
      }}
    >
      {/* Section 1: Quick actions (showAsButton items) */}
      {quickActions.map(renderItem)}

      {/* Divider between sections */}
      {hasQuickActions && hasOtherItems && <Divider />}

      {/* Section 2: Other menu items */}
      {otherItems.map((item, index) =>
        renderItem(item, index + quickActions.length)
      )}
    </Menu>
  );
};
