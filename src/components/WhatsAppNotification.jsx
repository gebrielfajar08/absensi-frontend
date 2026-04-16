import { useState, useEffect } from 'react';
import api from '../api/axios';

const WhatsAppNotification = () => {
    const [selectedClass, setSelectedClass] = useState('');
    const [messageType, setMessageType] = useState('attendance');
    const [customMessage, setCustomMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState(null);
    const [classOptions, setClassOptions] = useState([]);
    const [studentsCount, setStudentsCount] = useState(null);

    useEffect(() => {
        const loadClasses = async () => {
            try {
                const response = await api.get('/admin/classes');
                const classesPayload = Array.isArray(response.data) ? response.data : response.data?.data || [];
                setClassOptions(classesPayload);
            } catch (err) {
                console.warn('Gagal memuat kelas:', err?.message || err);
                setClassOptions([]);
            }
        };

        loadClasses();
    }, []);

    const handleSend = async () => {
        if (!selectedClass) {
            return setResult({ success: false, message: 'Pilih kelas terlebih dahulu.' });
        }

        setSending(true);
        setResult(null);

        try {
            const response = await api.post('/whatsapp/send-bulk', {
                class_id: selectedClass,
                message_type: messageType,
                custom_message: customMessage,
                send_when: 'absensi' // flag aplikasi WA otomatis bisa gunakan
            });

            if (Array.isArray(response.data?.sent_to)) {
                setStudentsCount(response.data.sent_to.length);
            }

            setResult({
                success: true,
                message: response.data.message || 'Notifikasi WA berhasil dikirim ke siswa/ortu.'
            });
        } catch (err) {
            setResult({
                success: false,
                message: err.response?.data?.message || 'Gagal mengirim WhatsApp'
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border-2 border-blue-200 p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-4">📱 Notifikasi WhatsApp</h2>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pilih Kelas
                    </label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- Pilih Kelas --</option>
                        {classOptions.length === 0 ? (
                            <option value="">(belum ada kelas, sinkronisasi database)</option>
                        ) : (
                            classOptions.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name || c.kelas || c.nama || `Kelas ${c.id}`}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tipe Pesan
                    </label>
                    <select
                        value={messageType}
                        onChange={(e) => setMessageType(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="attendance">📢 Absensi</option>
                        <option value="pickup">🔔 Jam Pulang</option>
                        <option value="general">📝 Umum</option>
                    </select>
                </div>

                {messageType === 'general' && (
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Pesan Custom
                        </label>
                        <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            rows="4"
                            className="w-full px-4 py-2.5 border-2 border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Tulis pesan..."
                        />
                    </div>
                )}

                <button
                    onClick={handleSend}
                    disabled={sending || !selectedClass}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all shadow-lg"
                >
                    {sending ? '⏳ Mengirim...' : '📱 Kirim WhatsApp'}
                </button>

                {result && (
                    <div className={`p-4 rounded-xl ${
                        result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                        {result.message}
                        {studentsCount !== null && (
                            <p className="text-xs mt-2 text-slate-500">Dikirim ke {studentsCount} orang tua.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppNotification;