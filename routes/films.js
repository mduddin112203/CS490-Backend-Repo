const express = require('express');
const db = require('../database');
const router = express.Router();

// Get top 5 rented films
router.get('/top-rented', async (req, res) => {
  try {
    const query = `
      SELECT f.film_id, f.title, c.name AS category_name, COUNT(r.rental_id) AS rental_count
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      JOIN inventory AS i ON i.film_id = f.film_id
      LEFT JOIN rental AS r ON r.inventory_id = i.inventory_id
      GROUP BY f.film_id, f.title, c.name
      ORDER BY rental_count DESC, f.title
      LIMIT 5
    `;
    
    const [rows] = await db.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top rented films:', error);
    res.status(500).json({ error: 'Failed to fetch top rented films' });
  }
});

module.exports = router;