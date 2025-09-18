# CS490 Sakila Backend API

Backend API for the Sakila DVD Store management system.

## Prerequisites

- Node.js v18.x or higher
- MySQL Server with Sakila database
- npm package manager

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/mduddin112203/CS490-Backend-Repo.git
   cd CS490-Backend-Repo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure database**
   - Ensure MySQL is running
   - Import the Sakila database if not already done
   - Update `config.js` with your database credentials if needed:
     ```javascript
     module.exports = {
       database: {
         host: 'localhost',
         user: 'root',
         password: 'your_password',
         database: 'sakila'
       },
       port: 5001
     };
     ```

4. **Start the server**
   ```bash
   npm start
   ```

The server will start on `http://localhost:5001`

## API Endpoints

### Films
- `GET /api/films/top-rented` - Get top 5 rented films
- `GET /api/films/:id` - Get film details by ID
- `GET /api/films/search` - Search films by title, actor, or genre
- `GET /api/films` - Get all films with pagination
- `POST /api/films/:id/rent` - Rent a film

### Actors
- `GET /api/actors/top` - Get top 5 actors
- `GET /api/actors/:id` - Get actor details by ID
- `GET /api/actors/:id/top-rented-films` - Get actor's top rented films
- `GET /api/actors/search/:query` - Search actors by name

### Customers
- `GET /api/customers` - Get all customers with pagination
- `GET /api/customers/search` - Search customers
- `GET /api/customers/:id` - Get customer details by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `POST /api/customers/:id/return-rental` - Return a rental

## Database Setup

This project uses the MySQL Sakila sample database. Download and import it from:
https://dev.mysql.com/doc/index-other.html

## Environment Variables

You can use environment variables to configure the database connection:
- `DB_HOST` - Database host (default: localhost)
- `DB_USER` - Database user (default: root)
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name (default: sakila)
- `PORT` - Server port (default: 5001)

## Development

For development with auto-restart:
```bash
npm run dev
```

## Technologies Used

- Node.js
- Express.js
- MySQL2
- CORS