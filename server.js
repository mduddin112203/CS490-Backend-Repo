const express = require('express');
const cors = require('cors');
const config = require('./config');

// Import routes
const filmsRoutes = require('./routes/films');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/films', filmsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
