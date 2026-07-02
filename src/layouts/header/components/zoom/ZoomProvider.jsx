"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const ZoomContext = createContext(null);

export const ZoomProvider = ({ children }) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("app-zoom");
    if (saved) setZoom(Number(saved));
  }, []);

  useEffect(() => {
    document.documentElement.style.zoom = zoom;
    localStorage.setItem("app-zoom", zoom);
  }, [zoom]);

  return (
    <ZoomContext.Provider value={{ zoom, setZoom }}>
      {children}
    </ZoomContext.Provider>
  );
};

export const useZoom = () => useContext(ZoomContext);



