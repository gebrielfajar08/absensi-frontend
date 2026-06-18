import { useState, useEffect } from 'react';
import api from '../../api/axios';

const MagazineManagement = () => {
    const [magazines, setMagazines] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingMagazine, setEditingMagazine] = useState(null);
    const [showPageManager, setShowPageManager] = useState(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        is_active: true,
        show_floating_button: true,
        button_position: 'bottom-right',
        button_icon: '📖',
        button_color: '#3b82f6',
        priority: 0
    });
    const [coverImage, setCoverImage] = useState(null);
    const [coverPreview, setCoverPreview] = useState(null);

    useEffect(() => {
        loadMagazines();
    }, []);

    const loadMagazines = async () => {
        try {
            const response = await api.get('/admin/magazines');
            setMagazines(response.data);
        } catch (error) {
            console.error('Failed to load magazines:', error);
            alert('Gagal memuat data majalah');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            if (coverImage) {
                data.append('cover_image', coverImage);
            }

            if (editingMagazine) {
                await api.put(`/admin/magazines/${editingMagazine.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Majalah berhasil diupdate!');
            } else {
                await api.post('/admin/magazines', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Majalah berhasil ditambahkan!');
            }

            setShowForm(false);
            setEditingMagazine(null);
            resetForm();
            loadMagazines();
        } catch (error) {
            console.error('Failed to save magazine:', error);
            alert('Gagal menyimpan majalah');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus majalah ini?')) return;

        try {
            await api.delete(`/admin/magazines/${id}`);
            alert('Majalah berhasil dihapus!');
            loadMagazines();
        } catch (error) {
            console.error('Failed to delete magazine:', error);
            alert('Gagal menghapus majalah');
        }
    };

    const handleEdit = (magazine) => {
        setEditingMagazine(magazine);
        setFormData({
            title: magazine.title,
            description: magazine.description || '',
            is_active: magazine.is_active,
            show_floating_button: magazine.show_floating_button,
            button_position: magazine.button_position,
            button_icon: magazine.button_icon,
            button_color: magazine.button_color,
            priority: magazine.priority
        });
        if (magazine.cover_url) {
            setCoverPreview(magazine.cover_url);
        }
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            is_active: true,
            show_floating_button: true,
            button_position: 'bottom-right',
            button_icon: '📖',
            button_color: '#3b82f6',
            priority: 0
        });
        setCoverImage(null);
        setCoverPreview(null);
    };

    const handleCoverChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setCoverImage(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Pengaturan Majalah</h1>
                    <p className="text-gray-600 mt-1">Kelola majalah digital dan iklan floating</p>
                </div>
                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(true);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                >
                    + Tambah Majalah
                </button>
            </div>

            {/* Magazine List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {magazines.map((magazine) => (
                    <div key={magazine.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                        {magazine.cover_url ? (
                            <img src={magazine.cover_url} alt={magazine.title} className="w-full h-48 object-cover" />
                        ) : (
                            <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-6xl">{magazine.button_icon}</span>
                            </div>
                        )}
                        
                        <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                                <h3 className="text-lg font-bold text-gray-900">{magazine.title}</h3>
                                <div className="flex gap-1">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                        magazine.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                    }`}>
                                        {magazine.is_active ? 'Aktif' : 'Nonaktif'}
                                    </span>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{magazine.description}</p>
                            
                            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                                <span>📄 {magazine.pages?.length || 0} halaman</span>
                                <span>•</span>
                                <span>Posisi: {magazine.button_position}</span>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(magazine)}
                                    className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all text-sm font-semibold"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => setShowPageManager(magazine)}
                                    className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all text-sm font-semibold"
                                >
                                    Kelola Halaman
                                </button>
                                <button
                                    onClick={() => handleDelete(magazine.id)}
                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all text-sm font-semibold"
                                >
                                    Hapus
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {magazines.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">Belum ada majalah. Klik "Tambah Majalah" untuk memulai.</p>
                </div>
            )}

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold mb-4">
                                {editingMagazine ? 'Edit Majalah' : 'Tambah Majalah Baru'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Judul Majalah *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Deskripsi</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows="3"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Cover Image</label>
                                    {coverPreview && (
                                        <img src={coverPreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg mb-2" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleCoverChange}
                                        className="w-full"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Icon Button</label>
                                        <input
                                            type="text"
                                            value={formData.button_icon}
                                            onChange={(e) => setFormData({ ...formData, button_icon: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="📖"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Warna Button</label>
                                        <input
                                            type="color"
                                            value={formData.button_color}
                                            onChange={(e) => setFormData({ ...formData, button_color: e.target.value })}
                                            className="w-full h-10 border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Posisi Button</label>
                                    <select
                                        value={formData.button_position}
                                        onChange={(e) => setFormData({ ...formData, button_position: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="bottom-right">Kanan Bawah</option>
                                        <option value="bottom-left">Kiri Bawah</option>
                                        <option value="top-right">Kanan Atas</option>
                                        <option value="top-left">Kiri Atas</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Prioritas</label>
                                    <input
                                        type="number"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Angka lebih tinggi = muncul lebih dulu</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">Aktif</span>
                                    </label>

                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.show_floating_button}
                                            onChange={(e) => setFormData({ ...formData, show_floating_button: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-semibold text-gray-700">Tampilkan Floating Button</span>
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold disabled:bg-gray-400"
                                    >
                                        {loading ? 'Menyimpan...' : 'Simpan'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowForm(false);
                                            setEditingMagazine(null);
                                            resetForm();
                                        }}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Manager Modal */}
            {showPageManager && (
                <MagazinePageManager 
                    magazine={showPageManager}
                    onClose={() => setShowPageManager(null)}
                    onUpdate={loadMagazines}
                />
            )}
        </div>
    );
};

// Magazine Page Manager Component
const MagazinePageManager = ({ magazine, onClose, onUpdate }) => {
    const [pages, setPages] = useState(magazine.pages || []);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingPage, setEditingPage] = useState(null);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        page_number: pages.length + 1,
        content: '',
        link_url: '',
        link_text: ''
    });
    const [pageImage, setPageImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key]) data.append(key, formData[key]);
            });
            if (pageImage) {
                data.append('image', pageImage);
            }

            if (editingPage) {
                await api.put(`/admin/magazines/pages/${editingPage.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Halaman berhasil diupdate!');
            } else {
                await api.post(`/admin/magazines/${magazine.id}/pages`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                alert('Halaman berhasil ditambahkan!');
            }

            setShowAddForm(false);
            setEditingPage(null);
            resetForm();
            
            // Reload magazine data
            const response = await api.get(`/admin/magazines`);
            const updatedMagazine = response.data.find(m => m.id === magazine.id);
            setPages(updatedMagazine?.pages || []);
            onUpdate();
        } catch (error) {
            console.error('Failed to save page:', error);
            alert('Gagal menyimpan halaman');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (pageId) => {
        if (!confirm('Yakin ingin menghapus halaman ini?')) return;

        try {
            await api.delete(`/admin/magazines/pages/${pageId}`);
            alert('Halaman berhasil dihapus!');
            
            const response = await api.get(`/admin/magazines`);
            const updatedMagazine = response.data.find(m => m.id === magazine.id);
            setPages(updatedMagazine?.pages || []);
            onUpdate();
        } catch (error) {
            console.error('Failed to delete page:', error);
            alert('Gagal menghapus halaman');
        }
    };

    const handleEdit = (page) => {
        setEditingPage(page);
        setFormData({
            page_number: page.page_number,
            content: page.content || '',
            link_url: page.link_url || '',
            link_text: page.link_text || ''
        });
        if (page.image_url) {
            setImagePreview(page.image_url);
        }
        setShowAddForm(true);
    };

    const resetForm = () => {
        setFormData({
            page_number: pages.length + 1,
            content: '',
            link_url: '',
            link_text: ''
        });
        setPageImage(null);
        setImagePreview(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPageImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">Kelola Halaman: {magazine.title}</h2>
                            <p className="text-gray-600 mt-1">Total: {pages.length} halaman</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    resetForm();
                                    setShowAddForm(true);
                                }}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold"
                            >
                                + Tambah Halaman
                            </button>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>

                    {/* Pages Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {pages.map((page) => (
                            <div key={page.id} className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                                {page.image_url ? (
                                    <img src={page.image_url} alt={`Page ${page.page_number}`} className="w-full h-40 object-cover" />
                                ) : (
                                    <div className="w-full h-40 bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                                        <span className="text-4xl">📄</span>
                                    </div>
                                )}
                                <div className="p-3">
                                    <p className="text-sm font-semibold text-gray-900">Halaman {page.page_number}</p>
                                    {page.link_text && (
                                        <p className="text-xs text-gray-600 mt-1 truncate">Link: {page.link_text}</p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleEdit(page)}
                                            className="flex-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs font-semibold hover:bg-blue-100"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(page.id)}
                                            className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-semibold hover:bg-red-100"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pages.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Belum ada halaman. Klik "Tambah Halaman" untuk memulai.</p>
                        </div>
                    )}

                    {/* Add/Edit Page Form Modal */}
                    {showAddForm && (
                        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                <div className="p-6">
                                    <h3 className="text-xl font-bold mb-4">
                                        {editingPage ? 'Edit Halaman' : 'Tambah Halaman Baru'}
                                    </h3>

                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Nomor Halaman *</label>
                                            <input
                                                type="number"
                                                value={formData.page_number}
                                                onChange={(e) => setFormData({ ...formData, page_number: parseInt(e.target.value) })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Gambar Halaman</label>
                                            {imagePreview && (
                                                <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg mb-2" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                className="w-full"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Konten (HTML)</label>
                                            <textarea
                                                value={formData.content}
                                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                rows="4"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                placeholder="<h2>Judul</h2><p>Isi konten...</p>"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Link URL (Opsional)</label>
                                                <input
                                                    type="url"
                                                    value={formData.link_url}
                                                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                    placeholder="https://..."
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Teks Link</label>
                                                <input
                                                    type="text"
                                                    value={formData.link_text}
                                                    onChange={(e) => setFormData({ ...formData, link_text: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                                    placeholder="Klik di sini"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold disabled:bg-gray-400"
                                            >
                                                {loading ? 'Menyimpan...' : 'Simpan'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowAddForm(false);
                                                    setEditingPage(null);
                                                    resetForm();
                                                }}
                                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
                                            >
                                                Batal
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MagazineManagement;