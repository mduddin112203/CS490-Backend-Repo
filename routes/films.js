const express = require('express');
const db = require('../database');
const router = express.Router();

// Get top 5 rented films of all time
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

// Search films by multiple criteria
router.get('/search', async (req, res) => {
  try {
    const { title, actorName, genre } = req.query;
    
    // Check if any search criteria is provided
    if (!title && !actorName && !genre) {
      return res.json([]);
    }
    
    let whereConditions = [];
    let params = [];
    
    // Build dynamic WHERE clause based on provided criteria
    if (title) {
      whereConditions.push('f.title LIKE ?');
      params.push(`%${title}%`);
    }
    
    if (genre) {
      whereConditions.push('c.name LIKE ?');
      params.push(`%${genre}%`);
    }
    
    if (actorName) {
      // Search in both first name, last name, and full name
      whereConditions.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR CONCAT(a.first_name, \' \', a.last_name) LIKE ?)');
      const actorSearchTerm = `%${actorName}%`;
      params.push(actorSearchTerm, actorSearchTerm, actorSearchTerm);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    const query = `
      SELECT DISTINCT f.film_id, f.title, c.name AS category_name, f.rating, f.rental_rate,
             GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS actors
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      LEFT JOIN film_actor AS fa ON fa.film_id = f.film_id
      LEFT JOIN actor AS a ON a.actor_id = fa.actor_id
      WHERE ${whereClause}
      GROUP BY f.film_id, f.title, c.name, f.rating, f.rental_rate
      ORDER BY f.title
      LIMIT 50
    `;
    
    const [rows] = await db.execute(query, params);
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
    
    // Get film details with category
    const filmQuery = `
      SELECT f.film_id, f.title, f.description, f.release_year, f.rating, 
             f.special_features, f.rental_duration, f.rental_rate, f.replacement_cost,
             c.name AS category_name
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
    
    // Get inventory count by store (only available copies)
    const inventoryQuery = `
      SELECT s.store_id, 
             COUNT(CASE 
               WHEN i.inventory_id IS NOT NULL 
                    AND NOT EXISTS(
                      SELECT 1 FROM rental r 
                      WHERE r.inventory_id = i.inventory_id 
                      AND r.return_date IS NULL
                    ) 
               THEN 1 
               END) AS available_copies
      FROM store AS s
      LEFT JOIN inventory AS i ON i.store_id = s.store_id AND i.film_id = ?
      GROUP BY s.store_id
    `;
    
    const [inventoryRows] = await db.execute(inventoryQuery, [filmId]);
    
    const film = filmRows[0];
    film.actors = actorRows;
    film.inventory = inventoryRows;
    
    res.json(film);
  } catch (error) {
    console.error('Error fetching film details:', error);
    res.status(500).json({ error: 'Failed to fetch film details' });
  }
});

// Get all films with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT f.film_id, f.title, c.name AS category_name, f.rating, f.rental_rate
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
      ORDER BY f.title
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM film AS f
      JOIN film_category AS fc ON fc.film_id = f.film_id
      JOIN category AS c ON c.category_id = fc.category_id
    `;
    
    const [rows] = await db.execute(query);
    const [countResult] = await db.execute(countQuery);
    
    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      films: rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching films:', error);
    res.status(500).json({ error: 'Failed to fetch films' });
  }
});

// Rent a film to a customer
router.post('/:id/rent', async (req, res) => {
  try {
    const filmId = req.params.id;
    const { customer_id, store_id } = req.body;
    
    if (!customer_id || !store_id) {
      return res.status(400).json({ error: 'Customer ID and Store ID are required' });
    }
    
    // Find available inventory for this film at the specified store
    const inventoryQuery = `
      SELECT i.inventory_id
      FROM inventory i
      LEFT JOIN rental r ON r.inventory_id = i.inventory_id AND r.return_date IS NULL
      WHERE i.film_id = ? AND i.store_id = ? AND r.rental_id IS NULL
      LIMIT 1
    `;
    
    const [inventoryRows] = await db.execute(inventoryQuery, [filmId, store_id]);
    
    if (inventoryRows.length === 0) {
      return res.status(400).json({ error: 'No available copies of this film at the specified store' });
    }
    
    const inventoryId = inventoryRows[0].inventory_id;
    
    // Create rental record
    const rentalQuery = `
      INSERT INTO rental (inventory_id, customer_id, staff_id, rental_date)
      VALUES (?, ?, 1, NOW())
    `;
    
    const [result] = await db.execute(rentalQuery, [inventoryId, customer_id]);
    
    res.status(201).json({
      message: 'Film rented successfully',
      rental_id: result.insertId,
      inventory_id: inventoryId
    });
    
  } catch (error) {
    console.error('Error renting film:', error);
    res.status(500).json({ error: 'Failed to rent film' });
  }
});

module.exports = router;