const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

// Middleware for session authentication
function sessionAuthentication(db){
  return session({
    store: new pgSession({
      pool: db, // connection database pool
      tableName: "user_sessions", // session table name
      schemaName: "ecoms" //custom schema name
    }),
    secret: process.env.SESSION_SECRET,
    cookie: { 
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
      secure: true,
      sameSite: 'none'
      },
    resave: false,
    saveUninitialized: false
  })
}

// Middleware for passport
function setupPassport(db) {

  passport.use(new LocalStrategy({ usernameField: 'email'}, async (email, password, done) => { 
    try {
      const {rows} = await db.query('SELECT * FROM ecoms.customer WHERE email = $1', [email]);
      const user = rows[0];
      const dbPassword = user.password;

      if (!user) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      // Use bcrypt to compare passwords
      const isMatch = await bcrypt.compare(password, dbPassword);

      if(!isMatch) {
        return done(null, false, { message: 'Incorrect email or password.' });
      }

      return done(null, user);

    } catch (err) {
      return done(err);
    }
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
}

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

module.exports = {
  sessionAuthentication,
  setupPassport,
  hashPassword
}