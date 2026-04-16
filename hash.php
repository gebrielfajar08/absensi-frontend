<?php
// Masukkan password yang ingin di-hash (ganti '123456' dengan password Anda)
$password = '123456';

// Generate hash
$hashedPassword = password_hash($password, PASSWORD_BCRYPT);

// Tampilkan hasil
echo "Password Hash: <br>";
echo "<code style='background:#f0f0f0; padding:10px; font-family:monospace;'>" . $hashedPassword . "</code>";

// Contoh hasil:
// $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uhe13xYXc
?>