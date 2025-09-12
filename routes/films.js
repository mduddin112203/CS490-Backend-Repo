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

// Get film details by ID
router.get('/:id', async (req, res) => {
  try {
    const filmId = req.params.id;
    
    // Get film details
    const filmQuery = `
      SELECT f.film_id, f.title, f.description, f.release_year, f.rating, f.length, f.rental_rate, f.replacement_cost, c.name AS category_name
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      WHERE f.film_id = ?
    `;
    
    const [filmRows] = await db.execute(filmQuery, [filmId]);
    
    if (filmRows.length === 0) {
      return res.status(404).json({ error: 'Film not found' });
    }
    
    // Get actors for this film
    const actorsQuery = `
      SELECT a.actor_id, a.first_name, a.last_name
      FROM actor AS a
      JOIN film_actor AS fa ON fa.actor_id = a.actor_id
      WHERE fa.film_id = ?
      ORDER BY a.last_name, a.first_name
    `;
    
    const [actorRows] = await db.execute(actorsQuery, [filmId]);
    
    const film = filmRows[0];
    film.actors = actorRows;
    
    res.json(film);
  } catch (error) {
    console.error('Error fetching film details:', error);
    res.status(500).json({ error: 'Failed to fetch film details' });
  }
});

module.exports = router;