import React from 'react';
import { SearchX, Users, Inbox, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  subtext?: string;
  icon?: 'search' | 'users' | 'inbox' | 'alert';
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
}

const iconMap = {
  search: SearchX,
  users: Users,
  inbox: Inbox,
  alert: AlertCircle,
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  subtext,
  icon = 'inbox',
  action
}) => {
  const Icon = iconMap[icon];

  return (
    <div className="empty-state">
      <div className="empty-state-icon-wrapper">
        <Icon size={40} />
      </div>
      <p className="empty-state-message">{message}</p>
      {subtext && <p className="empty-state-subtext">{subtext}</p>}
      {action && (
        <button
          className="empty-state-action"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.disabled ? 'Procesando...' : action.label}
        </button>
      )}
    </div>
  );
};
