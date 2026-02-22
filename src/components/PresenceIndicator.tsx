'use client';

import { useEffect, useState } from 'react';

interface PresenceIndicatorProps {
  status: 'available' | 'busy' | 'dnd' | 'offline';
  message?: string;
  lastActivity?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showMessage?: boolean;
}

export default function PresenceIndicator({ 
  status, 
  message, 
  lastActivity, 
  size = 'md',
  showLabel = true,
  showMessage = true
}: PresenceIndicatorProps) {
  const [actualStatus, setActualStatus] = useState(status);

  useEffect(() => {
    // Check if user should be marked as offline based on last activity
    if (lastActivity && status !== 'offline') {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const lastActivityDate = new Date(lastActivity);
      
      if (lastActivityDate < fiveMinutesAgo) {
        setActualStatus('offline');
      } else {
        setActualStatus(status);
      }
    } else {
      setActualStatus(status);
    }
  }, [status, lastActivity]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'available':
        return {
          color: 'bg-green-500',
          label: 'Available',
          textColor: 'text-green-800',
          bgColor: 'bg-green-100'
        };
      case 'busy':
        return {
          color: 'bg-red-500',
          label: 'Busy',
          textColor: 'text-red-800',
          bgColor: 'bg-red-100'
        };
      case 'dnd':
        return {
          color: 'bg-red-600',
          label: 'Do Not Disturb',
          textColor: 'text-red-800',
          bgColor: 'bg-red-100'
        };
      case 'offline':
      default:
        return {
          color: 'bg-gray-400',
          label: 'Offline',
          textColor: 'text-gray-800',
          bgColor: 'bg-gray-100'
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return {
          dot: 'w-2 h-2',
          text: 'text-xs',
          container: 'space-x-1'
        };
      case 'lg':
        return {
          dot: 'w-4 h-4',
          text: 'text-sm',
          container: 'space-x-3'
        };
      case 'md':
      default:
        return {
          dot: 'w-3 h-3',
          text: 'text-xs',
          container: 'space-x-2'
        };
    }
  };

  const statusConfig = getStatusConfig(actualStatus);
  const sizeClasses = getSizeClasses(size);

  const formatLastActivity = (lastActivity: string) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diffMs = now.getTime() - activity.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) { // 24 hours
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffMins / 1440);
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className={`flex items-center ${sizeClasses.container}`}>
      {/* Status Dot */}
      <div className="relative">
        <div className={`${sizeClasses.dot} ${statusConfig.color} rounded-full`}>
          {/* Pulse animation for available status */}
          {actualStatus === 'available' && (
            <div className={`absolute inset-0 ${statusConfig.color} rounded-full animate-ping opacity-30`}></div>
          )}
        </div>
      </div>

      {/* Status Info */}
      <div className="flex flex-col">
        {showLabel && (
          <span className={`${sizeClasses.text} font-medium ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
        )}
        
        {showMessage && message && (
          <span className={`${sizeClasses.text === 'text-xs' ? 'text-xs' : 'text-xs'} text-gray-500 truncate max-w-24`}>
            {message}
          </span>
        )}
        
        {lastActivity && actualStatus === 'offline' && (
          <span className="text-xs text-gray-400">
            {formatLastActivity(lastActivity)}
          </span>
        )}
      </div>
    </div>
  );
}

// Utility component for just the presence dot (for use in compact spaces)
export function PresenceDot({ status, lastActivity }: { status: string; lastActivity?: string }) {
  return (
    <PresenceIndicator 
      status={status as any}
      lastActivity={lastActivity}
      size="sm"
      showLabel={false}
      showMessage={false}
    />
  );
}

// Utility component for presence with tooltip (for hover details)
export function PresenceWithTooltip({ 
  status, 
  message, 
  lastActivity, 
  userName 
}: { 
  status: string; 
  message?: string; 
  lastActivity?: string; 
  userName?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const statusConfig = {
    available: 'Available',
    busy: 'Busy',
    dnd: 'Do Not Disturb',
    offline: 'Offline'
  }[status] || 'Unknown';

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <PresenceIndicator 
        status={status as any}
        lastActivity={lastActivity}
        size="sm"
        showLabel={false}
        showMessage={false}
      />
      
      {showTooltip && (
        <div className="absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm tooltip bottom-full left-1/2 transform -translate-x-1/2 -translate-y-2">
          <div className="flex flex-col space-y-1">
            <span className="font-semibold">{userName && `${userName}: `}{statusConfig}</span>
            {message && <span className="text-gray-300">{message}</span>}
            {lastActivity && status === 'offline' && (
              <span className="text-gray-400 text-xs">
                Last active: {new Date(lastActivity).toLocaleString()}
              </span>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="tooltip-arrow absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}