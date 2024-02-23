const express = require('express');
const app = express();
const router = express.Router();
const {Pool, Client} = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')
// Parse the DATABASE_CONNECTION environment variable as a JSON object
const dbConfig = JSON.parse(process.env.DATABASE_CONNECTION);

// Create a new pool using the parsed database connection configuration
const pool = new Pool(dbConfig);

// Middleware for session authentication
app.use(
  session({
    store: new pgSession({
      pool: pool, // connection pool
      tableName: "user_sessions", // session table name
      schemaName: "ecoms" //custom schema name
    }),
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 1000 * 60 * 60 * 24, secure: true, sameSite: 'none' },
    resave: false,
    saveUninitialized: false,
    store,
  })
);

//Get Index

router.get('/', (req, res) => {
  res.send('Index')
});


// New user sign up
router.post('/sign-up', async (req, res) => {
  const {first_name, last_name, email, password, phone_number} = req.body;

  //Insert new customer information into the database
  try {
    // Check if the user already exists
    const existingUser = await pool.query('SELECT * FROM ecoms.customers WHERE email = $1', [email]);

    if(existingUser.rows.length > 0) {
      return res.status(400).json({error: 'A user with this email already exists. Please login.'});
    }

    const newUser = await pool.query(
      'INSERT INTO customers (first_name, last_name, email, password, phone_number) VALUES (($1, $2, $3, $4, $5) RETURNING *)',
      [first_name, last_name, email, password, phone_number]
    );

    res.status(201).json({ message: 'Account successfully created', user: newUser.rows[0] });

  } catch (err) {
    console.error(err.message);
    res.status(500).json('An error occurred while registering the user');
  }
});

// Existing user login
router.post('/login', async (req, res) => {
  const {email, password} = req.body;

  try{
    // Check if the user exists
    const existingUser = await pool.query('SELECT * FROM ecoms.customer WHERE email = $1 AND password = $2', [email, password]);

    // If the user doesn't exist respond with an error
    if(existingUser.rows.length === 0){
      return res.status(400).json({error: 'User does not exist. Please create an account.'});
    }

    // Check if the password is correct
     const user = existingUser.rows[0];
     if (user.password !== password) {
      return res.status(400).json({error: 'Incorrect password, please try again.'});
     }

     // If the password is correct respond with a success message
     res.redirect('./account');
  } catch (err) {
    console.error('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while logging in'});
  }
});

// User endpoints

// Get all users. This should be restricted maybe a middleware function that checks if the user has the correct permissions. Adding this is currently our of the scope of this project.

router.get('/users', async (req, res) => {
  
  try {
    const allUsers = await pool.query('SELECT * FROM ecoms.customer');
    res.status(200).json(allUsers.rows);

  } catch (err) {
    console.error('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while fetching users'});
  }
});

// Get information about the current user (logged in)
router.get('/users/my-account', async (req, res) => {

  try {
     const user = await pool.query('SELECT * FROM ecoms.customer WHERE email, password = $1, $2', [user.email, user.password]);

    // check if user authenticated and return data
    

  } catch(err) {
    console.error('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while fetching user information'});   
  }
});



// Update information about the current user (logged in)

module.exports = router;


