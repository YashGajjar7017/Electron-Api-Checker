import React, { useEffect, useState } from 'react';
import useStore from '../store';
import { FiPlus, FiFolder, FiTrash2, FiEdit2, FiChevronDown } from 'react-icons/fi';
import '../styles/Sidebar.css';

function Sidebar() {
  const {
    collections,
    addCollection,
    deleteCollection,
    apis,
    addAPI,
    setCurrentAPI,
    currentAPI,
  } = useStore();

  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);

  // Auto-save apis when they change
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.saveAPIs) {
      window.electronAPI.saveAPIs(apis);
    }
  }, [apis]);

  const toggleFolder = (collectionId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleAddCollection = () => {
    if (newCollectionName.trim()) {
      const collection = {
        id: Math.random().toString(36).substr(2, 9),
        name: newCollectionName,
        apis: [],
        createdAt: new Date(),
      };
      addCollection(collection);
      setNewCollectionName('');
      setShowNewCollection(false);

      // Auto-save to electron storage
      if (window.electronAPI && window.electronAPI.saveCollections) {
        const allCollections = [...collections, collection];
        window.electronAPI.saveCollections(allCollections);
      }
    }
  };

  // Auto-save collections when they change
  useEffect(() => {
    if (collections.length > 0 && window.electronAPI && window.electronAPI.saveCollections) {
      window.electronAPI.saveCollections(collections);
    }
  }, [collections]);

  const handleAddAPI = (collectionId) => {
    const api = {
      id: Math.random().toString(36).substr(2, 9),
      collectionId,
      name: 'New API',
      method: 'GET',
      endpoint: '/api/endpoint',
      headers: {},
      params: {},
      body: '',
      auth: { type: 'none', token: '' },
    };
    addAPI(api);
    setCurrentAPI(api);
  };

  const handleDeleteCollection = (collectionId) => {
    if (window.confirm('Delete this collection?')) {
      deleteCollection(collectionId);
      const updated = collections.filter((c) => c.id !== collectionId);
      // Auto-save after deletion
      if (window.electronAPI && window.electronAPI.saveCollections) {
        window.electronAPI.saveCollections(updated);
      }
    }
  };

  const getCollectionAPIs = (collectionId) => {
    return apis.filter((api) => api.collectionId === collectionId);
  };

  return (
    <div className="sidebar glass-lg">
      <div className="sidebar-header">
        <h2>Collections</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowNewCollection(!showNewCollection)}
          title="Add new collection"
        >
          <FiPlus size={16} />
        </button>
      </div>

      {showNewCollection && (
        <div className="new-collection-form">
          <input
            type="text"
            placeholder="Collection name..."
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleAddCollection();
            }}
            autoFocus
          />
          <div className="form-actions">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddCollection}
            >
              Create
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowNewCollection(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="collections-list">
        {collections && collections.length > 0 ? (
          collections.map((collection) => (
            <div key={collection.id} className="collection-item">
              <div className="collection-header">
                <button
                  className="expand-btn"
                  onClick={() => toggleFolder(collection.id)}
                >
                  <FiChevronDown
                    className={
                      expandedFolders.has(collection.id) ? 'rotated' : ''
                    }
                  />
                </button>
                <FiFolder size={18} className="folder-icon" />
                <span className="collection-name">{collection.name}</span>
                <div className="collection-actions">
                  <button
                    className="action-btn"
                    onClick={() => handleAddAPI(collection.id)}
                    title="Add API"
                  >
                    <FiPlus size={14} />
                  </button>
                  <button
                    className="action-btn danger"
                    onClick={() => handleDeleteCollection(collection.id)}
                    title="Delete collection"
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedFolders.has(collection.id) && (
                <div className="api-list">
                  {getCollectionAPIs(collection.id).map((api) => (
                    <div
                      key={api.id}
                      className={`api-item ${
                        currentAPI?.id === api.id ? 'active' : ''
                      }`}
                      onClick={() => setCurrentAPI(api)}
                    >
                      <span className={`method-badge method-${api.method.toLowerCase()}`}>
                        {api.method}
                      </span>
                      <span className="api-name">{api.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>No collections yet</p>
            <p className="text-muted">Create a new collection to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
