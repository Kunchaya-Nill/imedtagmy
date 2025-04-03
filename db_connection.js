const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',  // Change if needed
  password: 'Missmukuro021',  // Set your password
  database: 'your_database'  // Change to your database name
});

connection.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

connection.end();
