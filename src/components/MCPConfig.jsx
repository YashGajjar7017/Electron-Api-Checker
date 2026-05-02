import React, { useState, useEffect } from 'react';
import useStore from '../store';
import { FiSettings, FiSave, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import '../styles/MCPConfig.css';

function MCPConfig({ isOpen, onClose }) {
  const {
    mcpServers,
    addMCPServer,
    updateMCPServer,
    deleteMCPServer,
    setMCPServers,
  } = useStore();

  const [servers, setServers] = useState(mcpServers || []);
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
    enabled: true,
    config: {}
  });
  const [editingServer, setEditingServer] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setServers(mcpServers || []);
    }
  }, [isOpen, mcpServers]);

  const handleAddServer = () => {
    if (newServer.name.trim() && newServer.url.trim()) {
      const server = {
        id: Math.random().toString(36).substr(2, 9),
        ...newServer
      };
      addMCPServer(server);
      setNewServer({ name: '', url: '', enabled: true, config: {} });
    }
  };

  const handleUpdateServer = (id, updates) => {
    updateMCPServer(id, updates);
  };

  const handleDeleteServer = (id) => {
    deleteMCPServer(id);
  };

  const handleSave = () => {
    setMCPServers(servers);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="mcp-modal-overlay">
      <div className="mcp-modal">
        <div className="mcp-modal-header">
          <h2><FiSettings size={20} /> MCP Configuration</h2>
          <button className="mcp-close-btn" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="mcp-modal-content">
          <div className="mcp-section">
            <h3>Model Context Protocol Servers</h3>
            <p className="mcp-description">
              Configure MCP servers to extend the capabilities of your API testing environment.
              MCP allows you to integrate with various AI models and tools.
            </p>

            {/* Add New Server */}
            <div className="mcp-add-server">
              <h4>Add New Server</h4>
              <div className="mcp-form-row">
                <input
                  type="text"
                  placeholder="Server Name"
                  value={newServer.name}
                  onChange={(e) => setNewServer({...newServer, name: e.target.value})}
                />
                <input
                  type="url"
                  placeholder="Server URL"
                  value={newServer.url}
                  onChange={(e) => setNewServer({...newServer, url: e.target.value})}
                />
                <button
                  className="mcp-add-btn"
                  onClick={handleAddServer}
                  disabled={!newServer.name.trim() || !newServer.url.trim()}
                >
                  <FiPlus size={16} /> Add
                </button>
              </div>
            </div>

            {/* Server List */}
            <div className="mcp-server-list">
              <h4>Configured Servers</h4>
              {servers.length === 0 ? (
                <p className="mcp-no-servers">No MCP servers configured yet.</p>
              ) : (
                servers.map(server => (
                  <div key={server.id} className="mcp-server-item">
                    <div className="mcp-server-info">
                      <div className="mcp-server-name">{server.name}</div>
                      <div className="mcp-server-url">{server.url}</div>
                    </div>
                    <div className="mcp-server-controls">
                      <label className="mcp-toggle">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => handleUpdateServer(server.id, { enabled: e.target.checked })}
                        />
                        <span className="mcp-toggle-slider"></span>
                        Enabled
                      </label>
                      <button
                        className="mcp-delete-btn"
                        onClick={() => handleDeleteServer(server.id)}
                        title="Delete server"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Global Settings */}
          <div className="mcp-section">
            <h3>Global Settings</h3>
            <div className="mcp-setting">
              <label>
                <input type="checkbox" defaultChecked />
                Enable MCP integration
              </label>
            </div>
            <div className="mcp-setting">
              <label>
                <input type="checkbox" defaultChecked />
                Auto-connect to enabled servers on startup
              </label>
            </div>
            <div className="mcp-setting">
              <label>
                Timeout (seconds):
                <input type="number" defaultValue="30" min="5" max="300" />
              </label>
            </div>
          </div>
        </div>

        <div className="mcp-modal-footer">
          <button className="mcp-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="mcp-save-btn" onClick={handleSave}>
            <FiSave size={16} /> Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export default MCPConfig;