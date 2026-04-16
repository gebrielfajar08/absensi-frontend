import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import api from "../api";
import { persistAuthResponse, dashboardPathForRole } from '../utils/authSession';

const QRScanner = ({ onScanSuccess, onClose }) => {
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState('');
    const scannerRef = useRef(null);
    const html5QrCodeRef = useRef(null);

    useEffect(() => {
        startScanner();
        return () => stopScanner();
    }, []);

    const startScanner = async () => {
        try {
            const html5QrCode = new Html5Qrcode('qr-reader');
            html5QrCodeRef.current = html5QrCode;

            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await html5QrCode.start(
    { facingMode: 'environment' },
    config,
    handleScan,
                (errorMessage) => {
                    // Scanning continues, ignore errors
                }
            );
            setScanning(true);
        } catch (err) {
            setError('Gagal mengakses kamera. Pastikan izin kamera diberikan.');
            console.error(err);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current && scanning) {
            try {
                await html5QrCodeRef.current.stop();
                setScanning(false);
            } catch (err) {
                console.error('Gagal menghentikan scanner:', err);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                
                {/* ← Header dengan Tombol Kembali */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                    <button 
                        onClick={onClose}
                        className="flex items-center text-white/90 hover:text-white transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span className="ml-2 text-sm font-medium">Kembali</span>
                    </button>
                    <h3 className="text-white font-bold text-sm">Scan QR Code</h3>
                    <div className="w-16"></div> {/* Spacer untuk center */}
                </div>

                {/* ← Scanner Area - SATU KAMERA SAJA */}
                <div className="p-4">
                    {error ? (
                        <div className="text-center py-6">
                            <div className="text-4xl mb-3">📷</div>
                            <p className="text-red-600 text-xs mb-3 px-2">{error}</p>
                            <button 
                                onClick={startScanner}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                            >
                                Coba Lagi
                            </button>
                        </div>
                    ) : (
                        <div>
                            {/* ← Kamera SATU saja, ukuran proporsional */}
                            <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden mx-auto"></div>
                            
                            {/* Instruksi */}
                            <div className="text-center mt-4">
                                <p className="text-gray-600 text-xs font-medium mb-1">
                                    📷 Arahkan kamera ke QR Code
                                </p>
                                <p className="text-gray-400 text-[10px]">
                                    Pastikan pencahayaan cukup
                                </p>
                            </div>

                            {/* Loading indicator */}
                            {!scanning && (
                                <div className="text-center mt-4">
                                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                                    <p className="text-gray-500 text-xs mt-2">Mengaktifkan kamera...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-[10px] text-gray-500 text-center">
                        💡 QR Code berisi ID/NIS untuk login cepat
                    </p>
                </div>
            </div>
        </div>
    );
};

const handleScan = async (data) => {
    if (!data) return;

    try {
        const res = await api.post('/scan', {
            qr_code: data
        });

        if (res.data.token) {

            const u = persistAuthResponse(res);

            alert("Login berhasil");

            window.location.href = dashboardPathForRole(u?.role);

        } else {
            alert("Token tidak ditemukan dari server");
        }

    } catch (error) {
        console.error(error);
        alert("Scan gagal");
    }
};

export default QRScanner;