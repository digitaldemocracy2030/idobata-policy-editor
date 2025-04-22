import React, { useEffect, useState } from 'react';

function Notification({ message, onClose, duration = 5000 }) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // Set timer to start fade out
    const timer = setTimeout(() => {
      // Start fade out
      setIsVisible(false);
      
      // Remove notification after animation completes
      const fadeTimer = setTimeout(() => {
        onClose();
      }, 500); // Match this with the CSS transition duration
      
      return () => clearTimeout(fadeTimer);
    }, duration);
    
    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, [duration, onClose]);
  
  return (
    <div
      className={`absolute top-0 left-0 right-0 z-30 transition-all duration-500 ease-in-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-full'
      }`}
    >
      <div className="bg-white text-primary-dark py-2 px-3 shadow-md rounded-lg border border-primary-light/30 mt-2 mb-2 mx-2">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p className="text-xs">{message}</p>
        </div>
      </div>
    </div>
  );
}

export default Notification;