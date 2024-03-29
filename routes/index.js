const express = require('express');
const app = express();
const router = express.Router();
const {Pool, Client} = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
// Parse the DATABASE_CONNECTION environment variable as a JSON object
const dbConfig = JSON.parse(process.env.DATABASE_CONNECTION);

// Create a new pool using the parsed database connection configuration
const db = new Pool(dbConfig);

// Middleware for session authentication
app.use(
  session({
    store: new pgSession({
      pool: db, // connection database pool
      tableName: "user_sessions", // session table name
      schemaName: "ecoms" //custom schema name
    }),
    secret: process.env.SESSION_SECRET,
    cookie: { maxAge: 1000 * 60 * 60 * 24, secure: true, sameSite: 'none' },
    resave: false,
    saveUninitialized: false
  })
);

// Middleware for passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy((email, password, done) => {
  (async ()=> {
    try {
      const {rows} = await db.query('SELECT * FROM ecoms.customer WHERE email = $1', [email]);
      const user = rows[0];
      const password = user.password;

      if (!user) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      // Use bcrypt to compare passwords
       const isMatch = await bcrypt.compare(password, user.password);

      if(!isMatch) {
        return done(null, false, { message: 'Incorrect email or password.' });
      } else {
        return done(null, user);
      }

    } catch (err) {
      return done(err);
    }
  })
}

));


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const {rows} = await db.query('SELECT id, email, first_name, last_name FROM ecoms.customer WHERE id = $1', [id]);
    const userObject = rows[0];

    // Check if the user exists
    if(rows.length > 0) {
      // Return the user
      done(null, userObject);
    } else {
      done(null, false)
    }

  } catch (err) {
    done(err);
  }
})

// Bcrypt password function
const hashPassword = async (password, saltRounds) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;

  } catch (err) {
    console.log(err);
  }

  return null;  
}

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
    const existingUser = await db.query('SELECT * FROM ecoms.customers WHERE email = $1', [email]);

    if(existingUser.rows.length > 0) {
      return res.status(400).json({error: 'A user with this email already exists. Please login.'});
    }

    // Hash the password
    const hashed = await hashPassword(password, 10);
    if(!hashed) {
      return res.status(500).json('An error occurred while trying to hash the password, please try again.');
    }

    const newUser = await db.query(
      'INSERT INTO customers (first_name, last_name, email, password, phone_number) VALUES (($1, $2, $3, $4, $5) RETURNING *',
      [first_name, last_name, email, hashed, phone_number]
    );

    //Account created successfully. Redirect to login
    res.status(201).json({ message: 'Account successfully created'});

  } catch (err) {
    console.error(err.message);
    res.status(500).json('An error occurred while registering the user');
  }
});


// Existing user login
router.post('/login', 
  passport.authenticate('local',
    { failureRedirect: '/login', 
      successRedirect: '/users/my-account'
    }
  )
);

// User endpoints

// Get all users. This should be restricted maybe a middleware function that checks if the user has admin permissions the correct permissions. Adding this is out of the scope of this project.

router.get('/users', async (req, res) => {
  
  try {
    const allUsers = await db.query('SELECT customer_id, first_name, last_name, email, address, phone_number FROM ecoms.customer');
    res.status(200).json(allUsers.rows);

  } catch (err) {
    console.error('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while fetching users'});
  }
});

// Get information about the current user (logged in)
router.get('/users/my-account', async (req, res) => {

  try {
    // Check if the user is authenticated
    if(!req.session.authenticated) {
      return res.status(401).json({error: 'Unauthorized'});
    }

    // Get the user information
    const userId = req.session.user.id;
    const user = await db.query('SELECT * FROM ecoms.customer WHERE id = $1', [userId]);

    // Check if the user exists
    if(user.rows.length === 0) {
      return res.status(404).json({error: 'User not found'});
    }
    
    // Return user data, this could be expanded to include order information
    res.status(200).json(user.rows[0]);

  } catch(err) {
    console.error('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while fetching user information'});   
  }
});



// Update information about the current user (logged in)
router.put('/users/my-account', async (req, res) => {

  try {
    // Check if the user is authenticated
    if(!req.session.authenticated) {
      return res.status(401).json({error: 'Unauthorized request, please login and try again'});
    }

    // Retrieve the user id from session
    const userId = req.session.user.id;
    
    // Extract the user information from the request body
    const {first_name, last_name, email, password, phone_number} = req.body;

    // Check if the user exists
    const existingUser = await db.query('SELECT * FROM ecoms.customer WHERE id = $1', [userId]);

    if(existingUser.rows.length === 0) {
      return res.status(404).json({error: 'User not found'});
    }

    // Update the user information
    const updateUserQuery = 
      `UPDATE ecoms.customer 
      SET first_name = $1, last_name = $2, email = $3, password = $4, phone_number = $5 
      WHERE id = $6
      RETURNING *`;  
    const updatedUser = await db.query(updateUserQuery, [first_name, last_name, email, password, phone_number, userId]);
    res.status(200).send('User successfully updated');

  } catch(err) {
    console.log('There has been an error:', err.message);
    res.status(500).json({error:'An error occurred while updating user information'});
  }

});


module.exports = router;