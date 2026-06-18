import React from 'react';

const PermissionForm = ({ 
  formData, 
  setFormData, 
  onSubmit, 
  isSubmitting, 
  submitMessage, 
  activeUserRole 
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {activeUserRole === 'guru' ? 'NIP' : 'NIS'} *
        </label>
        <input
          type="text"
          value={formData.user_id}
          onChange={(e) => setFormData(prev => ({ ...prev, user_id: e.target.value }))}
          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          placeholder={activeUserRole === 'guru' ? 'Masukkan NIP' : 'Masukkan NIS'}
          required
        />
      </div>
      {activeUserRole === 'siswa' && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">No. Telepon Orang Tua *</label>
          <input
            type="tel"
            value={formData.parent_phone}
            onChange={(e) => setFormData(prev => ({ ...prev, parent_phone: e.target.value }))}
            className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Contoh: 08123456789"
            required
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap *</label>
        <input
          type="text"
          value={formData.fullName}
          onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          placeholder="Nama lengkap"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Jenis *</label>
        <select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          required
        >
          <option value="izin">Izin</option>
          <option value="sakit">Sakit</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Keterangan *</label>
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
          rows="3"
          placeholder="Alasan izin/sakit..."
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Lampiran (Opsional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFormData(prev => ({ ...prev, attachment: e.target.files[0] }))}
          className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-slate-500 mt-1">Upload gambar bukti (surat dokter, dll)</p>
      </div>
      {submitMessage.text && (
        <div className={`p-3 rounded-lg text-xs ${
          submitMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {submitMessage.text}
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Memproses...
          </>
        ) : 'Kirim Pengajuan'}
      </button>
    </form>
  );
};

export default PermissionForm;