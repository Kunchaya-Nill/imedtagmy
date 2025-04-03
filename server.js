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
const router = express.Router();
app.use(router);

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;"
  );
  next();
});

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and GIF are allowed."));
    }
  },
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
    await pool.promise().query("START TRANSACTION");

    // 1. Delete associated images from storage and database
    const [images] = await pool.promise().execute(
      `SELECT i.image_id, i.image_name 
       FROM Image i
       JOIN ProjectImage pi ON i.image_id = pi.image_id
       WHERE pi.project_id = ?`,
      [projectId]
    );

    // Delete files from uploads directory
    for (const image of images) {
      try {
        fs.unlinkSync(path.join(__dirname, "uploads", image.image_name));
      } catch (err) {
        console.error(`Error deleting file ${image.image_name}:`, err);
      }
    }

    // 2. Delete from ProjectImage table
    await pool.promise().execute(
      "DELETE FROM ProjectImage WHERE project_id = ?",
      [projectId]
    );

    // 3. Delete from Image table
    await pool.promise().execute(
      `DELETE FROM Image WHERE image_id IN (
        SELECT image_id FROM ProjectImage WHERE project_id = ?
      )`,
      [projectId]
    );

    // 4. Delete the project
    const [result] = await pool.promise().execute(
      "DELETE FROM Project WHERE project_id = ?",
      [projectId]
    );

    if (result.affectedRows === 0) {
      await pool.promise().query("ROLLBACK");
      return res.status(404).json({ error: "Project not found" });
    }

    // 5. Reorder remaining project IDs
    await pool.promise().execute(`
      SET @count = 0;
      UPDATE Project SET project_id = (@count := @count + 1) ORDER BY project_id;
    `);

    // 6. Reset AUTO_INCREMENT
    const [maxId] = await pool.promise().execute(
      "SELECT MAX(project_id) AS maxId FROM Project"
    );
    await pool.promise().execute(
      `ALTER TABLE Project AUTO_INCREMENT = ${maxId[0].maxId + 1}`
    );

    // Commit transaction
    await pool.promise().query("COMMIT");

    res.json({ message: "Project deleted and IDs reordered successfully" });
  } catch (error) {
    await pool.promise().query("ROLLBACK");
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// ✅ API: Upload images for a project
app.post("/upload/:projectId", upload.array("images", 10), async (req, res) => {
  const projectId = req.params.projectId;
  
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No images uploaded" });
  }

  try {
    await pool.promise().query("START TRANSACTION");

    for (const file of req.files) {
      // Insert into Image table
      const [imageResult] = await pool.promise().execute(
        "INSERT INTO Image (image_name, labeled_status) VALUES (?, ?)",
        [file.filename, 0]
      );
      
      // Insert into ProjectImage table
      await pool.promise().execute(
        "INSERT INTO ProjectImage (project_id, image_id, image_count) VALUES (?, ?, ?)",
        [projectId, imageResult.insertId, 1]
      );
    }

    await pool.promise().query("COMMIT");
    res.json({ 
      message: "Images uploaded successfully",
      count: req.files.length
    });
  } catch (error) {
    await pool.promise().query("ROLLBACK");
    
    // Clean up uploaded files if transaction failed
    req.files.forEach(file => {
      try {
        fs.unlinkSync(path.join(__dirname, "uploads", file.filename));
      } catch (err) {
        console.error(`Error deleting file ${file.filename}:`, err);
      }
    });

    console.error("Error uploading images:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ API: Get images for a specific project
app.get("/images/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  try {
    const [rows] = await pool.promise().execute(
      `SELECT i.image_id, i.image_name 
      FROM Image i
      JOIN ProjectImage pi ON i.image_id = pi.image_id
      WHERE pi.project_id = ?`, 
      [projectId]
    );

    res.json(rows);
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ message: "Internal server error" });
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