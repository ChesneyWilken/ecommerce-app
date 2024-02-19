require('dotenv').config();
const express = require('express');
const app = express();
const port = 3000;
const {Pool, Client} = require('pg');
const session = require('express-session');
const indexRouter = require('./routes/index');

app.use(express.json());

// Parse the DATABASE_CONNECTION environment variable as a JSON object
const dbConfig = JSON.parse(process.env.DATABASE_CONNECTION);

// Create a new pool using the parsed database connection configuration
const pool = new Pool(dbConfig);

// Middleware for session authentication
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));


// test to check if the database is connected
(async () => {

  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT current_user');
    const currentUser = rows[0]['current_user'];
    console.log(currentUser);
  } catch (err) {
      console.error(err);
  } finally {
    client.release();
  }

})();


app.use('/', indexRouter);

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
});
