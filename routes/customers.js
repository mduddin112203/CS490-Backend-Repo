const express = require('express');
const db = require('../database');
const router = express.Router();

// Get all customers with pagination and search
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let queryParams = [];
    
    // Add search functionality
    if (search.trim()) {
      whereClause = `
        WHERE customer_id LIKE ? 
           OR first_name LIKE ? 
           OR last_name LIKE ? 
           OR CONCAT(first_name, ' ', last_name) LIKE ?
      `;
      const searchTerm = `%${search.trim()}%`;
      queryParams = [searchTerm, searchTerm, searchTerm, searchTerm];
    }
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM customer ${whereClause}`;
    const [countRows] = await db.execute(countQuery, queryParams);
    const totalCustomers = countRows[0].total;
    const totalPages = Math.ceil(totalCustomers / limit);
    
    // Get customers with pagination and search
    const customersQuery = `
      SELECT customer_id, first_name, last_name, email, active, create_date
      FROM customer
      ${whereClause}
      ORDER BY last_name, first_name
      LIMIT ? OFFSET ?
    `;
    
    const [customers] = await db.execute(customersQuery, [...queryParams, limit, offset]);
    
    res.json({
      customers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      search: search.trim()
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get customer details by ID
router.get('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    
    const customerQuery = `
      SELECT customer_id, first_name, last_name, email, active, create_date, last_update
      FROM customer
      WHERE customer_id = ?
    `;
    
    const [customerRows] = await db.execute(customerQuery, [customerId]);
    
    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer's rental history
    const rentalsQuery = `
      SELECT r.rental_id, r.rental_date, r.return_date, f.title, f.film_id
      FROM rental AS r
      JOIN inventory AS i ON i.inventory_id = r.inventory_id
      JOIN film AS f ON f.film_id = i.film_id
      WHERE r.customer_id = ?
      ORDER BY r.rental_date DESC
      LIMIT 10
    `;
    
    const [rentals] = await db.execute(rentalsQuery, [customerId]);
    
    const customer = customerRows[0];
    customer.recent_rentals = rentals;
    
    res.json(customer);
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// Create a new customer with minimal required fields
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, store_id = 1 } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'first_name, last_name and email are required' });
    }

    // Insert with a placeholder address if schema requires address_id
    // Ensure an address exists; create a simple temporary address in city 1 if needed
    const [addrRows] = await db.execute('SELECT address_id FROM address LIMIT 1');
    let addressId = addrRows.length ? addrRows[0].address_id : null;
    if (!addressId) {
      const [addrIns] = await db.execute(
        "INSERT INTO address (address, address2, district, city_id, postal_code, phone, location, last_update) VALUES ('TBD', '', 'TBD', 1, NULL, NULL, ST_GeomFromText('POINT(0 0)'), NOW())"
      );
      addressId = addrIns.insertId;
    }

    const [result] = await db.execute(
      'INSERT INTO customer (store_id, first_name, last_name, email, address_id, active, create_date) VALUES (?, ?, ?, ?, ?, 1, NOW())',
      [store_id, first_name, last_name, email, addressId]
    );

    res.status(201).json({ customer_id: result.insertId, message: 'Customer created' });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

module.exports = router;
