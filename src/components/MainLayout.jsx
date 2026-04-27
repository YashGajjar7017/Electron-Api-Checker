import React from 'react';
import useStore from '../store';
import Sidebar from './Sidebar';
import RequestBuilder from './RequestBuilder';
import ResponseViewer from './ResponseViewer';
import Header from './Header';
import '../styles/MainLayout.css';

function MainLayout({ onThemeChange, currentTheme }) {
  return (
    <div className="main-layout">
      <Header onThemeChange={onThemeChange} currentTheme={currentTheme} />
      <div className="layout-container">
        <div className="sidebar-panel">
          <Sidebar />
        </div>
        <div className="workspace-panel">
          <RequestBuilder />
        </div>
        <div className="response-panel">
          <ResponseViewer />
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
