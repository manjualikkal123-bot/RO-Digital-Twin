import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Droplets } from 'lucide-react';

export default function PageTransitionWrapper({ children }) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setIsTransitioning(false);
      }, 900); // Wait 900ms to show the cool water animation
      
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  return (
    <>
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
          
          <div className="relative">
            {/* Background text outline */}
            <div 
              className="text-5xl md:text-7xl font-black tracking-widest text-transparent uppercase select-none opacity-20"
              style={{ WebkitTextStroke: '2px #38bdf8' }}
            >
              PERMIONICS
            </div>
            
            {/* Foreground filling text */}
            <div 
              className="absolute inset-0 text-5xl md:text-7xl font-black tracking-widest uppercase select-none overflow-hidden water-fill-animation"
            >
              <div className="water-wave-bg text-transparent bg-clip-text">
                PERMIONICS
              </div>
            </div>
          </div>
          
          <div className="mt-12 flex items-center gap-3 text-cyan-400 font-mono text-sm font-bold tracking-widest animate-pulse">
            <Droplets size={16} /> INITIALIZING SCADA SYSTEMS...
          </div>
        </div>
      )}
      
      <div className={isTransitioning ? "pointer-events-none opacity-50 blur-sm transition-all duration-300" : "contents"}>
        {React.cloneElement(children, { location: displayLocation })}
      </div>
    </>
  );
}
