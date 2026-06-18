import React, { useEffect, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onScan, onError, facingMode = 'environment', onToggleCamera, isActive = true }) => {
  const [scanner, setScanner] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const startScanner = async () => {
      try {
        setIsStarting(true);
        setCameraError('');
        
        const readerElement = document.getElementById('qr-reader-component');
        if (!readerElement) {
          console.warn('QR reader element not found');
          return;
        }

        if (scanner) return;

        const newScanner = new Html5Qrcode('qr-reader-component');
        setScanner(newScanner);

        await newScanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (onScan) onScan(decodedText);
          },
          () => {}
        );
        setIsStarting(false);
      } catch (err) {
        console.error('Failed to start QR scanner:', err);
        setCameraError('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
        setIsStarting(false);
        if (onError) onError(err);
      }
    };

    startScanner();

    return () => {
      const cleanup = async () => {
        if (scanner) {
          try {
            if (scanner.isScanning) await scanner.stop();
            await scanner.clear();
          } catch (err) {
            console.warn('QR scanner cleanup warning:', err.message);
          }
        }
      };
      cleanup();
    };
  }, [isActive, facingMode]);

  return (
    <div className="animate-fade-in text-center">
      {isStarting && (
        <div className="absolute inset-0 z-[60] bg-blue-600/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-pulse mb-4">
            <span className="text-4xl">📸</span>
          </div>
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Izinkan Kamera</h3>
          <p className="text-blue-100 text-sm leading-relaxed max-w-[250px]">
            Mohon klik <b>"Allow/Izinkan"</b> pada notifikasi browser untuk memulai proses absensi.
          </p>
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-4 mx-auto max-w-[280px] aspect-square relative border-4 border-blue-50">
        <div id="qr-reader-component" className="w-full h-full"></div>
      </div>

      {cameraError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[10px] text-red-600 font-bold">
          ⚠️ {cameraError}
        </div>
      )}

      {onToggleCamera && (
        <button
          onClick={onToggleCamera}
          className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-black border-2 border-blue-100 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
        >
          <span>🔄</span> Putar Kamera ({facingMode === 'environment' ? 'Belakang' : 'Depan'})
        </button>
      )}
    </div>
  );
};

export default QRScanner;