import React, { useEffect, useState, useRef } from 'react';
import { FiX, FiMinus, FiMaximize2 } from 'react-icons/fi';
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
import '../styles/SystemMonitor.css';

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

function SystemMonitor({ isOpen, onClose }) {
  const [systemMetrics, setSystemMetrics] = useState({
    cpu: 0,
    ram: 0,
    disk: 0,
    appMemory: 0,
    networkUp: 0,
    networkDown: 0,
    activeRequests: 0,
    failedRequests: 0,
    requestsPerSec: 0,
    isOnline: true,
    uptime: 0,
    automationTasks: 0,
  });

  const [history, setHistory] = useState({
    cpu: [],
    ram: [],
    network: [],
    requests: [],
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchSystemInfo = async () => {
      if (window.electronAPI?.getSystemInfo) {
        try {
          const info = await window.electronAPI.getSystemInfo();
          setSystemMetrics((prev) => ({
            ...prev,
            ...info,
            isOnline: navigator.onLine,
          }));

          // Keep only last 30 data points for charts
          setHistory((prev) => ({
            cpu: [...prev.cpu.slice(-29), info.cpu || 0],
            ram: [...prev.ram.slice(-29), info.ram || 0],
            network: [...prev.network.slice(-29), (info.networkDown || 0) + (info.networkUp || 0)],
            requests: [...prev.requests.slice(-29), info.requestsPerSec || 0],
          }));
        } catch (error) {
          console.warn('Failed to fetch system metrics', error);
        }
      }
    };

    const interval = setInterval(fetchSystemInfo, 1000);
    fetchSystemInfo();

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleMouseDown = (e) => {
    if (e.target.closest('.monitor-header')) {
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - (rect?.left || 0),
        y: e.clientY - (rect?.top || 0),
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  const cpuChartData = {
    labels: history.cpu.map((_, i) => i),
    datasets: [
      {
        label: 'CPU %',
        data: history.cpu,
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };

  const ramChartData = {
    labels: history.ram.map((_, i) => i),
    datasets: [
      {
        label: 'RAM %',
        data: history.ram,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { intersect: false, mode: 'index' },
    },
    scales: {
      y: { min: 0, max: 100, display: false },
      x: { display: false },
    },
  };

  const monitorContent = (
    <>
      <div className="monitor-header" onMouseDown={handleMouseDown}>
        <div className="monitor-title">
          <span className="status-indicator" />
          System Monitor
        </div>
        <div className="monitor-actions">
          <button onClick={() => setIsMinimized((prev) => !prev)} className="icon-btn">
            <FiMinus />
          </button>
          <button onClick={() => setIsFullscreen((prev) => !prev)} className="icon-btn">
            <FiMaximize2 />
          </button>
          <button onClick={onClose} className="icon-btn">
            <FiX />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="monitor-body">
          <div className="metrics-grid">
            <div className="metric-box">
              <span className="metric-label">CPU</span>
              <div className="metric-value">{systemMetrics.cpu}%</div>
              <div className="metric-bar">
                <div
                  className={`metric-fill ${systemMetrics.cpu > 80 ? 'critical' : systemMetrics.cpu > 60 ? 'warning' : 'ok'}`}
                  style={{ width: `${systemMetrics.cpu}%` }}
                />
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">RAM</span>
              <div className="metric-value">{systemMetrics.ram}%</div>
              <div className="metric-bar">
                <div
                  className={`metric-fill ${systemMetrics.ram > 80 ? 'critical' : systemMetrics.ram > 60 ? 'warning' : 'ok'}`}
                  style={{ width: `${systemMetrics.ram}%` }}
                />
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Disk</span>
              <div className="metric-value">{systemMetrics.disk}%</div>
              <div className="metric-bar">
                <div
                  className={`metric-fill ${systemMetrics.disk > 80 ? 'critical' : systemMetrics.disk > 60 ? 'warning' : 'ok'}`}
                  style={{ width: `${systemMetrics.disk}%` }}
                />
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">App Memory</span>
              <div className="metric-value">{formatBytes(systemMetrics.appMemory)}</div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Active Requests</span>
              <div className="metric-value" style={{ color: '#22c55e' }}>
                {systemMetrics.activeRequests}
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Failed</span>
              <div className="metric-value" style={{ color: '#f87171' }}>
                {systemMetrics.failedRequests}
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Req/sec</span>
              <div className="metric-value">{systemMetrics.requestsPerSec.toFixed(1)}</div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Network</span>
              <div className="metric-value" style={{ fontSize: '0.85rem' }}>
                ↓ {formatBytes(systemMetrics.networkDown)}/s ↑ {formatBytes(systemMetrics.networkUp)}/s
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Connectivity</span>
              <div className="metric-value" style={{ color: systemMetrics.isOnline ? '#22c55e' : '#f87171' }}>
                {systemMetrics.isOnline ? 'Online' : 'Offline'}
              </div>
            </div>

            <div className="metric-box">
              <span className="metric-label">Automation Tasks</span>
              <div className="metric-value">{systemMetrics.automationTasks}</div>
            </div>
          </div>

          {!isFullscreen && (
            <div className="monitor-charts">
              <div className="chart-container">
                <span className="chart-title">CPU Usage</span>
                <Line data={cpuChartData} options={chartOptions} height={80} />
              </div>
              <div className="chart-container">
                <span className="chart-title">Memory Usage</span>
                <Line data={ramChartData} options={chartOptions} height={80} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isFullscreen) {
    return (
      <div className="system-monitor-fullscreen">
        <div className="fullscreen-container">{monitorContent}</div>
      </div>
    );
  }

  return (
    <div className="system-monitor-overlay">
      <div
        className={`system-monitor ${isMinimized ? 'minimized' : ''}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        ref={containerRef}
      >
        {monitorContent}
      </div>
    </div>
  );
}

export default SystemMonitor;
