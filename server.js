const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const bcrypt = require('bcryptjs'); // instead of 'bcrypt'
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const app = express();
const port = 5000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const router = express.Router();
app.use(router);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Serve uploaded files

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Missmukuro021",
  database: process.env.DB_NAME || "Imedtag",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Ensure MySQL Connection Works
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database");
  connection.release();
});
// Add this to your MySQL pool configuration
pool.on('connection', (connection) => {
  console.log('New database connection established');
});

pool.on('release', (connection) => {
  console.log('Connection released back to pool');
});

app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO User (name, email, password) VALUES (?, ?, ?)";

    pool.query(sql, [name, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("Error inserting user:", err);
        return res.status(500).json({ message: "Database error", error: err.sqlMessage });
      }
      res.status(201).json({ message: "User registered successfully" });
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Login Route
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const sql = "SELECT * FROM User WHERE email = ?";
  pool.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Server error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token });
  });
});

app.post("/api/recover-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ message: "Email is required" });
  }

  // Simulating email sending (Replace this with actual email logic)
  console.log(`Password reset link sent to ${email}`);

  res.json({ message: "Password reset link sent to your email!" });
});


module.exports = router;

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
  // Remove or increase the fileSize limit
  limits: { 
    fileSize: 100 * 1024 * 1024 // 100MB instead of 5MB
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

// ✅ API: Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const [rows] = await pool.promise().query("SELECT * FROM Project ORDER BY project_id DESC");
    res.json(rows);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// ✅ API: Get single project
app.get("/api/projects/:id", async (req, res) => {
  try {
      const { id } = req.params;
      const [project] = await pool.query("SELECT * FROM projects WHERE id = ?", [id]);
      if (!project.length) return res.status(404).json({ message: "Project not found" });
      res.json(project[0]);
  } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
});


// ✅ API: Get images for a project
app.get("/api/images/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;
        const [images] = await pool.query("SELECT * FROM images WHERE project_id = ?", [projectId]);
        res.json(images);
    } catch (error) {
        console.error("Error fetching images:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// Get image details
app.get('/api/images/:imageId', async (req, res) => {
  try {
      const [rows] = await pool.query('SELECT * FROM Image WHERE image_id = ?', [req.params.imageId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Image not found' });
      res.json(rows[0]);
  } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Get image annotations
app.get('/api/images/:imageId/annotations', async (req, res) => {
  try {
      const [rows] = await pool.query(`
          SELECT a.*, l.label_name, l.label_color 
          FROM Annotation a
          JOIN ImageLabel il ON a.imagelabel_id = il.imagelabel_id
          JOIN Label l ON il.label_id = l.label_id
          WHERE il.image_id = ?
      `, [req.params.imageId]);
      res.json(rows);
  } catch (error) {
      console.error('Error fetching annotations:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project labels
app.get('/api/projects/:projectId/labels', async (req, res) => {
  try {
      const [rows] = await pool.query('SELECT * FROM Label WHERE project_id = ?', [req.params.projectId]);
      res.json(rows);
  } catch (error) {
      console.error('Error fetching labels:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new label
app.post('/api/labels', async (req, res) => {
  try {
      const { project_id, label_name, label_color, label_category } = req.body;
      const [result] = await pool.query(
          'INSERT INTO Label (project_id, label_name, label_color, label_category) VALUES (?, ?, ?, ?)',
          [project_id, label_name, label_color, label_category]
      );
      const [newLabel] = await pool.query('SELECT * FROM Label WHERE label_id = ?', [result.insertId]);
      res.status(201).json(newLabel[0]);
  } catch (error) {
      console.error('Error creating label:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Update label
app.put('/api/labels/:id', async (req, res) => {
  try {
      const { label_name, label_color } = req.body;
      await pool.query(
          'UPDATE Label SET label_name = ?, label_color = ? WHERE label_id = ?',
          [label_name, label_color, req.params.id]
      );
      const [updatedLabel] = await pool.query('SELECT * FROM Label WHERE label_id = ?', [req.params.id]);
      res.json(updatedLabel[0]);
  } catch (error) {
      console.error('Error updating label:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// Save annotation
app.post('/api/annotations', async (req, res) => {
  try {
      const { image_id, label_id, x_min, x_max, y_min, y_max } = req.body;
      
      // First create ImageLabel relationship
      const [imageLabelResult] = await pool.query(
          'INSERT INTO ImageLabel (image_id, label_id) VALUES (?, ?)',
          [image_id, label_id]
      );
      
      // Then create annotation
      const [annotationResult] = await pool.query(
          'INSERT INTO Annotation (imagelabel_id, x_min, x_max, y_min, y_max) VALUES (?, ?, ?, ?, ?)',
          [imageLabelResult.insertId, x_min, x_max, y_min, y_max]
      );
      
      res.status(201).json({ success: true });
  } catch (error) {
      console.error('Error saving annotation:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

// ✅ API: Create a new project
app.post("/projects", async (req, res) => {
  console.log("Received project data:", req.body);
  const { user_id, project_name, tag, labeled_status } = req.body;

  if (!user_id || !project_name) {
    return res.status(400).json({ error: "User ID and Project Name are required." });
  }

  try {
    const [result] = await pool
      .promise()
      .query(
        "INSERT INTO Project (user_id, project_name, tag, labeled_status) VALUES (?, ?, ?, ?)",
        [user_id, project_name, tag, labeled_status || 0]
      );

    const [rows] = await pool
      .promise()
      .query("SELECT * FROM Project WHERE project_id = ?", [result.insertId]);

    res.status(201).json(rows[0]); // Return created project
  } catch (error) {
    console.error("Error saving project to database:", error);
    res.status(500).json({ error: "Database error", details: error.message });
  }
});

// ✅ API: Delete a project
app.delete("/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  try {
      // Start transaction
      const connection = await pool.promise().getConnection();
      await connection.beginTransaction();

      try {
          // 1. Get all images associated with this project
          const [images] = await connection.query(
              `SELECT i.image_id, i.image_name 
               FROM Image i
               JOIN ProjectImage pi ON i.image_id = pi.image_id
               WHERE pi.project_id = ?`,
              [projectId]
          );

          // 2. Delete files from uploads directory
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

          // 3. Delete from ProjectImage table
          await connection.query(
              "DELETE FROM ProjectImage WHERE project_id = ?",
              [projectId]
          );

          // 4. Delete from Image table
          await connection.query(
              `DELETE FROM Image WHERE image_id IN (
                  SELECT image_id FROM ProjectImage WHERE project_id = ?
              )`,
              [projectId]
          );

          // 5. Delete the project
          const [result] = await connection.query(
              "DELETE FROM Project WHERE project_id = ?",
              [projectId]
          );

          if (result.affectedRows === 0) {
              await connection.rollback();
              return res.status(404).json({ error: "Project not found" });
          }

          // 6. Reorder remaining project IDs (if needed)
          await connection.query(`
              SET @count = 0;
              UPDATE Project SET project_id = (@count := @count + 1) ORDER BY project_id;
          `);

          // 7. Reset AUTO_INCREMENT
          const [maxId] = await connection.query(
              "SELECT MAX(project_id) AS maxId FROM Project"
          );
          await connection.query(
              `ALTER TABLE Project AUTO_INCREMENT = ${maxId[0].maxId + 1}`
          );

          await connection.commit();
          res.json({ message: "Project deleted successfully" });
      } catch (error) {
          await connection.rollback();
          throw error;
      } finally {
          connection.release();
      }
  } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ 
          error: "Internal server error",
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
  }
});

// ✅ API: Upload images for a project
app.post("/api/images/upload/:projectId", upload.array("images", 10), async (req, res) => {
  const projectId = req.params.projectId;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ 
      success: false,
      message: "No images uploaded" 
    });
  }

  let connection;
  try {
    connection = await pool.promise().getConnection();
    await connection.beginTransaction();

    const uploadResults = [];
    
    for (const file of req.files) {
      try {
        const [imageResult] = await connection.query(
          "INSERT INTO Image (image_name, file_path, labeled_status) VALUES (?, ?, ?)",
          [file.originalname, `/uploads/${file.filename}`, 0]
        );
        
        await connection.query(
          "INSERT INTO ProjectImage (project_id, image_id) VALUES (?, ?)",
          [projectId, imageResult.insertId]
        );

        uploadResults.push({
          id: imageResult.insertId,
          name: file.originalname,
          path: `/uploads/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        });
      } catch (err) {
        // Delete the uploaded file if DB operation fails
        fs.unlinkSync(path.join(__dirname, "uploads", file.filename));
        throw err;
      }
    }

    await connection.commit();
    
    res.json({ 
      success: true,
      message: "Images uploaded successfully",
      count: req.files.length,
      uploads: uploadResults
    });

  } catch (error) {
    if (connection) await connection.rollback();
    
    console.error("Upload failed:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});

// ✅ API: Delete an image
app.delete("/images/:imageId", async (req, res) => {
  const imageId = req.params.imageId;
  try {
    const [image] = await pool.promise().execute("SELECT image_name FROM Image WHERE image_id = ?", [imageId]);
    if (image.length === 0) return res.status(404).json({ message: "Image not found" });

    await pool.promise().execute("DELETE FROM Image WHERE image_id = ?", [imageId]);
    fs.unlinkSync(path.join(__dirname, "uploads", image[0].image_name));

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Redirect root URL ("/") to login.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start Server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});