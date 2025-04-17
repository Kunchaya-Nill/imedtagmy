const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require('mysql2/promise'); // Using promise version
const cors = require("cors");
require("dotenv").config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const app = express();
const port = 5000;

// Middleware
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000'];

app.use(cors({
  origin: true, // Allow all origins for debugging
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static("public"));
const uploadsPath = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsPath, {
  setHeaders: (res, path) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=31536000");
  }
}));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Missmukuro021",
  database: process.env.DB_NAME || "Imedtag",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("Connected to MySQL database");
    await connection.query('SELECT 1');
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    if (connection) connection.release();
  }
}

testConnection();

// Ensure 'uploads' folder exists
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  }
});

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Enhanced error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error'
  });
});

// Auth Routes
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO User (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashedPassword]
    );
    
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.code === 'ER_DUP_ENTRY' ? "Email already exists" : error.message 
    });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM User WHERE email = ?", [email]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Project Routes
app.get("/api/projects", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Project ORDER BY project_id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM Project WHERE project_id = ?", [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/projects", async (req, res) => {
  const { user_id, project_name, tag, labeled_status } = req.body;

  if (!user_id || !project_name) {
    return res.status(400).json({ error: "User ID and Project Name are required." });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO Project (user_id, project_name, tag, labeled_status) VALUES (?, ?, ?, ?)",
      [user_id, project_name, tag, labeled_status || 0]
    );

    const [rows] = await pool.query("SELECT * FROM Project WHERE project_id = ?", [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error saving project:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.delete("/projects/:id", async (req, res) => {
  const projectId = req.params.id;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Get all images associated with this project
    const [images] = await connection.query(
      `SELECT i.image_id, i.image_name 
       FROM Image i
       JOIN ProjectImage pi ON i.image_id = pi.image_id
       WHERE pi.project_id = ?`,
      [projectId]
    );

    // Delete files from uploads directory
    for (const image of images) {
      try {
        const filePath = path.join(__dirname, "uploads", image.image_name);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error(`Error deleting file ${image.image_name}:`, err);
      }
    }

    // Delete from ProjectImage table
    await connection.query("DELETE FROM ProjectImage WHERE project_id = ?", [projectId]);

    // Delete from Image table
    await connection.query(
      `DELETE FROM Image WHERE image_id IN (
        SELECT image_id FROM ProjectImage WHERE project_id = ?
      )`,
      [projectId]
    );

    // Delete the project
    const [result] = await connection.query("DELETE FROM Project WHERE project_id = ?", [projectId]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Project not found" });
    }

    await connection.commit();
    res.json({ message: "Project deleted successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
});

// Get all images for a specific project
app.get("/api/projects/:id/images", authenticateToken, async (req, res) => {
  try {
    const [images] = await pool.query(
        `SELECT i.image_id, i.image_name 
         FROM Image i
         JOIN ProjectImage pi ON i.image_id = pi.image_id
         WHERE pi.project_id = ?`,
        [req.params.id]
    );
    res.json(images.map(img => ({
        ...img,
        file_path: `/uploads/${img.image_name}`
    })));
} catch (error) {
    res.status(500).json({ error: "Database error" });
}
});

// Image Routes
app.get("/api/images/:projectId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.image_id, i.image_name, i.file_path 
       FROM Image i
       JOIN ProjectImage pi ON i.image_id = pi.image_id
       WHERE pi.project_id = ?`,
      [req.params.projectId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/images/upload/:projectId', authenticateToken, upload.array('images'), async (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.user?.userId;

  console.log("=== UPLOAD REQUEST STARTED ===");
  console.log("Project ID:", req.params.projectId);
  console.log("User ID:", req.user.userId);
  console.log("Files received:", req.files ? req.files.map(f => f.originalname) : 'No files');

  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }

  console.log(`User ${userId} is uploading to project ${projectId}`);
  console.log("Files received:", req.files);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, message: "No files uploaded" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const uploaded = [];

    for (const file of req.files) {
      const [imageResult] = await connection.query(
        `INSERT INTO Image (user_id, image_name, file_path, labeled_status)
         VALUES (?, ?, ?, 0)`,
        [userId, file.filename, `/uploads/${file.filename}`]
      );
  
      await connection.query(
        `INSERT INTO ProjectImage (project_id, image_id)
         VALUES (?, ?)`,
        [projectId, imageResult.insertId]
      );
  
      uploaded.push({
        image_id: imageResult.insertId,
        file: file.filename,  // Changed to file.filename
      });
    }

    await connection.commit();
    return res.json({ success: true, count: uploaded.length, uploads: uploaded });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Upload error:", error);
    return res.status(500).json({ success: false, message: "Upload failed", error: error.message });
  } finally {
    if (connection) connection.release();
  }
});


app.delete("/images/:imageId", authenticateToken, async (req, res) => {
  const imageId = req.params.imageId;
  const userId = req.user.userId;

  try {
    // Check if the image belongs to the user
    const [image] = await pool.query(
      `SELECT i.image_name FROM Image i
       JOIN ProjectImage pi ON i.image_id = pi.image_id
       JOIN Project p ON pi.project_id = p.project_id
       WHERE i.image_id = ? AND p.user_id = ?`,
      [imageId, userId]
    );

    if (image.length === 0) {
      return res.status(403).json({ message: "Not authorized to delete this image" });
    }

    // Delete from DB
    await pool.query("DELETE FROM Image WHERE image_id = ?", [imageId]);

    // Delete file - using the stored filename
    const filePath = path.join(__dirname, "uploads", image[0].image_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function handleDbError(res, error, action) {
  console.error(`Error ${action}:`, error);
  res.status(500).json({ 
    error: `Failed to ${action}`,
    details: error.message 
  });
}

// Get project images
app.get("/api/projects/:id/images", authenticateToken, async (req, res) => {
  try {
      const [images] = await pool.query(
          `SELECT i.image_id, i.image_name 
           FROM Image i
           JOIN ProjectImage pi ON i.image_id = pi.image_id
           WHERE pi.project_id = ?`,
          [req.params.id]
      );
      res.json(images.map(img => ({
          ...img,
          file_path: `/uploads/${img.image_name}`
      })));
  } catch (error) {
      res.status(500).json({ error: "Database error" });
  }
});

// Get single image
app.get('/api/images/:id', authenticateToken, async (req, res) => {
  const imageId = req.params.id;

  try {
    const [rows] = await pool.query(
      `SELECT i.image_id, i.image_name, 
              COALESCE(i.file_path, CONCAT('/uploads/', i.image_name)) AS file_path 
       FROM Image i
       WHERE i.image_id = ?`, 
      [imageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Image not found' 
      });
    }

    res.json(rows[0]); // Return the single image object, not an array
  } catch (err) {
    console.error("Error in GET /api/images/:id:", err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching image',
      error: err.message 
    });
  }
});

// Get image annotations
app.get("/api/images/:imageId/annotations", authenticateToken, async (req, res) => {
  try {
    const [annotations] = await pool.query(
      `SELECT a.*, l.label_name, l.label_color 
       FROM Annotation a
       JOIN ImageLabel il ON a.imagelabel_id = il.imagelabel_id
       JOIN Label l ON il.label_id = l.label_id
       WHERE il.image_id = ?`,
      [req.params.imageId]
    );

    res.json(annotations);
  } catch (error) {
    console.error("❌ Error fetching annotations for image", req.params.imageId, ":", error.message);
    res.status(500).json({ error: "Failed to fetch annotations", details: error.message });
  }
});


// Save annotation
app.post("/api/annotations", authenticateToken, async (req, res) => {
  try {
    const { image_id, label_id, x_min, x_max, y_min, y_max } = req.body;

    // Validation
    if (!image_id || !label_id || 
        x_min === undefined || x_max === undefined ||
        y_min === undefined || y_max === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Find or create ImageLabel relationship
    const [rows] = await pool.query(
      `SELECT imagelabel_id FROM ImageLabel 
       WHERE image_id = ? AND label_id = ?`,
      [image_id, label_id]
    );

    let imagelabel_id;
    if (rows.length === 0) {
      const [result] = await pool.query(
        `INSERT INTO ImageLabel (image_id, label_id) VALUES (?, ?)`,
        [image_id, label_id]
      );
      imagelabel_id = result.insertId;
    } else {
      imagelabel_id = rows[0].imagelabel_id;
    }

    // 2. Save the annotation
    const [result] = await pool.query(
      `INSERT INTO Annotation 
       (imagelabel_id, x_min, x_max, y_min, y_max)
       VALUES (?, ?, ?, ?, ?)`,
      [imagelabel_id, x_min, x_max, y_min, y_max]
    );

    res.json({ 
      success: true,
      annotation_id: result.insertId
    });

  } catch (error) {
    console.error("Error saving annotation:", error);
    res.status(500).json({ 
      error: "Failed to save annotation",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Label CRUD endpoints
app.post("/api/labels", authenticateToken, async (req, res) => {
  try {
      const { project_id, label_name, label_color, label_category } = req.body;
      const [result] = await pool.query(
          `INSERT INTO Label 
           (project_id, label_name, label_color, label_category)
           VALUES (?, ?, ?, ?)`,
          [project_id, label_name, label_color, label_category || 'object']
      );
      res.json({ label_id: result.insertId });
  } catch (error) {
      res.status(500).json({ error: "Database error" });
  }
});

app.put("/api/labels/:id", authenticateToken, async (req, res) => {
  try {
      const { label_name, label_color } = req.body;
      await pool.query(
          `UPDATE Label SET 
           label_name = ?, label_color = ?
           WHERE label_id = ?`,
          [label_name, label_color, req.params.id]
      );
      res.json({ success: true });
  } catch (error) {
      res.status(500).json({ error: "Database error" });
  }
});

// Labeling Routes
app.get("/api/projects/:projectId/labels", authenticateToken, async (req, res) => {
  try {
    // Verify project belongs to user
    const [project] = await pool.query(
      "SELECT * FROM Project WHERE project_id = ? AND user_id = ?", 
      [req.params.projectId, req.user.userId]
    );
    
    if (project.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const [labels] = await pool.query(
      "SELECT * FROM Label WHERE project_id = ?",
      [req.params.projectId]
    );
    
    res.json(labels);
  } catch (error) {
    console.error("Error fetching labels:", error);
    res.status(500).json({ error: "Failed to fetch labels" });
  }
});

// Get annotations for a specific image
app.get("/api/images/:imageId/annotations", authenticateToken, async (req, res) => {
  try {
    // Verify image belongs to user
    const [image] = await pool.query(
      `SELECT i.* FROM Image i
       JOIN ProjectImage pi ON i.image_id = pi.image_id
       JOIN Project p ON pi.project_id = p.project_id
       WHERE i.image_id = ? AND p.user_id = ?`,
      [req.params.imageId, req.user.userId]
    );
    
    if (image.length === 0) {
      return res.status(404).json({ error: "Image not found" });
    }

    const [annotations] = await pool.query(
      `SELECT a.*, l.label_name, l.label_color 
       FROM Annotation a
       JOIN ImageLabel il ON a.imagelabel_id = il.imagelabel_id
       JOIN Label l ON il.label_id = l.label_id
       WHERE il.image_id = ?`,
      [req.params.imageId]
    );
    
    res.json(annotations);
  } catch (error) {
    console.error("Error fetching annotations:", error);
    res.status(500).json({ error: "Failed to fetch annotations" });
  }
});

// Update a label
app.put("/api/labels/:labelId", authenticateToken, async (req, res) => {
  try {
    const { label_name, label_color } = req.body;
    
    // Verify label belongs to user's project
    const [label] = await pool.query(
      `SELECT l.* FROM Label l
       JOIN Project p ON l.project_id = p.project_id
       WHERE l.label_id = ? AND p.user_id = ?`,
      [req.params.labelId, req.user.userId]
    );
    
    if (label.length === 0) {
      return res.status(404).json({ error: "Label not found" });
    }

    await pool.query(
      "UPDATE Label SET label_name = ?, label_color = ? WHERE label_id = ?",
      [label_name, label_color, req.params.labelId]
    );
    
    res.json({ message: "Label updated successfully" });
  } catch (error) {
    console.error("Error updating label:", error);
    res.status(500).json({ error: "Failed to update label" });
  }
});

// Delete a label
app.delete("/api/labels/:labelId", authenticateToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Verify label belongs to user's project
    const [label] = await connection.query(
      `SELECT l.* FROM Label l
       JOIN Project p ON l.project_id = p.project_id
       WHERE l.label_id = ? AND p.user_id = ?`,
      [req.params.labelId, req.user.userId]
    );
    
    if (label.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Label not found" });
    }

    // First delete annotations using this label
    await connection.query(
      `DELETE a FROM Annotation a
       JOIN ImageLabel il ON a.imagelabel_id = il.imagelabel_id
       WHERE il.label_id = ?`,
      [req.params.labelId]
    );

    // Then delete image-label relationships
    await connection.query(
      "DELETE FROM ImageLabel WHERE label_id = ?",
      [req.params.labelId]
    );

    // Finally delete the label
    await connection.query(
      "DELETE FROM Label WHERE label_id = ?",
      [req.params.labelId]
    );

    await connection.commit();
    res.json({ message: "Label deleted successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error deleting label:", error);
    res.status(500).json({ error: "Failed to delete label" });
  } finally {
    if (connection) connection.release();
  }
});


// Root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});