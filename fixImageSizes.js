const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const uploadsDir = path.join(__dirname, 'uploads');

(async () => {
  const pool = await mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Missmukuro021',
    database: 'Imedtag'
  });

  const [images] = await pool.query(`SELECT image_id, file_path FROM Image WHERE width IS NULL OR width = 0`);

  for (const img of images) {
    const localPath = path.join(__dirname, img.file_path); // e.g. uploads/xxxx.jpg
    if (fs.existsSync(localPath)) {
      try {
        const meta = await sharp(localPath).metadata();
        await pool.query(`UPDATE Image SET width = ?, height = ? WHERE image_id = ?`, [
          meta.width || 0,
          meta.height || 0,
          img.image_id
        ]);
        console.log(`✅ Updated image ${img.image_id}: ${meta.width}x${meta.height}`);
      } catch (err) {
        console.warn(`❌ Failed to read: ${localPath}`, err.message);
      }
    }
  }

  console.log('✔️ Done updating image sizes');
  process.exit(0);
})();
