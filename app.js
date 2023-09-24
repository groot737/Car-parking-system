const express = require('express')
const { connect, con } = require('./server_script/dbconfig')
const bcrypt = require('bcrypt')
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

app.listen(3000)