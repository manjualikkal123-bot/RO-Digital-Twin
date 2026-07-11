import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Droplet } from 'lucide-react';

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
      }, 1800); // Wait 1800ms to show the cool water animation
      
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
              PERMASENSE
            </div>
            
            {/* Foreground filling text */}
            <div 
              className="absolute inset-0 text-5xl md:text-7xl font-black tracking-widest uppercase select-none water-wave-bg"
            >
              PERMASENSE
            </div>
          </div>
          
          <div className="mt-12 flex items-center gap-4 text-cyan-400 font-mono text-sm font-bold tracking-widest">
            <div className="flex items-end gap-1 h-6">
              <Droplet size={18} className="fill-cyan-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
              <Droplet size={18} className="fill-cyan-400 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
              <Droplet size={18} className="fill-cyan-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
            </div>
            <span className="animate-pulse">INITIALIZING SCADA SYSTEMS...</span>
          </div>
        </div>
      )}
      
      <div className={isTransitioning ? "pointer-events-none opacity-50 blur-sm transition-all duration-300" : "contents"}>
        {React.cloneElement(children, { location: displayLocation })}
      </div>
    </>
  );
}
