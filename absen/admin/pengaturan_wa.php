<?php
include "../backend/koneksi.php";
include "../backend/kirim_wa.php";

// ambil data siswa dari DB
$nama = $data['nama'];
$nomor = $data['nomor_ortu'];
$jam_masuk = date("H:i:s");

// ambil pengaturan
$config = mysqli_fetch_assoc(mysqli_query($koneksi, "SELECT * FROM pengaturan_wa LIMIT 1"));

// CEK TERLAMBAT
if ($jam_masuk > "07:00:00") {

    $pesan = "Anak Anda ($nama) TERLAMBAT datang.";

    if ($config['status_wa'] == 'aktif' && $config['notif_telat'] == 1) {
        kirimWA($nama, $nomor, $pesan, $koneksi);
    }
}