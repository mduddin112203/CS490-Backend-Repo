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

// Search customers by multiple criteria with smart prioritization
router.get('/search', async (req, res) => {
  try {
    const { customerId, name } = req.query;
    
    // Check if any search criteria is provided
    if (!customerId && !name) {
      return res.json([]);
    }
    
    let whereConditions = [];
    let params = [];
    
    // Build dynamic WHERE clause based on provided criteria
    if (customerId) {
      const isNumeric = !isNaN(customerId) && !isNaN(parseInt(customerId));
      if (isNumeric) {
        whereConditions.push('customer_id = ?');
        params.push(parseInt(customerId));
      } else {
        whereConditions.push('customer_id LIKE ?');
        params.push(`%${customerId}%`);
      }
    }
    
    if (name) {
      // Search in both first name, last name, and full name
      whereConditions.push('(first_name LIKE ? OR last_name LIKE ? OR CONCAT(first_name, \' \', last_name) LIKE ?)');
      const nameSearchTerm = `%${name}%`;
      params.push(nameSearchTerm, nameSearchTerm, nameSearchTerm);
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Simple ordering based on search criteria
    let orderBy = 'ORDER BY ';
    if (customerId && !name) {
      // For ID search, order by customer_id
      orderBy += 'customer_id';
    } else if (name && !customerId) {
      // For name search, order by name
      orderBy += 'last_name, first_name';
    } else {
      // Mixed search - order by ID first, then name
      orderBy += 'customer_id, last_name, first_name';
    }
    
    const query = `
      SELECT customer_id, first_name, last_name, email, active, create_date
      FROM customer
      WHERE ${whereClause}
      ${orderBy}
      LIMIT 50
    `;
    
    console.log('Customer search query:', query);
    console.log('Customer search params:', params);
    
    const [rows] = await db.execute(query, params);
    console.log('Customer search results:', rows.length, 'customers found');
    res.json(rows);
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ error: 'Failed to search customers' });
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

// Add new customer (creates address/city if needed)
router.post('/', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      store_id,
      // address fields
      address,
      district,
      city,
      country,
      postal_code = null,
      phone = null,
    } = req.body;

    if (!first_name || !last_name || !email || !store_id || !address || !district || !city || !country) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1) Find or create country
    const [countryRows] = await db.execute(`SELECT country_id FROM country WHERE country = ?`, [country]);
    let countryId = countryRows.length ? countryRows[0].country_id : null;
    if (!countryId) {
      const [insCountry] = await db.execute(`INSERT INTO country (country, last_update) VALUES (?, NOW())`, [country]);
      countryId = insCountry.insertId;
    }

    // 2) Find or create city within country
    const [cityRows] = await db.execute(`SELECT city_id FROM city WHERE city = ? AND country_id = ?`, [city, countryId]);
    let cityId = cityRows.length ? cityRows[0].city_id : null;
    if (!cityId) {
      const [insCity] = await db.execute(`INSERT INTO city (city, country_id, last_update) VALUES (?, ?, NOW())`, [city, countryId]);
      cityId = insCity.insertId;
    }

    // 3) Create address (use POINT(0 0) for required location field)
    const addressSql = `
      INSERT INTO address (address, address2, district, city_id, postal_code, phone, location, last_update)
      VALUES (?, '', ?, ?, ?, ?, ST_GeomFromText('POINT(0 0)'), NOW())
    `;
    const [insAddress] = await db.execute(addressSql, [address, district, cityId, postal_code, phone]);
    const newAddressId = insAddress.insertId;

    // 4) Create customer
    const customerSql = `
      INSERT INTO customer (store_id, first_name, last_name, email, address_id, active, create_date)
      VALUES (?, ?, ?, ?, ?, 1, NOW())
    `;
    const [result] = await db.execute(customerSql, [store_id, first_name, last_name, email, newAddressId]);

    res.status(201).json({
      message: 'Customer created successfully',
      customer_id: result.insertId,
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// Update customer (optionally updates address)
router.put('/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const {
      first_name,
      last_name,
      email,
      // optional address fields
      address,
      district,
      city,
      country,
      postal_code = null,
      phone = null,
    } = req.body;

    // Update basic customer fields first
    const customerSql = `
      UPDATE customer
      SET first_name = ?, last_name = ?, email = ?, last_update = NOW()
      WHERE customer_id = ?
    `;
    const [result] = await db.execute(customerSql, [first_name, last_name, email, customerId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // If address fields provided, update address as well
    if (address && district && city && country) {
      // Fetch customer's address_id
      const [addrRow] = await db.execute(`SELECT address_id FROM customer WHERE customer_id = ?`, [customerId]);
      if (addrRow.length) {
        const addressId = addrRow[0].address_id;

        // Ensure city exists (and country)
        const [countryRows] = await db.execute(`SELECT country_id FROM country WHERE country = ?`, [country]);
        let countryId = countryRows.length ? countryRows[0].country_id : null;
        if (!countryId) {
          const [insCountry] = await db.execute(`INSERT INTO country (country, last_update) VALUES (?, NOW())`, [country]);
          countryId = insCountry.insertId;
        }

        const [cityRows] = await db.execute(`SELECT city_id FROM city WHERE city = ? AND country_id = ?`, [city, countryId]);
        let cityId = cityRows.length ? cityRows[0].city_id : null;
        if (!cityId) {
          const [insCity] = await db.execute(`INSERT INTO city (city, country_id, last_update) VALUES (?, ?, NOW())`, [city, countryId]);
          cityId = insCity.insertId;
        }

        const updateAddrSql = `
          UPDATE address
          SET address = ?, district = ?, city_id = ?, postal_code = ?, phone = ?, last_update = NOW()
          WHERE address_id = ?
        `;
        await db.execute(updateAddrSql, [address, district, cityId, postal_code, phone, addressId]);
      }
    }

    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

module.exports = router;