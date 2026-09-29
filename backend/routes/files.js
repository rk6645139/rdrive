const express = require('express');
const multer = require('multer');
const pool = require('../db');
const supabase = require('../supabaseClient');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// UPLOAD a file
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const folderId = req.body.folderId || null;

    // Decide type category
    let type = 'document';
if (mimetype.startsWith('image/')) type = 'image';
else if (mimetype.startsWith('video/')) type = 'video';
else if (mimetype === 'application/pdf') type = 'pdf';

    // Unique storage key: userId/timestamp-filename
    const storageKey = `${req.userId}/${Date.now()}-${originalname}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('rive-app-files')
      .upload(storageKey, buffer, { contentType: mimetype });

    if (uploadError) {
      console.error(uploadError);
      return res.status(500).json({ error: 'Storage upload failed' });
    }

    // Save metadata to database
    const result = await pool.query(
      `INSERT INTO files (name, type, size_bytes, storage_key, folder_id, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [originalname, type, size, storageKey, folderId, req.userId]
    );

    res.json({ file: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// LIST files for logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json({ files: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// GET a temporary download link for one file
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    const { data, error } = await supabase.storage
      .from('rive-app-files')
      .createSignedUrl(file.storage_key, 60); // link valid for 60 seconds

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to generate download link' });
    }

    res.json({ url: data.signedUrl, filename: file.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Download failed' });
  }
});

// DELETE a file
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Delete from Supabase Storage
    await supabase.storage.from('rive-app-files').remove([file.storage_key]);

    // Delete from database
    await pool.query('DELETE FROM files WHERE id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;