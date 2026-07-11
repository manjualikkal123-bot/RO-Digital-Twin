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
          
          <div className="mt-12 text-cyan-400/80 font-mono text-sm font-medium tracking-[0.2em] uppercase">
            <span className="animate-pulse">See Today. Predict Tomorrow. Analyze Always.</span>
          </div>
        </div>
      )}
      
      <div className={isTransitioning ? "pointer-events-none opacity-50 blur-sm transition-all duration-300" : "contents"}>
        {React.cloneElement(children, { location: displayLocation })}
      </div>
    </>
  );
}
