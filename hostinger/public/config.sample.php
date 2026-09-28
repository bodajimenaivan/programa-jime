<?php
// Copiá este archivo como config.php y completá los datos de tu base MySQL (hPanel → Bases de datos).
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u000000000_nombre',
    'db_user' => 'u000000000_usuario',
    'db_pass' => 'tu-contraseña',

    // Tamaño máximo por archivo, en MB (1024 = 1 GB).
    'max_upload_mb' => 1024,
    // Zona horaria para saber qué día es "hoy".
    'timezone' => 'America/Argentina/Buenos_Aires',
    // Carpeta donde se guardan los archivos (por defecto, data/ dentro de la app).
    // 'data_dir' => __DIR__ . '/data',
];
