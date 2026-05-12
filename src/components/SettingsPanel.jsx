import React, { useEffect, useState } from 'react';
import useStore from '../store';
import { FiX, FiCheck, FiRefreshCw } from 'react-icons/fi';
import '../styles/SettingsPanel.css';

const DEFAULT_SETTINGS = {
  fontSize: 'medium',
  uiScale: 1,
  fontFamily: 'system',
  theme: 'dark',
  compactMode: false,
  cardRadius: 'medium',
  animationSpeed: 'normal',
  transparency: 0.95,
  accentColor: '#7c3aed',
  backgroundColor: '#0f172a',
  showNotifications: true,
  autoUpdate: true,
  gpuAcceleration: true,
  hardwareRendering: true,
  memoryOptimization: false,
};

function SettingsPanel({ isOpen, onClose }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState('appearance');

  const { user } = useStore((state) => ({
    user: state.user,
  }));

  useEffect(() => {
    if (isOpen && window.electronAPI?.loadSettings) {
      window.electronAPI.loadSettings().then((saved) => {
        if (saved) setSettings({ ...DEFAULT_SETTINGS, ...saved });
      });
    }
  }, [isOpen]);

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (window.electronAPI?.saveSettings) {
      await window.electronAPI.saveSettings(settings);
      applySettings();
      setIsDirty(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setIsDirty(true);
  };

  const applySettings = () => {
    const root = document.documentElement;
    root.style.setProperty('--font-size-scale', settings.fontSize === 'small' ? '0.9' : settings.fontSize === 'large' ? '1.1' : '1');
    root.style.setProperty('--ui-scale', settings.uiScale);
    root.style.setProperty('--card-radius', settings.cardRadius === 'small' ? '8px' : settings.cardRadius === 'large' ? '20px' : '14px');
    root.style.setProperty('--accent-color', settings.accentColor);
    root.style.setProperty('--bg-color', settings.backgroundColor);
    root.style.setProperty('--transparency', settings.transparency);
    
    if (settings.compactMode) {
      document.documentElement.classList.add('compact-mode');
    } else {
      document.documentElement.classList.remove('compact-mode');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay">
      <div className="settings-panel glass-lg">
        <div className="settings-header">
          <h2>Settings</h2>
          <button onClick={onClose} className="close-btn">
            <FiX />
          </button>
        </div>

        <div className="settings-container">
          <div className="settings-sidebar">
            {['appearance', 'theme', 'performance', 'behavior'].map((tab) => (
              <button
                key={tab}
                className={`settings-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeTab === 'appearance' && (
              <>
                <h3>Appearance</h3>

                <div className="setting-group">
                  <label>Text Size</label>
                  <div className="option-group">
                    {['small', 'medium', 'large'].map((size) => (
                      <label key={size} className="radio-label">
                        <input
                          type="radio"
                          name="fontSize"
                          checked={settings.fontSize === size}
                          onChange={() => handleSettingChange('fontSize', size)}
                        />
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="setting-group">
                  <label>Font Family</label>
                  <select
                    value={settings.fontFamily}
                    onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
                  >
                    <option value="system">System Default</option>
                    <option value="inter">Inter</option>
                    <option value="jetbrains">JetBrains Mono</option>
                    <option value="fira">Fira Code</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>UI Scale</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0.8"
                      max="1.3"
                      step="0.1"
                      value={settings.uiScale}
                      onChange={(e) => handleSettingChange('uiScale', parseFloat(e.target.value))}
                    />
                    <span className="slider-value">{(settings.uiScale * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="setting-group">
                  <label>Card Border Radius</label>
                  <div className="option-group">
                    {['small', 'medium', 'large'].map((radius) => (
                      <label key={radius} className="radio-label">
                        <input
                          type="radio"
                          name="cardRadius"
                          checked={settings.cardRadius === radius}
                          onChange={() => handleSettingChange('cardRadius', radius)}
                        />
                        {radius.charAt(0).toUpperCase() + radius.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="setting-group">
                  <label>Compact Mode</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.compactMode}
                      onChange={(e) => handleSettingChange('compactMode', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Reduce spacing and padding
                  </label>
                </div>

                <div className="setting-group">
                  <label>Animation Speed</label>
                  <div className="option-group">
                    {['slow', 'normal', 'fast'].map((speed) => (
                      <label key={speed} className="radio-label">
                        <input
                          type="radio"
                          name="animationSpeed"
                          checked={settings.animationSpeed === speed}
                          onChange={() => handleSettingChange('animationSpeed', speed)}
                        />
                        {speed.charAt(0).toUpperCase() + speed.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="setting-group">
                  <label>Transparency</label>
                  <div className="slider-container">
                    <input
                      type="range"
                      min="0.8"
                      max="1"
                      step="0.05"
                      value={settings.transparency}
                      onChange={(e) => handleSettingChange('transparency', parseFloat(e.target.value))}
                    />
                    <span className="slider-value">{(settings.transparency * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'theme' && (
              <>
                <h3>Theme & Colors</h3>

                <div className="setting-group">
                  <label>Theme</label>
                  <div className="option-group">
                    {['light', 'dark', 'amoled'].map((themeOption) => (
                      <label key={themeOption} className="radio-label">
                        <input
                          type="radio"
                          name="theme"
                          checked={settings.theme === themeOption}
                          onChange={() => handleSettingChange('theme', themeOption)}
                        />
                        {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="setting-group">
                  <label>Accent Color</label>
                  <div className="color-picker-group">
                    {['#7c3aed', '#3b82f6', '#f59e0b', '#ec4899', '#22c55e'].map((color) => (
                      <button
                        key={color}
                        className={`color-option ${settings.accentColor === color ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleSettingChange('accentColor', color)}
                        title={color}
                      >
                        {settings.accentColor === color && <FiCheck size={16} />}
                      </button>
                    ))}
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(e) => handleSettingChange('accentColor', e.target.value)}
                      className="color-input"
                    />
                  </div>
                </div>

                <div className="setting-group">
                  <label>Background Color</label>
                  <input
                    type="color"
                    value={settings.backgroundColor}
                    onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
                    className="color-input-full"
                  />
                </div>
              </>
            )}

            {activeTab === 'performance' && (
              <>
                <h3>Performance</h3>

                <div className="setting-group">
                  <label>GPU Acceleration</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.gpuAcceleration}
                      onChange={(e) => handleSettingChange('gpuAcceleration', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Enable hardware acceleration
                  </label>
                </div>

                <div className="setting-group">
                  <label>Hardware Rendering</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.hardwareRendering}
                      onChange={(e) => handleSettingChange('hardwareRendering', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Use GPU for rendering
                  </label>
                </div>

                <div className="setting-group">
                  <label>Memory Optimization</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.memoryOptimization}
                      onChange={(e) => handleSettingChange('memoryOptimization', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Aggressive memory cleanup
                  </label>
                </div>

                <div className="info-box">
                  <p>Enable these options to improve performance on lower-end systems. Disable for better graphics quality.</p>
                </div>
              </>
            )}

            {activeTab === 'behavior' && (
              <>
                <h3>Behavior</h3>

                <div className="setting-group">
                  <label>Notifications</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.showNotifications}
                      onChange={(e) => handleSettingChange('showNotifications', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Show desktop notifications
                  </label>
                </div>

                <div className="setting-group">
                  <label>Auto Update</label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={settings.autoUpdate}
                      onChange={(e) => handleSettingChange('autoUpdate', e.target.checked)}
                    />
                    <span className="toggle-switch" />
                    Check for updates automatically
                  </label>
                </div>

                {user && (
                  <div className="user-info-box">
                    <h4>Logged in as</h4>
                    <p>{user.email}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button onClick={handleReset} className="btn btn-secondary">
            <FiRefreshCw /> Reset to Defaults
          </button>
          <div className="footer-actions">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={handleSave} className={`btn btn-primary ${!isDirty ? 'disabled' : ''}`} disabled={!isDirty}>
              <FiCheck /> Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
