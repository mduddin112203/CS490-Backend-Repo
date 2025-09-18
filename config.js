module.exports = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Shams123',
    database: process.env.DB_NAME || 'sakila'
  },
  port: process.env.PORT || 5001
};