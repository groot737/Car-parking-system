const express           = require('express')
const { connect, con }  = require('./server_script/dbconfig')
const bcrypt            = require('bcrypt')
const jwt               = require('jsonwebtoken')
const nodemailer        = require('nodemailer')
const { transporter }   = require('./server_script/emailConfig')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.json('hello from the main endpoint')
})

app.post('/register', (req, res) => {

    // Obeject desturct
    const { Full_Name, Email, password } = req.body
    // hashing and salting password to save secure
    const saltRounds = 10;
    const salt = bcrypt.genSaltSync(saltRounds);
    const PasswordHash = bcrypt.hashSync(password, salt)
    // sql query to insert data
    const insertQuery = `INSERT INTO Users (Full_Name, Email, PasswordHash) VALUES (?, ?, ?)`;
    const selectQuery = 'SELECT * FROM Users WHERE Email = ?';
    const values = [Full_Name, Email, PasswordHash];
    // check if user exists with this email
    con.query(selectQuery, [Email], (err, result) => {
        if (err) {

            console.log(err)
            res.status(500).json('error checking user')

        } else {

            if (result.length > 0) {
                res.status(200).json({ message: 'User already exists' });
            } else {

                // inserting data and handling errors
                con.query(insertQuery, values, (err, result) => {
                    if (err) {
                        console.log(err)
                        res.status(500).json({ error: 'Error Registering user' });
                        return;
                    }
                    res.status(200).json({ message: 'you have successfully registered!' });
                });

            }
        }
    })
})

// login route to auth user
app.post('/login', (req, res) => {
    const { Email, Password } = req.body;

    // check if email and password are valid
    if (!Email || !Password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // sql query to check if email exists
    const selectQuery = 'SELECT * FROM Users WHERE Email = ?';
    con.query(selectQuery, [Email], (err, results) => {
        if (err) {
            // if  api can't connect to db show error
            console.error('Error fetching user from the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        // if user not exists display message
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
       
        // compare user input to actual password in secure way
        const user = results[0];
        bcrypt.compare(Password, user.PasswordHash, (bcryptErr, isMatch) => {
            if (bcryptErr) {
                // show error is something goes wrong
                console.error('Error comparing passwords:', bcryptErr);
                return res.status(500).json({ error: 'Internal server error' });
            }
            // if credential not match display message
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Generate a new access token
            const token = jwt.sign({ userId: user.UserID }, 'secret', { expiresIn: '1h' });

            // Check if the user already has an access token
            const selectTokenQuery = 'SELECT * FROM Tokens WHERE UserID = ? AND TokenType = ?';

            con.query(selectTokenQuery, [user.UserID, 'access'], (selectTokenErr, selectTokenResults) => {
                if (selectTokenErr) {
                    console.error('Error checking for existing access token:', selectTokenErr);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                if (selectTokenResults.length > 0) {
                    // If an access token exists, delete it to not overload db
                    const deleteTokenQuery = 'DELETE FROM Tokens WHERE UserID = ? AND TokenType = ?';

                    con.query(deleteTokenQuery, [user.UserID, 'access'], (deleteTokenErr, deleteTokenResult) => {
                        if (deleteTokenErr) {
                            console.error('Error deleting existing access token:', deleteTokenErr);
                            return res.status(500).json({ error: 'Internal server error' });
                        }

                        // Insert the new access token
                        insertAccessToken(user.UserID, token);
                    });
                } else {
                    // If no access token exists, insert the new access token
                    insertAccessToken(user.UserID, token);
                }
            });
            
            // write function to insert new record in token table
            function insertAccessToken(userId, accessToken) {
                const insertTokenQuery = 'INSERT INTO Tokens (UserID, TokenValue, TokenType, ExpirationTime) VALUES (?, ?, ?, NOW() + INTERVAL 1 HOUR)';

                con.query(insertTokenQuery, [userId, accessToken, 'access'], (insertTokenErr, insertTokenResult) => {
                    if (insertTokenErr) {
                        console.error('Error inserting access token:', insertTokenErr);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    console.log('Access token stored in the Tokens table');
                    res.status(200).json({ "Auth key": token });
                });
            }
        });
    });
});

app.listen(3000)