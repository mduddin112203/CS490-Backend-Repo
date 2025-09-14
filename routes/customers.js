const express = require('express');
const db = require('../database');
const router = express.Router();

// Get all customers with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Get total count for pagination
    const countQuery = 'SELECT COUNT(*) as total FROM customer';
    const [countRows] = await db.execute(countQuery);
    const totalCustomers = countRows[0].total;
    const totalPages = Math.ceil(totalCustomers / limit);
    
    // Get customers with pagination
    const customersQuery = `
      SELECT customer_id, first_name, last_name, email, active, create_date
      FROM customer
      ORDER BY last_name, first_name
      LIMIT ? OFFSET ?
    `;
    
    const [customers] = await db.execute(customersQuery, [limit, offset]);
    
    res.json({
      customers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCustomers,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
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

module.exports = router;
