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
      JOIN rental AS r ON r.inventory_id = i.inventory_id
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

// Search films by title, actor name, or genre
router.get('/search', async (req, res) => {
  try {
    const { q: searchQuery } = req.query;
    
    if (!searchQuery || searchQuery.trim() === '') {
      return res.json([]);
    }
    
    const searchTerm = `%${searchQuery.trim()}%`;
    
    const query = `
      SELECT DISTINCT f.film_id, f.title, f.description, f.release_year, f.rating, f.length, f.rental_rate, f.replacement_cost, c.name AS category_name
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      LEFT JOIN film_actor AS fa ON fa.film_id = f.film_id
      LEFT JOIN actor AS a ON a.actor_id = fa.actor_id
      WHERE f.title LIKE ? 
         OR a.first_name LIKE ? 
         OR a.last_name LIKE ? 
         OR CONCAT(a.first_name, ' ', a.last_name) LIKE ?
         OR c.name LIKE ?
      ORDER BY f.title
      LIMIT 50
    `;
    
    const [rows] = await db.execute(query, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);
    res.json(rows);
  } catch (error) {
    console.error('Error searching films:', error);
    res.status(500).json({ error: 'Failed to search films' });
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
    
    // Get rental statistics for this film
    const rentalStatsQuery = `
      SELECT 
        COUNT(r.rental_id) AS total_rentals,
        COUNT(DISTINCT r.customer_id) AS unique_customers,
        AVG(DATEDIFF(r.return_date, r.rental_date)) AS avg_rental_duration
      FROM inventory AS i
      JOIN rental AS r ON r.inventory_id = i.inventory_id
      WHERE i.film_id = ?
    `;
    
    // Get inventory information
    const inventoryQuery = `
      SELECT 
        COUNT(i.inventory_id) AS total_copies,
        COUNT(CASE WHEN r.rental_id IS NOT NULL AND r.return_date IS NULL THEN 1 END) AS rented_copies,
        COUNT(CASE WHEN r.return_date IS NOT NULL OR r.rental_id IS NULL THEN 1 END) AS available_copies
      FROM inventory AS i
      JOIN rental AS r ON r.inventory_id = i.inventory_id AND r.return_date IS NULL
      WHERE i.film_id = ?
    `;
    
    const [actorRows, rentalStatsRows, inventoryRows] = await Promise.all([
      db.execute(actorsQuery, [filmId]),
      db.execute(rentalStatsQuery, [filmId]),
      db.execute(inventoryQuery, [filmId])
    ]);
    
    const film = filmRows[0];
    film.actors = actorRows[0];
    film.rental_stats = rentalStatsRows[0];
    film.inventory = inventoryRows[0];
    
    res.json(film);
  } catch (error) {
    console.error('Error fetching film details:', error);
    res.status(500).json({ error: 'Failed to fetch film details' });
  }
});

// Rent a film to a customer
router.post('/:id/rent', async (req, res) => {
  try {
    const filmId = req.params.id;
    const { customer_id } = req.body;
    
    if (!customer_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    // Check if customer exists
    const customerQuery = 'SELECT customer_id FROM customer WHERE customer_id = ?';
    const [customerRows] = await db.execute(customerQuery, [customer_id]);
    
    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Find available inventory for this film
    const inventoryQuery = `
      SELECT i.inventory_id 
      FROM inventory AS i
      JOIN rental AS r ON r.inventory_id = i.inventory_id AND r.return_date IS NULL
      WHERE i.film_id = ? AND r.rental_id IS NULL
      LIMIT 1
    `;
    
    const [inventoryRows] = await db.execute(inventoryQuery, [filmId]);
    
    if (inventoryRows.length === 0) {
      return res.status(400).json({ error: 'No available copies of this film' });
    }
    
    const inventoryId = inventoryRows[0].inventory_id;
    
    // Create rental record
    const rentalQuery = `
      INSERT INTO rental (rental_date, inventory_id, customer_id, staff_id, return_date)
      VALUES (NOW(), ?, ?, 1, NULL)
    `;
    
    const [result] = await db.execute(rentalQuery, [inventoryId, customer_id]);
    
    res.json({
      success: true,
      message: 'Film rented successfully',
      rental_id: result.insertId,
      inventory_id: inventoryId,
      customer_id: customer_id,
      rental_date: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error renting film:', error);
    res.status(500).json({ error: 'Failed to rent film' });
  }
});

module.exports = router;