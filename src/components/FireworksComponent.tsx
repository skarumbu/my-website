import React, { useRef } from 'react';
import { Fireworks } from '@fireworks-js/react';
import type { FireworksHandlers } from '@fireworks-js/react';

interface FireworksComponentProps {
  particles?: number;
}

export default function FireworksComponent({ particles }: FireworksComponentProps) {
  const containerRef = useRef<FireworksHandlers>(null);

  return (  
      <Fireworks ref={containerRef}
        options={{ opacity: 0.5, particles }}
        style={{
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          position: 'fixed',
          background: '#000'
        }}
      />    
  );
}