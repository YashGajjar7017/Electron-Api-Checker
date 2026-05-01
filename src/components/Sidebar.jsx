import React, { useEffect, useState } from 'react';
import useStore from '../store';
import { FiPlus, FiFolder, FiTrash2, FiEdit2, FiChevronDown, FiUpload, FiCopy, FiDownload, FiShuffle, FiChevronUp } from 'react-icons/fi';
import parsePostmanCollection from '../utils/postmanParser';
import '../styles/Sidebar.css';

function Sidebar() {
  const {
    collections,
    addCollection,
    deleteCollection,
    apis,
    addAPI,
    updateAPI,
    deleteAPI,
    setCurrentAPI,
    currentAPI,
    shuffleCollections,
    shuffleAPIs,
  } = useStore();

  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingApiId, setEditingApiId] = useState(null);
  const [editApiName, setEditApiName] = useState('');

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

  const handleDuplicateCollection = (collection, e) => {
    e.stopPropagation();
    const newCollection = {
      ...collection,
      id: Math.random().toString(36).substr(2, 9),
      name: `${collection.name} (Copy)`,
      createdAt: new Date(),
    };
    addCollection(newCollection);

    // Duplicate all APIs in this collection
    const collectionAPIs = getCollectionAPIs(collection.id);
    collectionAPIs.forEach((api) => {
      addAPI({
        ...api,
        id: Math.random().toString(36).substr(2, 9),
        collectionId: newCollection.id,
      });
    });

    // Auto-save
    if (window.electronAPI && window.electronAPI.saveCollections) {
      window.electronAPI.saveCollections([...collections, newCollection]);
    }
  };

  const handleExportCollection = (collection, e) => {
    e.stopPropagation();
    const collectionAPIs = getCollectionAPIs(collection.id);
    const exportData = {
      collection: {
        name: collection.name,
        createdAt: collection.createdAt,
        apiCount: collectionAPIs.length,
      },
      apis: collectionAPIs,
      exportedAt: new Date(),
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${collection.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startEditApiName = (api, e) => {
    e.stopPropagation();
    setEditingApiId(api.id);
    setEditApiName(api.name);
  };

  const saveApiName = (apiId) => {
    if (editApiName.trim()) {
      updateAPI(apiId, { name: editApiName.trim() });
    }
    setEditingApiId(null);
    setEditApiName('');
  };

  const handleDeleteAPI = (apiId, e) => {
    e.stopPropagation();
    if (window.confirm('Delete this API?')) {
      deleteAPI(apiId);
      if (currentAPI?.id === apiId) {
        setCurrentAPI(null);
      }
    }
  };

  const getCollectionAPIs = (collectionId) => {
    return apis.filter((api) => api.collectionId === collectionId);
  };

  const moveAPI = (apiId, direction) => {
    const api = apis.find(a => a.id === apiId);
    if (!api) return;

    const collectionAPIs = getCollectionAPIs(api.collectionId);
    const currentIndex = collectionAPIs.findIndex(a => a.id === apiId);
    
    if (direction === 'up' && currentIndex > 0) {
      // Swap with previous
      const temp = collectionAPIs[currentIndex];
      collectionAPIs[currentIndex] = collectionAPIs[currentIndex - 1];
      collectionAPIs[currentIndex - 1] = temp;
    } else if (direction === 'down' && currentIndex < collectionAPIs.length - 1) {
      // Swap with next
      const temp = collectionAPIs[currentIndex];
      collectionAPIs[currentIndex] = collectionAPIs[currentIndex + 1];
      collectionAPIs[currentIndex + 1] = temp;
    }

    // Update the order by remapping API list
    const sortedAPIs = [
      ...apis.filter(a => a.collectionId !== api.collectionId),
      ...collectionAPIs,
    ];
    
    // Persist the new order
    if (window.electronAPI && window.electronAPI.saveAPIs) {
      window.electronAPI.saveAPIs(sortedAPIs);
    }
    
    // Update store with new order
    useStore.getState().setAPIs(sortedAPIs);
  };

  const handleFileImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Check if this is a Postman collection
      const isPostmanCollection = jsonData.info && jsonData.item && Array.isArray(jsonData.item);

      let collectionName = file.name.split('.')[0];
      if (isPostmanCollection) {
        collectionName = jsonData.info.name || collectionName;
      }

      // Create new collection for import
      const newCollection = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${collectionName} (${new Date().toLocaleDateString()})`,
        apis: [],
        createdAt: new Date(),
      };
      addCollection(newCollection);

      let importedAPIs = [];

      if (isPostmanCollection) {
        // Parse Postman collection
        const parsedAPIs = parsePostmanCollection(jsonData);
        importedAPIs = parsedAPIs.map((api) => ({
          ...api,
          id: Math.random().toString(36).substr(2, 9),
          collectionId: newCollection.id,
        }));
      } else if (Array.isArray(jsonData)) {
        // Handle array of objects
        importedAPIs = jsonData.map((item, idx) => {
          let headers = {};
          let params = {};
          let auth = { type: 'none', token: '' };

          if (item.headers) {
            if (typeof item.headers === 'string') {
              try { headers = JSON.parse(item.headers); } catch { headers = {}; }
            } else {
              headers = item.headers;
            }
          }

          if (item.params) {
            if (typeof item.params === 'string') {
              try { params = JSON.parse(item.params); } catch { params = {}; }
            } else {
              params = item.params;
            }
          }

          if (item.auth) {
            if (typeof item.auth === 'string') {
              try { auth = JSON.parse(item.auth); } catch { auth = { type: 'none', token: '' }; }
            } else {
              auth = item.auth;
            }
          }

          return {
            id: Math.random().toString(36).substr(2, 9),
            collectionId: newCollection.id,
            name: item.name || item.endpoint || `Imported API ${idx + 1}`,
            method: item.method || 'GET',
            endpoint: item.endpoint || '/',
            headers,
            params,
            body: item.body || '',
            auth,
          };
        });
      }

      if (importedAPIs.length === 0) {
        alert('No APIs found in file');
        e.target.value = '';
        return;
      }

      // Add all imported APIs
      importedAPIs.forEach((api) => addAPI(api));

      // Persist to storage
      if (window.electronAPI && window.electronAPI.saveCollections) {
        window.electronAPI.saveCollections([...collections, newCollection]);
      }
      if (window.electronAPI && window.electronAPI.saveAPIs) {
        const allAPIs = [...apis, ...importedAPIs];
        window.electronAPI.saveAPIs(allAPIs);
      }

      setExpandedFolders((prev) => new Set(prev).add(newCollection.id));

      alert(`Successfully imported ${importedAPIs.length} APIs from ${file.name}`);
      if (importedAPIs.length > 0) {
        setCurrentAPI(importedAPIs[0]);
      }
    } catch (error) {
      alert(`Error importing file: ${error.message}`);
      console.error('Import error:', error);
    }

    e.target.value = '';
  };

  return (
    <div className="sidebar glass-lg">
      <div className="sidebar-header">
        <h2>Collections</h2>
        <div className="header-actions">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowNewCollection(!showNewCollection)}
            title="Add new collection"
          >
            <FiPlus size={16} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Shuffle all collections?')) {
                shuffleCollections();
              }
            }}
            title="Randomize collection order"
          >
            <FiShuffle size={16} />
          </button>
          <label className="btn btn-secondary btn-sm" title="Import JSON or CSV">
            <FiUpload size={16} />
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
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
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Shuffle APIs in "${collection.name}"?`)) {
                        const collectionAPIs = apis.filter(a => a.collectionId === collection.id);
                        shuffleAPIs();
                      }
                    }}
                    title="Shuffle APIs in this collection"
                  >
                    <FiShuffle size={14} />
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => handleDuplicateCollection(collection, e)}
                    title="Duplicate collection"
                  >
                    <FiCopy size={14} />
                  </button>
                  <button
                    className="action-btn"
                    onClick={(e) => handleExportCollection(collection, e)}
                    title="Export collection"
                  >
                    <FiDownload size={14} />
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
                  {getCollectionAPIs(collection.id).map((api, index) => {
                    const collectionAPIs = getCollectionAPIs(collection.id);
                    const isFirst = index === 0;
                    const isLast = index === collectionAPIs.length - 1;
                    
                    return (
                      <div
                        key={api.id}
                        className={`api-item ${
                          currentAPI?.id === api.id ? 'active' : ''
                        }`}
                        onClick={() => setCurrentAPI(api)}
                      >
                        <div className="api-item-header">
                          <span className={`method-badge method-${api.method.toLowerCase()}`}>
                            {api.method}
                          </span>
                          {editingApiId === api.id ? (
                            <input
                              type="text"
                              className="api-rename-input"
                              value={editApiName}
                              onChange={(e) => setEditApiName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') saveApiName(api.id);
                                if (e.key === 'Escape') {
                                  setEditingApiId(null);
                                  setEditApiName('');
                                }
                              }}
                              onBlur={() => saveApiName(api.id)}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="api-name">{api.name}</span>
                          )}
                          <div className="api-item-actions">
                            <button
                              className="api-rename-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveAPI(api.id, 'up');
                              }}
                              disabled={isFirst}
                              title="Move up"
                            >
                              <FiChevronUp size={12} />
                            </button>
                            <button
                              className="api-rename-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveAPI(api.id, 'down');
                              }}
                              disabled={isLast}
                              title="Move down"
                            >
                              <FiChevronDown size={12} />
                            </button>
                            <button
                              className="api-rename-btn"
                              onClick={(e) => startEditApiName(api, e)}
                              title="Rename API"
                            >
                              <FiEdit2 size={12} />
                            </button>
                            <button
                              className="api-rename-btn danger"
                              onClick={(e) => handleDeleteAPI(api.id, e)}
                              title="Delete API"
                            >
                              <FiTrash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="api-item-details">
                          <span className="api-item-endpoint">{api.endpoint}</span>
                        </div>
                      </div>
                    );
                  })}
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
