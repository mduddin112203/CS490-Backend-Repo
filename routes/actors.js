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

// Get actor details by ID
router.get('/:id', async (req, res) => {
  try {
    const actorId = req.params.id;
    
    // Get actor details
    const actorQuery = `
      SELECT a.actor_id, a.first_name, a.last_name
      FROM actor AS a
      WHERE a.actor_id = ?
    `;
    
    const [actorRows] = await db.execute(actorQuery, [actorId]);
    
    if (actorRows.length === 0) {
      return res.status(404).json({ error: 'Actor not found' });
    }
    
    // Get actor's films
    const filmsQuery = `
      SELECT f.film_id, f.title, c.name AS category_name
      FROM film AS f
      JOIN film_actor AS fa ON fa.film_id = f.film_id
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      WHERE fa.actor_id = ?
      ORDER BY f.title
    `;
    
    const [filmRows] = await db.execute(filmsQuery, [actorId]);
    
    const actor = actorRows[0];
    actor.films = filmRows;
    
    res.json(actor);
  } catch (error) {
    console.error('Error fetching actor details:', error);
    res.status(500).json({ error: 'Failed to fetch actor details' });
  }
});

// Get top 5 rented films for a specific actor
router.get('/:id/top-rented-films', async (req, res) => {
  try {
    const actorId = req.params.id;
    
    const query = `
      SELECT f.film_id, f.title, c.name AS category_name, COUNT(r.rental_id) AS rental_count
      FROM film AS f
      JOIN film_actor AS fa ON fa.film_id = f.film_id
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      JOIN inventory AS i ON i.film_id = f.film_id
      LEFT JOIN rental AS r ON r.inventory_id = i.inventory_id
      WHERE fa.actor_id = ?
      GROUP BY f.film_id, f.title, c.name
      ORDER BY rental_count DESC, f.title
      LIMIT 5
    `;
    
    const [rows] = await db.execute(query, [actorId]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching actor top rented films:', error);
    res.status(500).json({ error: 'Failed to fetch actor top rented films' });
  }
});

// Search actors by name
router.get('/search/:query', async (req, res) => {
  try {
    const searchQuery = `%${req.params.query}%`;
    
    const query = `
      SELECT a.actor_id, a.first_name, a.last_name, COUNT(fa.film_id) AS film_count
      FROM actor AS a
      JOIN film_actor AS fa ON fa.actor_id = a.actor_id
      WHERE CONCAT(a.first_name, ' ', a.last_name) LIKE ?
      GROUP BY a.actor_id, a.first_name, a.last_name
      ORDER BY a.last_name, a.first_name
      LIMIT 20
    `;
    
    const [rows] = await db.execute(query, [searchQuery]);
    res.json(rows);
  } catch (error) {
    console.error('Error searching actors:', error);
    res.status(500).json({ error: 'Failed to search actors' });
  }
});

module.exports = router;

