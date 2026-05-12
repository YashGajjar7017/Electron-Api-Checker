import React, { useEffect, useMemo, useState } from 'react';
import useStore from '../store';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import '../styles/PerformanceDashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
};

function PerformanceDashboard() {
  const { responseHistory, performanceMetrics } = useStore((state) => ({
    responseHistory: state.responseHistory,
    performanceMetrics: state.performanceMetrics,
  }));

  const [collapsed, setCollapsed] = useState(false);
  const [systemInfo, setSystemInfo] = useState({ cpu: null, ram: null });

  useEffect(() => {
    let interval;
    const refreshSystemInfo = async () => {
      if (window.electronAPI?.getSystemInfo) {
        try {
          const info = await window.electronAPI.getSystemInfo();
          setSystemInfo(info || {});
        } catch (error) {
          console.warn('Failed to fetch system info', error);
        }
      }
    };

    refreshSystemInfo();
    if (window.electronAPI?.getSystemInfo) {
      interval = setInterval(refreshSystemInfo, 5000);
    }

    return () => clearInterval(interval);
  }, []);

  const recentResponses = useMemo(() => {
    return [...responseHistory]
      .slice(-14)
      .map((item) => ({
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
        responseTime: item.responseTime || item.duration || 0,
        status: item.status || 0,
        responseSize: item.responseSize || 0,
        success: item.success || (item.status >= 200 && item.status < 300),
      }))
      .reverse();
  }, [responseHistory]);

  const totalRequests = responseHistory.length;
  const failedRequests = responseHistory.filter((item) => !(item.success || (item.status >= 200 && item.status < 300))).length;
  const averageResponseTime = totalRequests
    ? Math.round(
        responseHistory.reduce((sum, item) => sum + (item.responseTime || item.duration || 0), 0) / totalRequests
      )
    : 0;
  const requestPerSecond = recentResponses.length > 1 ? (recentResponses.length / ((recentResponses[recentResponses.length - 1].timestamp - recentResponses[0].timestamp) / 1000)).toFixed(1) : '–';
  const totalThroughput = responseHistory.reduce((sum, item) => sum + (item.responseSize || 0), 0);

  const chartData = {
    labels: recentResponses.map((item) => item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })),
    datasets: [
      {
        label: 'Latency (ms)',
        data: recentResponses.map((item) => item.responseTime),
        borderColor: '#7c3aed',
        backgroundColor: 'rgba(124, 58, 237, 0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
      {
        label: 'Throughput (KB)',
        data: recentResponses.map((item) => Number(((item.responseSize || 0) / 1024).toFixed(2))),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#cbd5e1' },
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
      y: {
        ticks: { color: '#cbd5e1' },
        grid: { color: 'rgba(148, 163, 184, 0.12)' },
      },
    },
  };

  return (
    <div className={`performance-dashboard glass-lg ${collapsed ? 'collapsed' : ''}`}>
      <div className="dashboard-header">
        <div>
          <span className="dashboard-title">Live Performance Monitor</span>
          <p className="dashboard-subtitle">Real-time API monitoring and throughput insights</p>
        </div>
        <button className="dashboard-toggle" onClick={() => setCollapsed((prev) => !prev)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="dashboard-metrics">
            <div className="metric-card">
              <span>CPU</span>
              <strong>{systemInfo.cpu ?? 'N/A'}</strong>
            </div>
            <div className="metric-card">
              <span>RAM</span>
              <strong>{systemInfo.ram ? `${systemInfo.ram}%` : 'N/A'}</strong>
            </div>
            <div className="metric-card">
              <span>Active requests</span>
              <strong>{recentResponses.filter((item) => item.status === 0).length || 0}</strong>
            </div>
            <div className="metric-card">
              <span>Failed requests</span>
              <strong>{failedRequests}</strong>
            </div>
            <div className="metric-card">
              <span>Avg response</span>
              <strong>{averageResponseTime} ms</strong>
            </div>
            <div className="metric-card">
              <span>Req/sec</span>
              <strong>{requestPerSecond}</strong>
            </div>
          </div>

          <div className="dashboard-chart">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="dashboard-footer">
            <div className="footer-item">
              <span>Total requests</span>
              <strong>{totalRequests}</strong>
            </div>
            <div className="footer-item">
              <span>Network throughput</span>
              <strong>{formatBytes(totalThroughput)}</strong>
            </div>
            <div className="footer-item">
              <span>Captured points</span>
              <strong>{performanceMetrics.length}</strong>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PerformanceDashboard;
