const mysql = require('mysql2/promise');
const config = require('./config');

const db = mysql.createConnection({
  host: config.database.host,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database
});

module.exports = db;