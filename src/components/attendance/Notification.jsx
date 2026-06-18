import React from 'react';

const Notification = ({ show, message, type = 'error', onClose }) => {
  if (!show) return null;

  const typeConfig = {
    success: {
      border: 'border-emerald-500',
      bgIcon: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      textColor: 'text-emerald-700',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
      title: 'Berhasil!',
      iconPath: "M5 13l4 4L19 7"
    },
    warning: {
      border: 'border-amber-500',
      bgIcon: 'bg-amber-50',
      iconColor: 'text-amber-600',
      textColor: 'text-amber-700',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      title: 'Perhatian',
      iconPath: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    },
    info: {
      border: 'border-blue-500',
      bgIcon: 'bg-blue-50',
      iconColor: 'text-blue-600',
      textColor: 'text-blue-700',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      title: 'Informasi',
      iconPath: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    },
    error: {
      border: 'border-red-500',
      bgIcon: 'bg-red-50',
      iconColor: 'text-red-600',
      textColor: 'text-red-700',
      btnBg: 'bg-red-600 hover:bg-red-700',
      title: 'Terjadi Kesalahan',
      iconPath: "M6 18L18 6M6 6l12 12"
    }
  };

  const config = typeConfig[type] || typeConfig.error;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full transform transition-all animate-fade-in border-t-4 ${config.border}`}>
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${config.bgIcon}`}>
            <svg className={`w-8 h-8 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={config.iconPath} />
            </svg>
          </div>
          <h3 className={`text-lg font-semibold mb-2 ${config.textColor}`}>
            {config.title}
          </h3>
          <p className="text-slate-600 mb-5 text-sm whitespace-pre-line">{message}</p>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-lg font-medium transition-all text-sm text-white ${config.btnBg}`}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notification;