import React, { useState, useEffect, useRef } from 'react';
import { FiDatabase, FiCpu, FiFileText, FiUpload, FiPlay, FiPlus, FiTrash2, FiSave, FiAlertCircle, FiSettings, FiCheck, FiRefreshCw, FiSliders, FiActivity, FiTerminal, FiInfo } from 'react-icons/fi';
import '../styles/BusConfig.css';

function BusConfig() {
  const [activeTab, setActiveTab] = useState('dev'); // dev, req, uuid
  const [devCsvContent, setDevCsvContent] = useState('');
  const [reqCsvContent, setReqCsvContent] = useState('');

  // Parsed state
  const [devices, setDevices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [uuidData, setUuidData] = useState(null);

  // Edit states for devices
  const [editingDevId, setEditingDevId] = useState(null);
  const [devForm, setDevForm] = useState({
    id: '',
    busId: '',
    slaveId: '',
    active: '1',
    ip: '',
    port: '502',
    protocol: '1'
  });

  // Edit states for requests
  const [editingReqId, setEditingReqId] = useState(null);
  const [reqForm, setReqForm] = useState({
    id: '',
    busId: '',
    slaveId: '',
    startAddress: '',
    length: '',
    requestType: '',
    deviceId: ''
  });

  // Selection states for Bus Activation
  const [activationConfig, setActivationConfig] = useState({
    busId: '',
    slaveId: '',
    active: '1',
    ip: '',
    port: '502',
    protocol: '1'
  });

  // UUID string state for text editor
  const [uuidString, setUuidString] = useState('');
  const [uuidError, setUuidError] = useState(null);

  // HTTP Sync states
  const [syncFileType, setSyncFileType] = useState('dev'); // dev, req
  const [syncActionType, setSyncActionType] = useState('write'); // write, delete
  const [syncUrlVal, setSyncUrlVal] = useState('http://192.168.4.1:85/write.html?dev.csv');
  const [syncScope, setSyncScope] = useState('all'); // all, single
  const [syncTargetId, setSyncTargetId] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const [syncLogs, setSyncLogs] = useState([]);
  const syncLogsEndRef = useRef(null);

  // Auto-update default URLs when syncFileType or syncActionType changes
  useEffect(() => {
    let file = 'dev.csv';
    if (syncFileType === 'req') file = 'req.csv';
    else if (syncFileType === 'uuid') file = 'uuid.json';

    const action = syncActionType === 'write' ? 'write.html' : 'delete.html';
    setSyncUrlVal(`http://192.168.4.1:85/${action}?${file}`);

    // Auto-select first ID from appropriate dataset
    if (syncFileType !== 'uuid') {
      const dataset = syncFileType === 'dev' ? devices : requests;
      if (dataset.length > 0) {
        setSyncTargetId(dataset[0].id);
      } else {
        setSyncTargetId('');
      }
    } else {
      setSyncTargetId('');
    }
  }, [syncFileType, syncActionType, devices, requests]);

  // Sync log scroll
  useEffect(() => {
    if (syncLogsEndRef.current) {
      syncLogsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [syncLogs]);

  const addSyncLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setSyncLogs((prev) => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  const handleExecuteSync = async () => {
    if (!syncUrlVal.trim()) {
      alert('Please enter a target URL.');
      return;
    }

    addSyncLog(`Executing Sync: ${syncActionType.toUpperCase()} on ${syncFileType.toUpperCase()}`, 'info');
    addSyncLog(`URL: ${syncUrlVal}`, 'info');

    let payload = '';
    if (syncActionType === 'write') {
      if (syncFileType === 'uuid' || syncScope === 'all') {
        payload = syncFileType === 'dev' ? devCsvContent : (syncFileType === 'req' ? reqCsvContent : uuidString);
        addSyncLog(`Syncing entire file (${payload.length} characters)`, 'info');
      } else {
        const headers = syncFileType === 'dev'
          ? ['id', 'busId', 'slaveId', 'active', 'ip', 'port', 'protocol']
          : ['id', 'busId', 'slaveId', 'startAddress', 'length', 'requestType', 'deviceId'];
        const array = syncFileType === 'dev' ? devices : requests;
        const selectedItem = array.find(item => item.id === syncTargetId);
        if (!selectedItem) {
          alert('Please select a valid record ID.');
          return;
        }
        payload = serializeCSV(headers, [selectedItem]);
        addSyncLog(`Syncing single row: ID=${syncTargetId}`, 'info');
      }
    } else if (syncActionType === 'delete') {
      addSyncLog(`Triggering delete for ID=${syncTargetId}`, 'info');
    } else if (syncActionType === 'delete_file') {
      addSyncLog(`Triggering delete of entire CSV file from device`, 'info');
    }

    try {
      if (window.electronAPI?.sendRequest) {
        let finalUrl = syncUrlVal;
        if (syncActionType === 'delete' && syncTargetId) {
          finalUrl += `&id=${syncTargetId}`;
        }

        const headers = {
          'Content-Type': syncFileType === 'uuid' ? 'application/json' : 'text/plain'
        };

        if (syncToken && syncToken.trim()) {
          const rawToken = syncToken.trim();
          headers['Authorization'] = rawToken.startsWith('Bearer ') || rawToken.startsWith('Basic ')
            ? rawToken
            : `Bearer ${rawToken}`;
        }

        const response = await window.electronAPI.sendRequest({
          url: finalUrl,
          method: 'POST',
          headers,
          body: syncActionType === 'write' ? payload : undefined
        });

        if (response.success && response.status >= 200 && response.status < 300) {
          addSyncLog(`HTTP Response Success! Status: ${response.status}`, 'success');
          if (response.body) {
            addSyncLog(`Response: ${response.body.substring(0, 500)}`, 'success');
          }
          if (syncFileType === 'uuid') {
            addSyncLog('Successfully synced uuid.json! Reverting File Target back to dev.csv.', 'success');
            setSyncFileType('dev');
          }
        } else {
          addSyncLog(`Sync failed. Status: ${response.status || 'ERROR'}. Info: ${response.error || response.body || 'No response details'}`, 'error');
        }
      } else {
        addSyncLog(`Error: Electron network API unavailable`, 'error');
      }
    } catch (e) {
      addSyncLog(`Error sending HTTP Sync: ${e.message}`, 'error');
    }
  };

  // Logs terminal
  const [activationLogs, setActivationLogs] = useState([]);
  const logsEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Parse CSV helper
  const parseCSV = (csvString) => {
    if (!csvString) return [];
    const lines = csvString.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] !== undefined ? values[index] : '';
      });
      return obj;
    });
  };

  // Convert array to CSV string
  const serializeCSV = (headers, dataArray) => {
    const headerLine = headers.join(',');
    const rowLines = dataArray.map(item => {
      return headers.map(header => item[header] !== undefined ? item[header] : '').join(',');
    });
    return [headerLine, ...rowLines].join('\n');
  };

  // Load files on mount
  useEffect(() => {
    loadAllConfigs();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activationLogs]);

  const loadAllConfigs = async () => {
    try {
      if (window.electronAPI) {
        // Load dev.csv
        const devContent = await window.electronAPI.loadDevCsv();
        setDevCsvContent(devContent);
        const parsedDevs = parseCSV(devContent);
        setDevices(parsedDevs);

        // Auto-select first device values for activation selectors if available
        if (parsedDevs.length > 0) {
          setActivationConfig({
            busId: parsedDevs[0].busId || '',
            slaveId: parsedDevs[0].slaveId || '',
            active: parsedDevs[0].active || '1',
            ip: parsedDevs[0].ip || '',
            port: parsedDevs[0].port || '502',
            protocol: parsedDevs[0].protocol || '1'
          });
        }

        // Load req.csv
        const reqContent = await window.electronAPI.loadReqCsv();
        setReqCsvContent(reqContent);
        setRequests(parseCSV(reqContent));

        // Load uuid.json
        const uuid = await window.electronAPI.loadUuidJson();
        if (uuid) {
          setUuidData(uuid);
          setUuidString(JSON.stringify(uuid, null, 2));
        } else {
          setUuidData(null);
          setUuidString('');
        }
      }
    } catch (err) {
      addLog(`Error loading configurations: ${err.message}`, 'error');
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    setActivationLogs((prev) => [...prev, `[${timestamp}] ${prefix} ${message}`]);
  };

  // Device CRUD Operations
  const handleSaveDev = async (e) => {
    e.preventDefault();
    if (!devForm.id || !devForm.busId || !devForm.slaveId) {
      alert('ID, Bus ID, and Slave ID are required.');
      return;
    }

    let nextDevices = [...devices];
    if (editingDevId !== null) {
      nextDevices = nextDevices.map(d => d.id === editingDevId ? devForm : d);
      setEditingDevId(null);
    } else {
      // Check duplicate ID
      if (devices.some(d => d.id === devForm.id)) {
        alert('A device with this ID already exists.');
        return;
      }
      nextDevices.push(devForm);
    }

    const headers = ['id', 'busId', 'slaveId', 'active', 'ip', 'port', 'protocol'];
    const newContent = serializeCSV(headers, nextDevices);

    try {
      const res = await window.electronAPI.saveDevCsv(newContent);
      if (res.success) {
        setDevCsvContent(newContent);
        setDevices(nextDevices);
        addLog(`dev.csv updated successfully. Saved ${nextDevices.length} items.`, 'success');
        resetDevForm();
      } else {
        alert('Failed to save dev.csv: ' + res.error);
      }
    } catch (err) {
      alert('Error saving dev.csv: ' + err.message);
    }
  };

  const handleDeleteDev = async (id) => {
    if (!window.confirm(`Are you sure you want to delete device ID: ${id}?`)) return;

    const nextDevices = devices.filter(d => d.id !== id);
    const headers = ['id', 'busId', 'slaveId', 'active', 'ip', 'port', 'protocol'];
    const newContent = serializeCSV(headers, nextDevices);

    try {
      const res = await window.electronAPI.saveDevCsv(newContent);
      if (res.success) {
        setDevCsvContent(newContent);
        setDevices(nextDevices);
        addLog(`Device ${id} deleted from dev.csv.`, 'success');
      } else {
        alert('Failed to save dev.csv: ' + res.error);
      }
    } catch (err) {
      alert('Error deleting item: ' + err.message);
    }
  };

  const handleEditDev = (dev) => {
    setEditingDevId(dev.id);
    setDevForm({ ...dev });
  };

  const resetDevForm = () => {
    setEditingDevId(null);
    setDevForm({
      id: '',
      busId: '',
      slaveId: '',
      active: '1',
      ip: '',
      port: '502',
      protocol: '1'
    });
  };

  // Request CRUD Operations
  const handleSaveReq = async (e) => {
    e.preventDefault();
    if (!reqForm.id || !reqForm.busId || !reqForm.deviceId) {
      alert('ID, Bus ID, and Device ID are required.');
      return;
    }

    let nextRequests = [...requests];
    if (editingReqId !== null) {
      nextRequests = nextRequests.map(r => r.id === editingReqId ? reqForm : r);
      setEditingReqId(null);
    } else {
      if (requests.some(r => r.id === reqForm.id)) {
        alert('A request with this ID already exists.');
        return;
      }
      nextRequests.push(reqForm);
    }

    const headers = ['id', 'busId', 'slaveId', 'startAddress', 'length', 'requestType', 'deviceId'];
    const newContent = serializeCSV(headers, nextRequests);

    try {
      const res = await window.electronAPI.saveReqCsv(newContent);
      if (res.success) {
        setReqCsvContent(newContent);
        setRequests(nextRequests);
        addLog(`req.csv updated successfully. Saved ${nextRequests.length} requests.`, 'success');
        resetReqForm();
      } else {
        alert('Failed to save req.csv: ' + res.error);
      }
    } catch (err) {
      alert('Error saving req.csv: ' + err.message);
    }
  };

  const handleDeleteReq = async (id) => {
    if (!window.confirm(`Are you sure you want to delete request ID: ${id}?`)) return;

    const nextRequests = requests.filter(r => r.id !== id);
    const headers = ['id', 'busId', 'slaveId', 'startAddress', 'length', 'requestType', 'deviceId'];
    const newContent = serializeCSV(headers, nextRequests);

    try {
      const res = await window.electronAPI.saveReqCsv(newContent);
      if (res.success) {
        setReqCsvContent(newContent);
        setRequests(nextRequests);
        addLog(`Request ${id} deleted from req.csv.`, 'success');
      } else {
        alert('Failed to save req.csv: ' + res.error);
      }
    } catch (err) {
      alert('Error deleting request: ' + err.message);
    }
  };

  const handleEditReq = (req) => {
    setEditingReqId(req.id);
    setReqForm({ ...req });
  };

  const resetReqForm = () => {
    setEditingReqId(null);
    setReqForm({
      id: '',
      busId: '',
      slaveId: '',
      startAddress: '',
      length: '',
      requestType: '',
      deviceId: ''
    });
  };

  // Compile unique lists from CSV to populate dropdown options
  const getUniqueValues = (key, dataArray) => {
    const values = dataArray.map(item => item[key]).filter(v => v !== undefined && v !== '');
    return [...new Set(values)].sort();
  };

  // Tell the device to activate the bus
  const handleActivateBus = async () => {
    const { busId, slaveId, active, ip, port, protocol } = activationConfig;
    if (!busId || !slaveId) {
      alert('Please configure Bus ID and Slave ID before activating.');
      return;
    }

    addLog(`Initiating activation sequence for Bus ID: ${busId}, Slave ID: ${slaveId}...`, 'info');

    // 1. Emit/Send Command via Serial connection (if serial terminal can receive it)
    let serialSent = false;
    try {
      if (window.electronAPI?.sendSerialData) {
        const cmdStr = `ACTIVATE_BUS:${busId},${slaveId},${active},${ip || '0.0.0.0'},${port},${protocol}`;
        const result = await window.electronAPI.sendSerialData(cmdStr);
        if (result) {
          addLog(`Serial Command transmitted: "${cmdStr}"`, 'success');
          serialSent = true;
        }
      }
    } catch (e) {
      addLog(`Serial dispatch skipped or failed: ${e.message}`, 'info');
    }

    // 2. Make an HTTP request to device IP to activate the config
    const targetIp = (!ip || ip === '0.0.0.0') ? '192.168.4.1' : ip;
    const targetUrl = `http://${targetIp}:${port || 80}/api/activate-bus`;
    addLog(`Sending network activation request to URL: ${targetUrl}`, 'info');

    try {
      if (window.electronAPI?.sendRequest) {
        const response = await window.electronAPI.sendRequest({
          url: targetUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            busId: parseInt(busId),
            slaveId: parseInt(slaveId),
            active: parseInt(active),
            ip: targetIp,
            port: parseInt(port),
            protocol: parseInt(protocol)
          })
        });

        if (response.success && response.status >= 200 && response.status < 300) {
          addLog(`Device responded successfully! HTTP Status: ${response.status}. Body: ${response.body}`, 'success');
        } else {
          addLog(`Device connection failed or returned error. HTTP Status: ${response.status || 'None'}. Error: ${response.error || 'Check local network'}`, 'error');
        }
      }
    } catch (err) {
      addLog(`Network dispatch error: ${err.message}`, 'error');
    }

    alert(`Bus activation trigger sent!\nBus ID: ${busId}\nSlave ID: ${slaveId}\nIP: ${targetIp}\nPort: ${port}\nCheck the diagnostic logs for responses.`);
  };

  // UUID Operations
  const handleAddDefaultUuid = async () => {
    let currentUuid = '';
    try {
      if (uuidData && uuidData.uuid) {
        currentUuid = uuidData.uuid;
      } else if (uuidString && uuidString.trim()) {
        const parsed = JSON.parse(uuidString);
        if (parsed && parsed.uuid) {
          currentUuid = parsed.uuid;
        }
      }
    } catch (e) { }

    // If still no UUID, generate a brand new random one
    if (!currentUuid) {
      if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        currentUuid = window.crypto.randomUUID();
      } else {
        currentUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    }

    const defaultData = {
      "vdinterval": 25,
      "table": 1,
      "parameters": [
        {
          "id": "1",
          "requestID": 1,
          "tagName": "IG-1-0----IST",
          "dataType": 0,
          "reg": 30050,
          "mf": 1.0,
          "Alarm": 1,
          "High": 0.9,
          "Low": -1,
          "add": 3,
          "vd": 5
        },
        {
          "id": "2",
          "requestID": 1,
          "tagName": "IG-1-0----FREQ",
          "dataType": 1,
          "reg": 30006,
          "mf": 0.01,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 5,
          "vd": 5
        },
        {
          "id": "3",
          "requestID": 1,
          "tagName": "IG-1-0----DCV1",
          "dataType": 0,
          "reg": 30016,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 9,
          "vd": 5
        },
        {
          "id": "4",
          "requestID": 1,
          "tagName": "IG-1-0----DCI1",
          "dataType": 1,
          "reg": 30017,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 11,
          "vd": 5
        },
        {
          "id": "5",
          "requestID": 1,
          "tagName": "IG-1-0----DCKW1",
          "dataType": 1,
          "reg": 30018,
          "mf": 0.001,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 13,
          "vd": 5
        },
        {
          "id": "6",
          "requestID": 1,
          "tagName": "IG-1-0----VN",
          "dataType": 0,
          "reg": 30004,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 15,
          "vd": 5
        },
        {
          "id": "7",
          "requestID": 1,
          "tagName": "IG-1-0----I",
          "dataType": 1,
          "reg": 30005,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          add: 17,
          "vd": 5
        },
        {
          "id": "8",
          "requestID": 1,
          "tagName": "IG-1-0----POW",
          "dataType": 1,
          "reg": 30002,
          "mf": 0.001,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 19,
          "vd": 5
        },
        {
          "id": "9",
          "requestID": 1,
          "tagName": "IG-1-0----TEMP",
          "dataType": 1,
          "reg": 30029,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 25,
          "vd": 5
        },
        {
          "id": "10",
          "requestID": 1,
          "tagName": "IG-1-0----FT1",
          "dataType": 2,
          "reg": 30035,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 27,
          "vd": 5
        },
        {
          "id": "11",
          "requestID": 1,
          "tagName": "IG-1-0----TKWH",
          "dataType": 0,
          "reg": 30031,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 33,
          "vd": 5
        },
        {
          "id": "12",
          "requestID": 1,
          "tagName": "IG-1-0----LKWH",
          "dataType": 2,
          "reg": 30033,
          "mf": 0.1,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 35,
          "vd": 5
        },
        {
          "id": "13",
          "requestID": 1,
          "tagName": "IG-1-0----FT2",
          "dataType": 2,
          "reg": 30037,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 37,
          "vd": 5
        },
        {
          "id": "14",
          "requestID": 1,
          "tagName": "IG-1-0----FT3",
          "dataType": 2,
          "reg": 30039,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 39,
          "vd": 5
        },
        {
          "id": "15",
          "requestID": 1,
          "tagName": "IG-1-0----FT4",
          "dataType": 2,
          "reg": 30041,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 41,
          "vd": 5
        },
        {
          "id": "16",
          "requestID": 1,
          "tagName": "IG-1-0----FT5",
          "dataType": 2,
          "reg": 30043,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 43,
          "vd": 5
        },
        {
          "id": "17",
          "requestID": 2,
          "tagName": "IG-1-0----INVCMD",
          "dataType": 0,
          "reg": 40001,
          "mf": 1.0,
          "Alarm": 0,
          "High": 0.0,
          "Low": 0,
          "add": 53,
          "vd": 50
        }
      ]
    };
    try {
      const res = await window.electronAPI.saveUuidJson(defaultData);
      if (res.success) {
        setUuidData(defaultData);
        setUuidString(JSON.stringify(defaultData, null, 2));
        setUuidError(null);
        addLog('Default uuid.json generated and saved successfully.', 'success');
      } else {
        alert('Failed to save default UUID: ' + res.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  const handleUploadUuidJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const res = await window.electronAPI.saveUuidJson(parsed);
        if (res.success) {
          setUuidData(parsed);
          setUuidString(JSON.stringify(parsed, null, 2));
          setUuidError(null);
          addLog(`Uploaded json file parsed and saved as uuid.json: ${file.name}`, 'success');
        } else {
          alert('Failed to save uploaded json: ' + res.error);
        }
      } catch (err) {
        setUuidError('Invalid JSON structure: ' + err.message);
        alert('Error: Loaded file contains invalid JSON text.');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveUuidText = async () => {
    try {
      const parsed = JSON.parse(uuidString);
      const res = await window.electronAPI.saveUuidJson(parsed);
      if (res.success) {
        setUuidData(parsed);
        setUuidError(null);
        alert('uuid.json saved successfully!');
        addLog('uuid.json text edits saved.', 'success');
      } else {
        setUuidError('Failed to save: ' + res.error);
      }
    } catch (err) {
      setUuidError('JSON Syntax Error: ' + err.message);
    }
  };

  const [inverterForm, setInverterForm] = useState({
    asn: "bansee",
    baudrate: 9600,
    parity: 1,
    stopBit: 1,
    databits: 8,
    reqCount_1: 2,
    slaveID_11: 1,
    busID_11: 2,
    startAddr_11: 30001,
    length_11: 50,
    funcType_11: 4,
    slaveID_12: 1,
    busID_12: 2,
    startAddr_12: 40001,
    length_12: 50,
    funcType_12: 3,
    slaveID_13: 1,
    startAddr_13: 1,
    length_13: 2,
    funcType_13: 2,
    slaveID_14: 1,
    startAddr_14: 2,
    length_14: 3,
    funcType_14: 4,
    slaveID_15: 5,
    startAddr_15: 14,
    length_15: 10,
    funcType_15: 3,
    devCount_1: 1,
    devbusId_11: "2",
    devslaveId_11: "1",
    devactive_11: "1",
    devIP_11: "0.0.0.0",
    devport_11: "502",
    devprotocol_11: "1",
    devbusId_12: "1",
    devslaveId_12: "1",
    devactive_12: "1",
    devIP_12: "10.22.145.43",
    devport_12: "502",
    devprotocol_12: "1"
  });

  const [inverterLoading, setInverterLoading] = useState(false);
  const [inverterReadUrl, setInverterReadUrl] = useState('http://192.168.4.1/api/config/inverter-communication');
  const [inverterLogs, setInverterLogs] = useState([]);

  const handleReadInverterConfig = async () => {
    setInverterLoading(true);
    const timestamp = new Date().toLocaleTimeString();
    setInverterLogs((prev) => [...prev, `[${timestamp}] ℹ️ Fetching config from ${inverterReadUrl}`]);
    try {
      if (window.electronAPI?.sendRequest) {
        const response = await window.electronAPI.sendRequest({
          url: inverterReadUrl,
          method: 'GET',
        });

        if (response.success && response.status >= 200 && response.status < 300) {
          const data = JSON.parse(response.body);
          setInverterForm(data);
          setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Read successful! ASN: ${data.asn}`]);
        } else {
          setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Failed to read config. Status: ${response.status}. Info: ${response.error || response.body}`]);
        }
      } else {
        setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Network API unavailable`]);
      }
    } catch (e) {
      setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Exception: ${e.message}`]);
    } finally {
      setInverterLoading(false);
    }
  };

  const handleWriteInverterConfig = async () => {
    setInverterLoading(true);
    const timestamp = new Date().toLocaleTimeString();
    setInverterLogs((prev) => [...prev, `[${timestamp}] ℹ️ Writing config to ${inverterReadUrl}`]);
    try {
      if (window.electronAPI?.sendRequest) {
        const response = await window.electronAPI.sendRequest({
          url: inverterReadUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(inverterForm)
        });

        if (response.success && response.status >= 200 && response.status < 300) {
          setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Write successful!`]);
        } else {
          setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Write failed. Status: ${response.status}. Info: ${response.error || response.body}`]);
        }
      } else {
        setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Network API unavailable`]);
      }
    } catch (e) {
      setInverterLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Exception: ${e.message}`]);
    } finally {
      setInverterLoading(false);
    }
  };

  const renderInverterTab = () => {
    return (
      <div className="config-layout-grid">
        <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
          {/* Card 1: Serial & Baudrate Configuration */}
          <div className="inverter-section-card animate-fadeIn">
            <div className="inverter-section-title">
              <FiSettings size={15} />
              <span>Serial Port & Communication Parameters</span>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>ASN</label>
                <input
                  type="text"
                  className="inverter-input"
                  value={inverterForm.asn}
                  onChange={(e) => setInverterForm({ ...inverterForm, asn: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Baudrate</label>
                <select
                  className="inverter-input"
                  value={inverterForm.baudrate}
                  onChange={(e) => setInverterForm({ ...inverterForm, baudrate: parseInt(e.target.value) })}
                >
                  <option value={2400}>2400 bps</option>
                  <option value={4800}>4800 bps</option>
                  <option value={9600}>9600 bps</option>
                  <option value={19200}>19200 bps</option>
                  <option value={38400}>38400 bps</option>
                  <option value={115200}>115200 bps</option>
                </select>
              </div>
              <div className="form-group">
                <label>Parity</label>
                <select
                  className="inverter-input"
                  value={inverterForm.parity}
                  onChange={(e) => setInverterForm({ ...inverterForm, parity: parseInt(e.target.value) })}
                >
                  <option value={0}>None (0)</option>
                  <option value={1}>Odd (1)</option>
                  <option value={2}>Even (2)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Stop Bits</label>
                <select
                  className="inverter-input"
                  value={inverterForm.stopBit}
                  onChange={(e) => setInverterForm({ ...inverterForm, stopBit: parseInt(e.target.value) })}
                >
                  <option value={1}>1 bit</option>
                  <option value={2}>2 bits</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Data Bits</label>
                <select
                  className="inverter-input"
                  value={inverterForm.databits}
                  onChange={(e) => setInverterForm({ ...inverterForm, databits: parseInt(e.target.value) })}
                >
                  <option value={7}>7 bits</option>
                  <option value={8}>8 bits</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Modbus Bus & Slave Mappings */}
          <div className="inverter-section-card animate-fadeIn" style={{ animationDelay: '100ms' }}>
            <div className="inverter-section-title">
              <FiSliders size={15} />
              <span>Modbus Address & Register Mapping Table</span>
            </div>

            <div className="modbus-header-row">
              <span>Mapping ID</span>
              <span>Slave ID</span>
              <span>Bus ID</span>
              <span>Start Addr</span>
              <span>Length</span>
              <span>Function Type</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[11, 12, 13, 14, 15].map((suffix) => {
                const s = suffix.toString();
                return (
                  <div key={s} className="modbus-mapping-row">
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)' }}>
                      Map #{s}
                    </span>
                    <input
                      type="number"
                      className="inverter-input"
                      placeholder="Slave ID"
                      value={inverterForm[`slaveID_${s}`] !== undefined ? inverterForm[`slaveID_${s}`] : ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`slaveID_${s}`]: parseInt(e.target.value) || 0 })}
                    />
                    <input
                      type="number"
                      className="inverter-input"
                      placeholder="Bus ID"
                      disabled={inverterForm[`busID_${s}`] === undefined}
                      value={inverterForm[`busID_${s}`] !== undefined ? inverterForm[`busID_${s}`] : ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`busID_${s}`]: parseInt(e.target.value) || 0 })}
                      style={{ opacity: inverterForm[`busID_${s}`] === undefined ? 0.3 : 1 }}
                    />
                    <input
                      type="number"
                      className="inverter-input"
                      placeholder="Start Addr"
                      value={inverterForm[`startAddr_${s}`] !== undefined ? inverterForm[`startAddr_${s}`] : ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`startAddr_${s}`]: parseInt(e.target.value) || 0 })}
                    />
                    <input
                      type="number"
                      className="inverter-input"
                      placeholder="Length"
                      value={inverterForm[`length_${s}`] !== undefined ? inverterForm[`length_${s}`] : ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`length_${s}`]: parseInt(e.target.value) || 0 })}
                    />
                    <select
                      className="inverter-input"
                      value={inverterForm[`funcType_${s}`] !== undefined ? inverterForm[`funcType_${s}`] : 3}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`funcType_${s}`]: parseInt(e.target.value) || 3 })}
                    >
                      <option value={1}>Coils (1)</option>
                      <option value={2}>Discrete (2)</option>
                      <option value={3}>Holding (3)</option>
                      <option value={4}>Input (4)</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Connected Modbus Gateways / Active Devices */}
          <div className="inverter-section-card animate-fadeIn" style={{ animationDelay: '200ms' }}>
            <div className="inverter-section-title">
              <FiActivity size={15} />
              <span>Active Gateways / Connected Modbus Devices</span>
            </div>

            <div className="device-header-row">
              <span>Device ID</span>
              <span>Bus ID</span>
              <span>Slave ID</span>
              <span>Device IP</span>
              <span>Port</span>
              <span>Status</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[11, 12].map((suffix) => {
                const s = suffix.toString();
                const isActive = inverterForm[`devactive_${s}`] === '1';
                return (
                  <div key={s} className="device-config-row" style={{
                    borderColor: isActive ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)',
                    background: isActive ? 'rgba(16, 185, 129, 0.01)' : 'rgba(15, 23, 42, 0.3)'
                  }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-light)' }}>
                      Dev #{s}
                    </span>
                    <input
                      type="text"
                      className="inverter-input"
                      placeholder="Bus ID"
                      value={inverterForm[`devbusId_${s}`] || ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`devbusId_${s}`]: e.target.value })}
                    />
                    <input
                      type="text"
                      className="inverter-input"
                      placeholder="Slave ID"
                      value={inverterForm[`devslaveId_${s}`] || ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`devslaveId_${s}`]: e.target.value })}
                    />
                    <input
                      type="text"
                      className="inverter-input"
                      placeholder="Device IP"
                      value={inverterForm[`devIP_${s}`] || ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`devIP_${s}`]: e.target.value })}
                    />
                    <input
                      type="text"
                      className="inverter-input"
                      placeholder="Port"
                      value={inverterForm[`devport_${s}`] || ''}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`devport_${s}`]: e.target.value })}
                    />
                    <select
                      className="inverter-input"
                      value={inverterForm[`devactive_${s}`] || '0'}
                      onChange={(e) => setInverterForm({ ...inverterForm, [`devactive_${s}`]: e.target.value })}
                      style={{
                        color: isActive ? 'var(--success)' : 'var(--text-muted)',
                        fontWeight: '600'
                      }}
                    >
                      <option value="0">Inactive</option>
                      <option value="1">Active</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Endpoint Configuration & Console Sync Logs */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>Inverter Device Synchronization</h3>
            <p className="activation-description">Sync configurations to the device using a Fiddler proxy / inverter REST endpoint.</p>
          </div>

          <div className="config-form-card" style={{ gap: '10px' }}>
            <div className="form-group">
              <label>API Endpoint Destination URL</label>
              <input
                type="text"
                className="inverter-input"
                value={inverterReadUrl}
                onChange={(e) => setInverterReadUrl(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleReadInverterConfig}
                disabled={inverterLoading}
                style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}
              >
                {inverterLoading ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiUpload style={{ transform: 'rotate(180deg)' }} />
                )}
                {inverterLoading ? 'Reading...' : 'Load Config'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleWriteInverterConfig}
                disabled={inverterLoading}
                style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}
              >
                {inverterLoading ? (
                  <FiRefreshCw className="animate-spin" />
                ) : (
                  <FiSave />
                )}
                {inverterLoading ? 'Saving...' : 'Sync Config'}
              </button>
            </div>
          </div>

          {/* Sync Terminal Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              <FiTerminal size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Sync Diagnostics Logs
            </span>
            <div className="inverter-logs-terminal">
              {inverterLogs.length === 0 ? (
                <div className="inverter-log-line info">Console idle... Ready to synchronize config values.</div>
              ) : (
                inverterLogs.map((log, idx) => {
                  let logClass = 'info';
                  if (log.includes('✅') || log.includes('success')) logClass = 'success';
                  if (log.includes('❌') || log.includes('fail') || log.includes('Exception')) logClass = 'error';

                  return (
                    <div key={idx} className={`inverter-log-line ${logClass}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bus-config-page page-transition">
      <div className="bus-config-header">
        <div>
          <h2>Bus Configuration</h2>
          <p>Read templates, manage CSV files, load device identities, and activate connected system buses.</p>
        </div>
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'dev' ? 'active' : ''}`}
            onClick={() => setActiveTab('dev')}
          >
            <FiCpu size={14} /> dev.csv (Devices)
          </button>
          <button
            className={`tab-btn ${activeTab === 'req' ? 'active' : ''}`}
            onClick={() => setActiveTab('req')}
          >
            <FiDatabase size={14} /> req.csv (Requests)
          </button>
          <button
            className={`tab-btn ${activeTab === 'uuid' ? 'active' : ''}`}
            onClick={() => setActiveTab('uuid')}
          >
            <FiFileText size={14} /> uuid.json (Identity)
          </button>
          <button
            className={`tab-btn ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
          >
            <FiRefreshCw size={14} /> File Sync (HTTP)
          </button>
          <button
            className={`tab-btn ${activeTab === 'inverter' ? 'active' : ''}`}
            onClick={() => setActiveTab('inverter')}
          >
            <FiSettings size={14} /> Inverter Config
          </button>
        </div>
      </div>

      <div className="bus-config-content">
        {/* DEV.CSV Tab View */}
        {activeTab === 'dev' && (
          <div className="config-layout-grid">
            <div className="glass-panel">
              <div className="panel-header-row">
                <h3>Connected Devices</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{devices.length} Devices configured</span>
              </div>

              <div className="table-viewport">
                <table className="config-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Bus ID</th>
                      <th>Slave ID</th>
                      <th>Active</th>
                      <th>IP Address</th>
                      <th>Port</th>
                      <th>Protocol</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((dev) => (
                      <tr key={dev.id} style={{ cursor: 'pointer' }} onClick={() => {
                        // Clicking a row loads it into the activation selector form
                        setActivationConfig({
                          busId: dev.busId,
                          slaveId: dev.slaveId,
                          active: dev.active,
                          ip: dev.ip,
                          port: dev.port,
                          protocol: dev.protocol
                        });
                        addLog(`Loaded device ID ${dev.id} config into Bus Activation selectors.`, 'info');
                      }}>
                        <td>{dev.id}</td>
                        <td><strong>{dev.busId}</strong></td>
                        <td>{dev.slaveId}</td>
                        <td>
                          <span className={`status-badge ${dev.active === '1' ? 'active' : 'inactive'}`}>
                            {dev.active === '1' ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td><code>{dev.ip}</code></td>
                        <td>{dev.port}</td>
                        <td>Modbus {dev.protocol === '1' ? 'TCP' : 'RTU'}</td>
                        <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                          <button className="btn-icon edit" onClick={() => handleEditDev(dev)} title="Edit Row">
                            <FiSettings size={14} />
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeleteDev(dev.id)} title="Delete Row">
                            <FiTrash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {devices.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No devices found in dev.csv. Use the form below to create one!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add/Edit Dev Form */}
              <form onSubmit={handleSaveDev} className="config-form-card" style={{ marginTop: '24px' }}>
                <h4 className="form-title">{editingDevId ? `Modify Device ID ${editingDevId}` : 'Add Device Entry'}</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 3"
                      value={devForm.id}
                      onChange={(e) => setDevForm({ ...devForm, id: e.target.value })}
                      disabled={editingDevId !== null}
                    />
                  </div>
                  <div className="form-group">
                    <label>Bus ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={devForm.busId}
                      onChange={(e) => setDevForm({ ...devForm, busId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Slave ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={devForm.slaveId}
                      onChange={(e) => setDevForm({ ...devForm, slaveId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Active</label>
                    <select
                      value={devForm.active}
                      onChange={(e) => setDevForm({ ...devForm, active: e.target.value })}
                    >
                      <option value="1">Active (1)</option>
                      <option value="0">Disabled (0)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>IP Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.0.100"
                      value={devForm.ip}
                      onChange={(e) => setDevForm({ ...devForm, ip: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Port</label>
                    <input
                      type="text"
                      placeholder="e.g. 502"
                      value={devForm.port}
                      onChange={(e) => setDevForm({ ...devForm, port: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Protocol</label>
                    <select
                      value={devForm.protocol}
                      onChange={(e) => setDevForm({ ...devForm, protocol: e.target.value })}
                    >
                      <option value="1">Modbus TCP (1)</option>
                      <option value="2">Modbus RTU (2)</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  {editingDevId !== null && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={resetDevForm}>
                      Cancel
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FiPlus /> {editingDevId ? 'Apply Changes' : 'Add to List'}
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Bus Activation controls */}
            <div className="glass-panel activation-card">
              <h3><FiPlay /> Activate Bus</h3>
              <p className="activation-description">
                Instruct the diagnostic monitor unit to connect, initialize and stream Modbus data based on selected properties.
              </p>

              <div className="activation-actions-container">
                <div className="form-group">
                  <label>Bus ID</label>
                  <select
                    value={activationConfig.busId}
                    onChange={(e) => setActivationConfig({ ...activationConfig, busId: e.target.value })}
                  >
                    <option value="">Select Bus ID</option>
                    {getUniqueValues('busId', devices).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Slave ID</label>
                  <select
                    value={activationConfig.slaveId}
                    onChange={(e) => setActivationConfig({ ...activationConfig, slaveId: e.target.value })}
                  >
                    <option value="">Select Slave ID</option>
                    {getUniqueValues('slaveId', devices).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Active</label>
                  <select
                    value={activationConfig.active}
                    onChange={(e) => setActivationConfig({ ...activationConfig, active: e.target.value })}
                  >
                    <option value="1">1 (Enabled)</option>
                    <option value="0">0 (Disabled)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>IP Address</label>
                  <select
                    value={activationConfig.ip}
                    onChange={(e) => setActivationConfig({ ...activationConfig, ip: e.target.value })}
                  >
                    <option value="">Select IP</option>
                    {getUniqueValues('ip', devices).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Port</label>
                  <select
                    value={activationConfig.port}
                    onChange={(e) => setActivationConfig({ ...activationConfig, port: e.target.value })}
                  >
                    <option value="">Select Port</option>
                    {getUniqueValues('port', devices).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Protocol</label>
                  <select
                    value={activationConfig.protocol}
                    onChange={(e) => setActivationConfig({ ...activationConfig, protocol: e.target.value })}
                  >
                    <option value="1">1 (Modbus TCP)</option>
                    <option value="2">2 (Modbus RTU)</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="activate-btn"
                  onClick={handleActivateBus}
                  disabled={!activationConfig.busId || !activationConfig.slaveId}
                >
                  <FiPlay size={14} /> Send Activation Code
                </button>

                <h4 className="activation-log-title">Activation Logs</h4>
                <div className="activation-log-terminal">
                  {activationLogs.map((log, idx) => <div key={idx}>{log}</div>)}
                  {activationLogs.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No operations logged yet. Click Send above to activate.</span>}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REQ.CSV Tab View */}
        {activeTab === 'req' && (
          <div className="glass-panel">
            <div className="panel-header-row">
              <h3>Request Address Map (req.csv)</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{requests.length} Requests mapped</span>
            </div>

            <div className="table-viewport">
              <table className="config-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Bus ID</th>
                    <th>Slave ID</th>
                    <th>Start Address</th>
                    <th>Length</th>
                    <th>Request Type</th>
                    <th>Device ID</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td>{req.id}</td>
                      <td><strong>{req.busId}</strong></td>
                      <td>{req.slaveId}</td>
                      <td><code>{req.startAddress}</code></td>
                      <td>{req.length}</td>
                      <td>Type {req.requestType}</td>
                      <td>Device {req.deviceId}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-icon edit" onClick={() => handleEditReq(req)} title="Edit Row">
                          <FiSettings size={14} />
                        </button>
                        <button className="btn-icon delete" onClick={() => handleDeleteReq(req.id)} title="Delete Row">
                          <FiTrash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No request maps loaded. Add a map below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Request Entry Form - populated with Option Dropdowns for all fields */}
            <form onSubmit={handleSaveReq} className="config-form-card" style={{ marginTop: '24px' }}>
              <h4 className="form-title">{editingReqId ? `Modify Request ID ${editingReqId}` : 'Add Request Map'}</h4>

              <div className="form-grid">
                {/* ID dropdown option */}
                <div className="form-group">
                  <label>ID</label>
                  {editingReqId ? (
                    <input type="text" value={reqForm.id} disabled />
                  ) : (
                    <select
                      value={reqForm.id}
                      onChange={(e) => setReqForm({ ...reqForm, id: e.target.value })}
                    >
                      <option value="">Choose or write...</option>
                      {/* Compile list of default sequential IDs */}
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                      {getUniqueValues('id', requests).map(v => (
                        <option key={`ex-${v}`} value={v}>{v} (Existing)</option>
                      ))}
                    </select>
                  )}
                  {!editingReqId && (
                    <input
                      type="text"
                      placeholder="Or enter custom ID"
                      value={reqForm.id}
                      onChange={(e) => setReqForm({ ...reqForm, id: e.target.value })}
                      style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                    />
                  )}
                </div>

                {/* Bus ID dropdown option */}
                <div className="form-group">
                  <label>Bus ID</label>
                  <select
                    value={reqForm.busId}
                    onChange={(e) => setReqForm({ ...reqForm, busId: e.target.value })}
                  >
                    <option value="">Select Bus ID</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    {getUniqueValues('busId', requests).map(v => (
                      <option key={`bus-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Bus ID"
                    value={reqForm.busId}
                    onChange={(e) => setReqForm({ ...reqForm, busId: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>

                {/* Slave ID dropdown option */}
                <div className="form-group">
                  <label>Slave ID</label>
                  <select
                    value={reqForm.slaveId}
                    onChange={(e) => setReqForm({ ...reqForm, slaveId: e.target.value })}
                  >
                    <option value="">Select Slave ID</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    {getUniqueValues('slaveId', requests).map(v => (
                      <option key={`slave-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Slave ID"
                    value={reqForm.slaveId}
                    onChange={(e) => setReqForm({ ...reqForm, slaveId: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>

                {/* Start Address dropdown option */}
                <div className="form-group">
                  <label>Start Address</label>
                  <select
                    value={reqForm.startAddress}
                    onChange={(e) => setReqForm({ ...reqForm, startAddress: e.target.value })}
                  >
                    <option value="">Select Address</option>
                    <option value="1">1</option>
                    <option value="120">120</option>
                    <option value="121">121</option>
                    {getUniqueValues('startAddress', requests).map(v => (
                      <option key={`addr-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Address"
                    value={reqForm.startAddress}
                    onChange={(e) => setReqForm({ ...reqForm, startAddress: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>

                {/* Length dropdown option */}
                <div className="form-group">
                  <label>Length</label>
                  <select
                    value={reqForm.length}
                    onChange={(e) => setReqForm({ ...reqForm, length: e.target.value })}
                  >
                    <option value="">Select Length</option>
                    <option value="1">1</option>
                    <option value="120">120</option>
                    {getUniqueValues('length', requests).map(v => (
                      <option key={`len-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Length"
                    value={reqForm.length}
                    onChange={(e) => setReqForm({ ...reqForm, length: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>

                {/* Request Type dropdown option */}
                <div className="form-group">
                  <label>Request Type</label>
                  <select
                    value={reqForm.requestType}
                    onChange={(e) => setReqForm({ ...reqForm, requestType: e.target.value })}
                  >
                    <option value="">Select Type</option>
                    <option value="3">3 (Read Holding Registers)</option>
                    <option value="4">4 (Read Input Registers)</option>
                    {getUniqueValues('requestType', requests).map(v => (
                      <option key={`type-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Type"
                    value={reqForm.requestType}
                    onChange={(e) => setReqForm({ ...reqForm, requestType: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>

                {/* Device ID dropdown option */}
                <div className="form-group">
                  <label>Device ID</label>
                  <select
                    value={reqForm.deviceId}
                    onChange={(e) => setReqForm({ ...reqForm, deviceId: e.target.value })}
                  >
                    <option value="">Select Device ID</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    {getUniqueValues('deviceId', requests).map(v => (
                      <option key={`devid-${v}`} value={v}>{v}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or custom Device ID"
                    value={reqForm.deviceId}
                    onChange={(e) => setReqForm({ ...reqForm, deviceId: e.target.value })}
                    style={{ marginTop: '4px', fontSize: '11px', padding: '4px 8px' }}
                  />
                </div>
              </div>

              <div className="form-actions">
                {editingReqId !== null && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={resetReqForm}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FiPlus /> {editingReqId ? 'Apply Changes' : 'Save Request Map'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* UUID.JSON Tab View */}
        {activeTab === 'uuid' && (
          <div className="glass-panel uuid-layout">
            <div className="panel-header-row">
              <h3>Device Metadata & Identity Configuration (uuid.json)</h3>
              {uuidData ? (
                <span className="status-badge active" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiCheck /> Configured
                </span>
              ) : (
                <span className="status-badge inactive" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FiAlertCircle /> Missing
                </span>
              )}
            </div>

            <p className="activation-description">
              The <code>uuid.json</code> file registers this application instance or monitoring client and maps parameters back to servers.
            </p>

            <div className="uuid-options-row">
              {/* Option 1: Add Default */}
              <button className="btn btn-secondary" onClick={handleAddDefaultUuid}>
                <FiPlus style={{ marginRight: '6px' }} /> Add Default Identity
              </button>

              {/* Option 2: Upload custom json */}
              <div className="uuid-file-input-wrapper">
                <button className="btn btn-secondary">
                  <FiUpload style={{ marginRight: '6px' }} /> Upload custom .json
                </button>
                <input
                  type="file"
                  accept=".json"
                  className="uuid-file-input"
                  onChange={handleUploadUuidJson}
                  ref={fileInputRef}
                />
              </div>
            </div>

            {/* Custom Interactive JSON Editor */}
            <div className="json-editor-card" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>File Contents Editor</span>
                {uuidError && <span className="json-status invalid">{uuidError}</span>}
              </div>
              <textarea
                className="json-textarea"
                value={uuidString}
                onChange={(e) => {
                  setUuidString(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setUuidError(null);
                  } catch (err) {
                    setUuidError('Syntax Error: ' + err.message);
                  }
                }}
                placeholder={`{
  "uuid": "Your device UUID",
  "name": "Custom device descriptor",
  ...
}`}
              />
              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleSaveUuidText}
                  disabled={uuidError !== null || !uuidString.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiSave /> Save Editor Content
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="config-layout-grid">
            {/* Sync Configuration parameters */}
            <div className="glass-panel">
              <div className="panel-header-row">
                <h3>Device File Sync (HTTP Actions)</h3>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HTTP Client Interface</span>
              </div>

              <div className="config-form-card">
                <div className="form-grid">
                  <div className="form-group">
                    <label>File Target</label>
                    <select
                      value={syncFileType}
                      onChange={(e) => setSyncFileType(e.target.value)}
                    >
                      <option value="dev">dev.csv (Devices)</option>
                      <option value="req">req.csv (Requests)</option>
                      <option value="uuid">uuid.json (Identity)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Action Target</label>
                    <select
                      value={syncActionType}
                      onChange={(e) => setSyncActionType(e.target.value)}
                      disabled={syncFileType === 'uuid'}
                    >
                      <option value="write">Write File (Upload / Insert)</option>
                      <option value="delete">Delete Specific Entry (Remove ID)</option>
                      <option value="delete_file">Delete Entire CSV File from Device</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Sync Endpoint URL</label>
                  <input
                    type="text"
                    value={syncUrlVal}
                    onChange={(e) => setSyncUrlVal(e.target.value)}
                    placeholder="Enter custom synchronization endpoint..."
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Authorization Token (Optional)</label>
                  <input
                    type="password"
                    value={syncToken}
                    onChange={(e) => setSyncToken(e.target.value)}
                    placeholder="Enter Bearer/Authorization token for device..."
                    style={{ fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-grid" style={{ marginTop: '12px' }}>
                  {syncActionType === 'write' && syncFileType !== 'uuid' && (
                    <div className="form-group">
                      <label>Data Scope</label>
                      <select
                        value={syncScope}
                        onChange={(e) => setSyncScope(e.target.value)}
                      >
                        <option value="all">Full CSV Content (All Rows)</option>
                        <option value="single">Single Row (Select ID)</option>
                      </select>
                    </div>
                  )}

                  {syncFileType !== 'uuid' && (syncActionType === 'delete' || (syncActionType === 'write' && syncScope === 'single')) && (
                    <div className="form-group">
                      <label>Target Data ID</label>
                      <select
                        value={syncTargetId}
                        onChange={(e) => setSyncTargetId(e.target.value)}
                      >
                        <option value="">Select ID...</option>
                        {(syncFileType === 'dev' ? devices : requests).map(item => (
                          <option key={item.id} value={item.id}>
                            ID: {item.id} {item.busId ? `(Bus ${item.busId})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Show Preview of data to write if Single Row */}
                {syncActionType === 'write' && syncScope === 'single' && syncTargetId && (
                  <div className="active-preset-box" style={{ marginTop: '12px' }}>
                    <div className="active-preset-title">Row Data Preview</div>
                    <pre className="active-preset-value">
                      {JSON.stringify(
                        (syncFileType === 'dev' ? devices : requests).find(item => item.id === syncTargetId),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                <button
                  type="button"
                  className="activate-btn"
                  onClick={handleExecuteSync}
                  style={{ marginTop: '20px' }}
                >
                  <FiRefreshCw size={14} /> Execute Sync Request
                </button>
              </div>
            </div>

            {/* Sync diagnostics terminal */}
            <div className="glass-panel">
              <h3>Sync Log & Diagnostic Console</h3>
              <p className="activation-description">
                Monitor HTTP requests, transfer speed latency, responses, and connection exceptions.
              </p>

              <div className="activation-log-terminal" style={{ height: '360px', color: '#6ee7b7' }}>
                {syncLogs.map((log, idx) => <div key={idx} style={{ marginBottom: '4px' }}>{log}</div>)}
                {syncLogs.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Console ready. Select a file/action and click Execute to view connection diagnostics.</div>}
                <div ref={syncLogsEndRef} />
              </div>

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSyncLogs([])}
                  disabled={syncLogs.length === 0}
                >
                  Clear Console Logs
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'inverter' && renderInverterTab()}
      </div>
    </div>
  );
}

export default BusConfig;
