const express = require('express');
const db = require('../database');
const router = express.Router();

// Get top 5 actors by number of films
router.get('/top', async (req, res) => {
  try {
    const query = `
      SELECT a.actor_id, a.first_name, a.last_name, COUNT(fa.film_id) AS film_count
      FROM actor AS a
      JOIN film_actor AS fa ON fa.actor_id = a.actor_id
      GROUP BY a.actor_id, a.first_name, a.last_name
      ORDER BY film_count DESC, a.last_name, a.first_name
      LIMIT 5
    `;
    
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top actors:', error);
    res.status(500).json({ error: 'Failed to fetch top actors' });
  }
});

module.exports = router;