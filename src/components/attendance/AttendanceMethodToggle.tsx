import React from 'react';
import { motion } from 'framer-motion';
import { Scan, QrCode } from 'lucide-react';

interface AttendanceMethodToggleProps {
  method: 'face' | 'qr';
  onChange: (method: 'face' | 'qr') => void;
}

const AttendanceMethodToggle: React.FC<AttendanceMethodToggleProps> = ({ method, onChange }) => {
  return (
    <div className="flex items-center justify-center">
      <div className="flex p-1 bg-muted/60 backdrop-blur-sm rounded-2xl border border-border/50">
        <motion.button
          onClick={() => onChange('face')}
          className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            method === 'face' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {method === 'face' && (
            <motion.div
              layoutId="activeMethod"
              className="absolute inset-0 bg-primary rounded-xl shadow-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Face ID
          </span>
        </motion.button>

        <motion.button
          onClick={() => onChange('qr')}
          className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            method === 'qr' ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {method === 'qr' && (
            <motion.div
              layoutId="activeMethod"
              className="absolute inset-0 rounded-xl shadow-md"
              style={{ background: 'linear-gradient(135deg, hsl(var(--ios-purple)), hsl(var(--ios-pink)))' }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            <QrCode className="w-4 h-4" />
            QR Code
          </span>
        </motion.button>
      </div>
    </div>
  );
};

export default AttendanceMethodToggle;
