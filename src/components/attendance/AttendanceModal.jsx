import React from 'react';
import QRScanner from './QRScanner';
import StudentManualForm from './StudentManualForm';
import TeacherManualForm from './TeacherManualForm';
import PermissionForm from './PermissionForm';

const AttendanceModal = ({ 
  show, 
  onClose, 
  activeUserRole, 
  setActiveUserRole,
  activeMethodTab, 
  setActiveMethodTab,
  activeAttendanceAction,
  setActiveAttendanceAction,
  studentForm,
  setStudentForm,
  teacherForm,
  setTeacherForm,
  izinForm,
  setIzinForm,
  onStudentSubmit,
  onTeacherSubmit,
  onIzinSubmit,
  onQRScan,
  isSubmitting,
  submitMessage,
  attendanceSettings,
  facingMode,
  setFacingMode,
  cameraError,
  isCameraStarting
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md my-auto shadow-2xl relative overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold text-slate-800">Absensi</h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Metode: {activeMethodTab}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Role Tabs */}
          <div className="flex justify-center mb-6 space-x-2 flex-wrap">
            <div className="inline-flex bg-slate-100 rounded-xl p-1">
              {['siswa', 'guru'].map((role) => (
                <button
                  key={role}
                  onClick={() => { setActiveUserRole(role); setActiveMethodTab('scan'); }}
                  className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    activeUserRole === role
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {role === 'siswa' ? '🧑‍🎓' : '👨‍🏫'} {role === 'siswa' ? 'Siswa' : 'Guru'}
                </button>
              ))}
            </div>
          </div>

          {/* Method Tabs */}
          <div className="flex justify-center mb-5 space-x-3 flex-wrap">
            <div className="inline-flex bg-slate-50 rounded-2xl p-1 border border-slate-200 w-full md:w-auto">
              {[
                { id: 'scan', label: 'Scan QR', icon: '📷' },
                { id: 'manual', label: 'Manual', icon: '✍️' },
                { id: 'izin', label: 'Izin', icon: '📝' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveMethodTab(tab.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                    activeMethodTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg border border-blue-400'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-inner overflow-hidden min-h-[380px] flex flex-col justify-center transition-all duration-300">
            <div className="p-5 relative">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400 mb-1">Aksi Absensi</p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {activeMethodTab === 'izin'
                      ? 'Pengajuan Izin'
                      : activeAttendanceAction === 'pulang'
                        ? 'Absensi Pulang'
                        : 'Absensi Datang'}
                  </h3>
                </div>
                {activeMethodTab !== 'izin' && (
                  <div className="inline-flex rounded-full bg-slate-100 p-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                    <button
                      type="button"
                      onClick={() => setActiveAttendanceAction('datang')}
                      className={`px-3 py-2 rounded-full transition ${activeAttendanceAction === 'datang' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      Datang
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAttendanceAction('pulang')}
                      className={`px-3 py-2 rounded-full transition ${activeAttendanceAction === 'pulang' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      Pulang
                    </button>
                  </div>
                )}
              </div>

              {/* QR Scanner */}
              {activeMethodTab === 'scan' && (
                <QRScanner
                  isActive={show && activeMethodTab === 'scan'}
                  onScan={onQRScan}
                  facingMode={facingMode}
                  onToggleCamera={() => setFacingMode(facingMode === 'environment' ? 'user' : 'environment')}
                />
              )}

              {/* Student Manual Form */}
              {activeMethodTab === 'manual' && activeUserRole === 'siswa' && (
                <StudentManualForm
                  formData={studentForm}
                  setFormData={setStudentForm}
                  onSubmit={onStudentSubmit}
                  isSubmitting={isSubmitting}
                  submitMessage={submitMessage}
                />
              )}

              {/* Teacher Manual Form */}
              {activeMethodTab === 'manual' && activeUserRole === 'guru' && (
                <TeacherManualForm
                  formData={teacherForm}
                  setFormData={setTeacherForm}
                  onSubmit={onTeacherSubmit}
                  isSubmitting={isSubmitting}
                  submitMessage={submitMessage}
                />
              )}

              {/* Permission Form */}
              {activeMethodTab === 'izin' && (
                <PermissionForm
                  formData={izinForm}
                  setFormData={setIzinForm}
                  onSubmit={onIzinSubmit}
                  isSubmitting={isSubmitting}
                  submitMessage={submitMessage}
                  activeUserRole={activeUserRole}
                />
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 text-xs flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Info Waktu {activeAttendanceAction === 'pulang' ? 'Pulang' : 'Datang'}
            </h4>
            <ul className="space-y-1 text-xs text-blue-800">
              <li>
                • Absen Dibuka: <strong>{activeAttendanceAction === 'pulang' ? attendanceSettings.pulangStartTime : attendanceSettings.attendanceStartTime}</strong>
              </li>
              <li>
                • Absen Ditutup: <strong>{activeAttendanceAction === 'pulang' ? attendanceSettings.pulangEndTime : attendanceSettings.attendanceEndTime}</strong>
              </li>
              <li>• Status ditentukan otomatis berdasarkan waktu scan</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModal;