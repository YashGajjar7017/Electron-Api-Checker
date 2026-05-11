import React from 'react';
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
import useStore from '../store';
import '../styles/PerformancePanel.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function PerformancePanel() {
  const { responseHistory, performanceMetrics } = useStore((state) => ({
    responseHistory: state.responseHistory,
    performanceMetrics: state.performanceMetrics,
  }));

  const recentHistory = [...responseHistory].slice(0, 12).reverse();
  const labels = recentHistory.map((item) =>
    item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'
  );

  const data = {
    labels,
    datasets: [
      {
        label: 'Response Time (ms)',
        data: recentHistory.map((item) => item.responseTime || item.duration || 0),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.25)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: 'Payload Size (KB)',
        data: recentHistory.map((item) => item.responseSize ? Number((item.responseSize / 1024).toFixed(2)) : 0),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#cbd5e1' } },
      title: {
        display: true,
        text: 'Performance Overview',
        color: '#f8fafc',
        font: { size: 14, weight: '600' },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.15)' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148, 163, 184, 0.15)' } },
    },
  };

  return (
    <div className="performance-panel glass-lg">
      <div className="performance-header">
        <h3>Live Performance</h3>
        <p>{performanceMetrics.length} metrics captured</p>
      </div>
      <div className="performance-chart">
        <Line data={data} options={options} />
      </div>
      <div className="performance-summary">
        <div>
          <span>Requests</span>
          <strong>{responseHistory.length}</strong>
        </div>
        <div>
          <span>Last latency</span>
          <strong>{recentHistory[0]?.responseTime || recentHistory[0]?.duration || 0}ms</strong>
        </div>
        <div>
          <span>Average</span>
          <strong>{responseHistory.length > 0 ? Math.round(responseHistory.reduce((sum, item) => sum + (item.responseTime || item.duration || 0), 0) / responseHistory.length) : 0}ms</strong>
        </div>
      </div>
    </div>
  );
}

export default PerformancePanel;
