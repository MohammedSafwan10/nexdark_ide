import React from 'react';
import { 
  VscFiles, VscSearch, VscSourceControl, VscDebugAlt, VscExtensions, 
  VscSettingsGear, VscAccount 
} from 'react-icons/vsc';
import { IconType } from 'react-icons';

interface ActivityBarProps {
  activeView: string | null;
  onSelectView: (viewId: string) => void;
}

interface ActivityItemProps {
  id: string;
  title: string;
  icon: IconType;
  isActive: boolean;
  onClick: (id: string) => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({ id, title, icon: Icon, isActive, onClick }) => (
  <button 
    className={`flex items-center justify-center w-12 h-12 focus:outline-none relative
      group transition-all duration-300 ease-in-out`}
    onClick={() => onClick(id)}
    title={title}
  >
    <div className={`relative flex items-center justify-center w-full h-full transition-all duration-300
      ${isActive 
        ? 'text-[var(--accent-primary)]' 
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
    >
      {/* Background indicator instead of left border */}
      <div className={`absolute inset-0 rounded-md bg-[var(--accent-primary)] opacity-15 transform transition-all duration-300 ease-out
        ${isActive ? 'scale-100' : 'scale-90 opacity-0 group-hover:scale-95 group-hover:opacity-5'}`}></div>
        
      <Icon className={`w-[22px] h-[22px] transform transition-transform duration-300 z-10
        ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
    </div>
  </button>
);

const ActivityBar: React.FC<ActivityBarProps> = ({ activeView, onSelectView }) => {
  const activities = [
    { id: 'explorer', title: 'Explorer', icon: VscFiles },
    { id: 'search', title: 'Search', icon: VscSearch },
    { id: 'scm', title: 'Source Control', icon: VscSourceControl },
    { id: 'debug', title: 'Run and Debug', icon: VscDebugAlt },
    { id: 'extensions', title: 'Extensions', icon: VscExtensions },
  ];

  const bottomActivities = [
    { id: 'account', title: 'Account', icon: VscAccount },
    { id: 'settings', title: 'Settings', icon: VscSettingsGear },
  ];

  return (
    <div className="w-12 h-full bg-[var(--bg-primary)] border-r border-[var(--border-subtle)] flex flex-col justify-between items-center">
      <div className="flex flex-col w-full pt-1">
        {activities.map(activity => (
          <ActivityItem
            key={activity.id}
            id={activity.id}
            title={activity.title}
            icon={activity.icon}
            isActive={activeView === activity.id}
            onClick={onSelectView}
          />
        ))}
      </div>
      
      <div className="flex flex-col w-full mb-1">
        {bottomActivities.map(activity => (
          <ActivityItem
            key={activity.id}
            id={activity.id}
            title={activity.title}
            icon={activity.icon}
            isActive={activeView === activity.id}
            onClick={onSelectView}
          />
        ))}
      </div>
    </div>
  );
};

export default ActivityBar; 