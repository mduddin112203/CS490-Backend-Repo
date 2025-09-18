const express = require('express');
const cors = require('cors');
const config = require('./config');

// Import routes
const filmsRoutes = require('./routes/films');
const actorsRoutes = require('./routes/actors');
const customersRoutes = require('./routes/customers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/films', filmsRoutes);
app.use('/api/actors', actorsRoutes);
app.use('/api/customers', customersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - Using a different approach
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
