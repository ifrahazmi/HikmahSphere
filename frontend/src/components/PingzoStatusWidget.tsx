import React, { useEffect, useState } from 'react';
import { Link, useInRouterContext } from 'react-router-dom';
import { checkLiveBackendHealth } from '../utils/backendHealth';

export type PingzoStatus = 'green' | 'yellow' | 'maintenance' | 'red' | 'unavailable' | 'loading';

export interface PingzoWidgetData {
  status: PingzoStatus;
  statusUrl: string;
  siteId: string;
}

export interface PingzoStatusWidgetProps {
  siteId?: string;
  statusUrl?: string;
  variant?: 'badge' | 'dot';
  className?: string;
  onStatusChange?: (status: PingzoStatus) => void;
}

const DEFAULT_SITE_ID = 'cmv41n3wg018uk206v73c9fy9';
const DEFAULT_STATUS_URL = '/status';

export const PingzoStatusWidget: React.FC<PingzoStatusWidgetProps> = ({
  siteId = DEFAULT_SITE_ID,
  statusUrl = DEFAULT_STATUS_URL,
  variant = 'badge',
  className = '',
  onStatusChange,
}) => {
  const [data, setData] = useState<PingzoWidgetData>({
    status: 'loading',
    statusUrl,
    siteId,
  });

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        // 1. Direct verification against https://hikmahsphere-backend.onrender.com/health
        const liveHealth = await checkLiveBackendHealth();

        if (liveHealth.status === 'healthy') {
          if (active) {
            setData({
              status: 'green',
              statusUrl,
              siteId,
            });
            onStatusChange?.('green');
          }
          return;
        }

        if (liveHealth.status === 'degraded') {
          if (active) {
            setData({
              status: 'yellow',
              statusUrl,
              siteId,
            });
            onStatusChange?.('yellow');
          }
          return;
        }

        // 2. If direct health check is down or unreachable, check Pingzo as fallback metadata
        let resolvedStatus: PingzoStatus = 'red';
        try {
          const response = await fetch(
            `https://www.pingzoapp.com/api/widget-status?siteId=${encodeURIComponent(siteId)}`,
            {
              headers: { Accept: 'application/json' },
            }
          );

          if (response.ok) {
            const json = await response.json();
            if (json && json.status) {
              resolvedStatus = json.status;
            }
          }
        } catch {
          resolvedStatus = 'unavailable';
        }

        if (active) {
          setData({
            status: resolvedStatus,
            statusUrl,
            siteId,
          });
          onStatusChange?.(resolvedStatus);
        }
      } catch {
        if (active) {
          setData((prev) => ({ ...prev, status: 'unavailable' }));
          onStatusChange?.('unavailable');
        }
      }
    };

    void fetchStatus();

    // Poll every 60s while mounted (skip in test environment to avoid open handles)
    let interval: NodeJS.Timeout | undefined;
    if (process.env.NODE_ENV !== 'test') {
      interval = setInterval(() => {
        void fetchStatus();
      }, 60_000);
    }

    return () => {
      active = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [siteId, statusUrl, onStatusChange]);

  const { status, statusUrl: resolvedUrl } = data;

  let colorClasses = {
    bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    pulse: false,
    label: 'All Systems Operational',
  };

  if (status === 'loading') {
    colorClasses = {
      bg: 'bg-slate-500/10 border-slate-400/20 text-slate-500 dark:text-slate-400',
      dot: 'bg-slate-400',
      pulse: false,
      label: 'Checking server status…',
    };
  } else if (status === 'maintenance') {
    colorClasses = {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-500',
      pulse: true,
      label: 'Under Maintenance',
    };
  } else if (status === 'yellow') {
    colorClasses = {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
      pulse: true,
      label: 'Partial Outage',
    };
  } else if (status === 'red') {
    colorClasses = {
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
      dot: 'bg-rose-500',
      pulse: true,
      label: 'Incidents Reported',
    };
  } else if (status === 'unavailable') {
    colorClasses = {
      bg: 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400',
      dot: 'bg-rose-500',
      pulse: false,
      label: 'Server Status Unavailable',
    };
  }

  const inRouter = useInRouterContext();
  const isInternalUrl = resolvedUrl.startsWith('/');
  const shouldUseLink = inRouter && isInternalUrl;

  const badgeContent = (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {colorClasses.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClasses.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClasses.dot}`} />
      </span>
      <span>{colorClasses.label}</span>
    </span>
  );

  const dotContent = (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {colorClasses.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClasses.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colorClasses.dot}`} />
      </span>
      <span className="text-slate-700 dark:text-slate-200">{colorClasses.label}</span>
    </span>
  );

  if (variant === 'dot') {
    return (
      <div className={`inline-flex items-center gap-2 text-xs font-medium ${className}`}>
        {shouldUseLink ? (
          <Link
            to={resolvedUrl}
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="View live HikmahSphere systems status"
          >
            {dotContent}
          </Link>
        ) : (
          <a
            href={resolvedUrl}
            target={isInternalUrl ? undefined : '_blank'}
            rel={isInternalUrl ? undefined : 'noopener noreferrer'}
            className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="View live HikmahSphere systems status"
          >
            {dotContent}
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {shouldUseLink ? (
        <Link
          to={resolvedUrl}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] ${colorClasses.bg}`}
          title="View live HikmahSphere systems status"
        >
          {badgeContent}
        </Link>
      ) : (
        <a
          href={resolvedUrl}
          target={isInternalUrl ? undefined : '_blank'}
          rel={isInternalUrl ? undefined : 'noopener noreferrer'}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98] ${colorClasses.bg}`}
          title="View live HikmahSphere systems status"
        >
          {badgeContent}
        </a>
      )}
    </div>
  );
};

export default PingzoStatusWidget;
