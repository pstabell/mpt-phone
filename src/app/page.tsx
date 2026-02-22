'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import PhoneDialer from '@/components/PhoneDialer';

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e6f7f8 0%, #b8e6e8 100%)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#00919E' }}></div>
          <p className="text-gray-600">Loading MPT Phone...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4" style={{ background: 'linear-gradient(135deg, #e6f7f8 0%, #b8e6e8 100%)' }}>
      <div className="container mx-auto max-w-md">
        <div className="text-center mb-6 pt-4">
          {/* MPT Logo */}
          <div className="flex justify-center mb-3">
            <Image 
              src="/mpt-logo.jpg" 
              alt="Metro Point Technology" 
              width={180} 
              height={60}
              className="rounded"
              priority
            />
          </div>
          <p className="text-gray-600 text-sm">JackBot • +1 (239) 426-7058</p>
        </div>
        <PhoneDialer />
      </div>
    </main>
  );
}