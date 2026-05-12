import React from 'react';
import { FiX, FiCopy, FiCode } from 'react-icons/fi';
import '../styles/DebugPanel.css';

function DebugPanel({ isOpen, request, onClose }) {
  if (!isOpen || !request) {
    return null;
  }

  const buildCurl = () => {
    const headers = request.headers || {};
    const headerString = Object.entries(headers)
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' ');
    const body = request.body ? `-d '${JSON.stringify(request.body)}'` : '';
    return `curl -X ${request.method} "${request.url}" ${headerString} ${body}`.trim();
  };

  const buildAxios = () => {
    const headers = JSON.stringify(request.headers || {}, null, 2);
    const body = request.body ? JSON.stringify(request.body, null, 2) : 'null';
    return `import axios from 'axios';

const response = await axios({
  method: '${request.method}',
  url: '${request.url}',
  headers: ${headers},
  data: ${body},
});

console.log(response.data);`;
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`${label} copied`);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  };

  return (
    <div className="debug-panel-overlay">
      <div className="debug-panel glass-lg">
        <div className="debug-panel-header">
          <div>
            <h3>Internal Debug Panel</h3>
            <p>Inspect request payloads, headers, timing, and replay options without leaving the app.</p>
          </div>
          <button className="icon-button" onClick={onClose} title="Close debug panel">
            <FiX size={18} />
          </button>
        </div>

        <div className="debug-panel-body">
          <section className="debug-section">
            <h4>Request Overview</h4>
            <div className="debug-grid">
              <div>
                <span>Endpoint</span>
                <p>{request.url}</p>
              </div>
              <div>
                <span>Method</span>
                <p>{request.method}</p>
              </div>
              <div>
                <span>Timestamp</span>
                <p>{new Date(request.timestamp || Date.now()).toLocaleString()}</p>
              </div>
            </div>
          </section>

          <section className="debug-section">
            <h4>Headers</h4>
            <pre>{JSON.stringify(request.headers || {}, null, 2)}</pre>
          </section>

          <section className="debug-section">
            <h4>Payload</h4>
            <pre>{typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {}, null, 2)}</pre>
          </section>

          <section className="debug-section debug-snippets">
            <div>
              <div className="debug-snippet-header">
                <h4>cURL</h4>
                <button className="icon-button small" onClick={() => copyToClipboard(buildCurl(), 'cURL')}>
                  <FiCopy size={16} />
                </button>
              </div>
              <pre>{buildCurl()}</pre>
            </div>
            <div>
              <div className="debug-snippet-header">
                <h4>Axios</h4>
                <button className="icon-button small" onClick={() => copyToClipboard(buildAxios(), 'Axios')}>
                  <FiCopy size={16} />
                </button>
              </div>
              <pre>{buildAxios()}</pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
