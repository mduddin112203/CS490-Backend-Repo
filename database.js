const mysql = require('mysql2');
const config = require('./config');

// Use a pooled connection with promise API for convenient db.execute(...)
const pool = mysql.createPool({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();