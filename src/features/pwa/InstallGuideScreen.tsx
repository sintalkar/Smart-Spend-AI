import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Download, Chrome, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';

export function InstallGuideScreen() {
  const navigate = useNavigate();

  const handleInstallClick = () => {
    // This will trigger the browser to show the install prompt if it's available
    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 h-full flex flex-col"
    >
      <h1 className="text-2xl font-bold text-white mb-6">How to Install Smart Spend</h1>
      
      <div className="space-y-6 flex-1">
        <div className="flex gap-4">
          <Chrome className="text-primary flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-white">Using Chrome/Edge</h3>
            <p className="text-gray-400 text-sm">Look for the "Install" icon in the address bar or tap the menu (three dots) and select "Install app".</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <Smartphone className="text-primary flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-white">Using iOS/Safari</h3>
            <p className="text-gray-400 text-sm">Tap the "Share" button at the bottom of the screen, then choose "Add to Home Screen".</p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleInstallClick}
        className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-6"
      >
        <Download size={20} />
        Try Manual Install Prompt
      </button>

      <button 
        onClick={() => navigate('/')}
        className="text-gray-400 mt-4 text-center w-full"
      >
        Back to Dashboard
      </button>
    </motion.div>
  );
}
