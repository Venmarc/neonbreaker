import { useState, useEffect } from 'react';

export const useGameScale = (baseWidth: number, baseHeight: number) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      // Calculate available space (subtracting small margin for safety)
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      const scaleX = windowWidth / baseWidth;
      const scaleY = windowHeight / baseHeight;

      // Fit within the viewport while maintaining aspect ratio
      const newScale = Math.min(scaleX, scaleY);
      
      // Optional: Cap scale at 1.5x or 2x if you don't want it getting too huge on 4k screens, 
      // but for "letterbox" filling screen, we usually just take min(scaleX, scaleY).
      setScale(newScale);
    };

    window.addEventListener('resize', updateScale);
    // Initial calculation
    updateScale();

    return () => window.removeEventListener('resize', updateScale);
  }, [baseWidth, baseHeight]);

  return scale;
};