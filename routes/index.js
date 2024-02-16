const express = require('express');
const router = express.Router();
const {Pool, Client} = require('pg');

router.get('/', (req, res) => {
  res.send('Index')
});


// New user sign up
router.post('/sign-up', async (req, res) => {
  const {first_name, last_name, email, password, phone_number} =req.body;

  //Insert new customer information into the database
  try {
    // Check if the user already exists
    const existingUser = await Pool.query('SELECT * FROM customers WHERE email = $1', [email]);

    const newUser = await Pool.query(
      'INSERT INTO customers (first_name, last_name, email, password, phone_number) VALUES (($1, $2, $3, $4, $5) RETURNING *)',
      [first_name, last_name, email, password, phone_number]
    );

    res.status(201).json({ message: 'Account successfully created', user: newUser.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json('An error occurred while registering the user error');
  }
});

// Existing user login
router.post('/login', (req, res) => {
  const {email, password} = req.body;

  try{
    // Check if the user exists
    const existingUser = await Pool.query('SELECT * FROM customers WHERE email = $1', [email]);

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

//

module.exports = router;


