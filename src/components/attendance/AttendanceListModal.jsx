import React from 'react';
import { formatTimeShort } from '../../utils/attendance';

const AttendanceListModal = ({ show, records, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md my-auto shadow-2xl relative overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <h3 className="text-base font-semibold text-slate-800">Daftar Absensi Hari Ini</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {records.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <p className="text-4xl mb-3">📭</p>
              <p className="font-medium">Belum ada absensi tercatat hari ini.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record, index) => (
                <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      record.displayStatus === 'hadir' ? 'bg-emerald-500' :
                      record.displayStatus === 'terlambat' ? 'bg-amber-500' :
                      record.displayStatus === 'absen' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {record.userName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{record.userName}</p>
                      <p className="text-xs text-slate-500 capitalize">{record.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatTimeShort(new Date(record.scanTime))}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      record.displayStatus === 'hadir' ? 'bg-emerald-100 text-emerald-700' :
                      record.displayStatus === 'terlambat' ? 'bg-amber-100 text-amber-700' :
                      record.displayStatus === 'absen' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {record.displayStatus === 'hadir' ? 'Hadir' :
                       record.displayStatus === 'terlambat' ? 'Terlambat' :
                       record.displayStatus === 'absen' ? 'Absen' :
                       record.displayStatus === 'izin' ? 'Izin' :
                       record.displayStatus === 'sakit' ? 'Sakit' : 'Lain-lain'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceListModal;