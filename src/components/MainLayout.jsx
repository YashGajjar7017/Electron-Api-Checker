import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import RequestBuilder from './RequestBuilder';
import ResponseViewer from './ResponseViewer';
import Header from './Header';
import '../styles/MainLayout.css';

function MainLayout({ onThemeChange, currentTheme }) {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [responseWidth, setResponseWidth] = useState(400);
  const containerRef = useRef(null);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingResponse, setIsResizingResponse] = useState(false);

  const handleMouseDown = (side) => {
    if (side === 'sidebar') {
      setIsResizingSidebar(true);
    } else if (side === 'response') {
      setIsResizingResponse(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;

      if (isResizingSidebar) {
        const newWidth = e.clientX - containerRef.current.getBoundingClientRect().left;
        if (newWidth > 200 && newWidth < 500) {
          setSidebarWidth(newWidth);
        }
      } else if (isResizingResponse) {
        const containerRight = containerRef.current.getBoundingClientRect().right;
        const newWidth = containerRight - e.clientX;
        if (newWidth > 250 && newWidth < 600) {
          setResponseWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingResponse(false);
    };

    if (isResizingSidebar || isResizingResponse) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingSidebar, isResizingResponse]);

  return (
    <div className="main-layout">
      <Header onThemeChange={onThemeChange} currentTheme={currentTheme} />
      <div className="layout-container" ref={containerRef}>
        <div className="sidebar-panel" style={{ width: `${sidebarWidth}px` }}>
          <Sidebar />
          <div
            className="resize-handle resize-handle-right"
            onMouseDown={() => handleMouseDown('sidebar')}
          />
        </div>
        <div
          className="workspace-panel"
          style={{ flex: 1 }}
        >
          <RequestBuilder />
        </div>
        <div className="response-panel" style={{ width: `${responseWidth}px` }}>
          <ResponseViewer />
          <div
            className="resize-handle resize-handle-left"
            onMouseDown={() => handleMouseDown('response')}
          />
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
