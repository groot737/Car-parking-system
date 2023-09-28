const express = require('express')
const { connect, con } = require('./server_script/dbconfig')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const { transporter } = require('./server_script/emailConfig')
const tokenExists = require('./server_script/authMiddleware')
const date = require('date-and-time')
const { validateAndCompareHours } = require('./server_script/validateHour')
const { calculateTotalHours } = require('./server_script/validateHour')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.json('hello from the main endpoint')
})

app.post('/register', (req, res) => {
    // Object destructuring
    const { Full_Name, Email, Password } = req.body;
    const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
    // Hashing and salting password to save securely
    const saltRounds = 10;
    const salt = bcrypt.genSaltSync(saltRounds);
    const PasswordHash = bcrypt.hashSync(Password, salt);

    if (!Full_Name || !Email || !Password) {
        return res.status(400).json({ error: "All fields are required!" });
    } else if (!emailRegex.test(Email)) {
        return res.status(400).json({ error: "Enter correct email" });
    }
    // SQL query to check if user exists with this email
    const selectQuery = 'SELECT * FROM Users WHERE Email = ?';

    con.query(selectQuery, [Email], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error checking user' });
        }

        if (result.length > 0) {
            return res.status(200).json({ message: 'User already exists' });
        }

        // Inserting data and handling errors
        const insertQuery = `INSERT INTO Users (Full_Name, Email, PasswordHash) VALUES (?, ?, ?)`;
        const values = [Full_Name, Email, PasswordHash];

        con.query(insertQuery, values, (insertErr, insertResult) => {
            if (insertErr) {
                console.error(insertErr);
                return res.status(500).json({ error: 'Error registering user' });
            }

            res.status(200).json({ message: 'You have successfully registered!' });
        });
    });
});


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
                    res.status(200).json({ message: "You're successfully authorized", "Auth key": token });
                });
            }
        });
    });
});

// this endpoint is used to send user recovery key
app.post('/recover', (req, res) => {
    const { Email } = req.body;
    const emailRegex = /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/;
    const checkEmail = 'SELECT * FROM Users WHERE Email = ?';

    // Validate email format
    if (!Email || !emailRegex.test(Email)) {
        return res.status(400).json({ error: 'Enter a correct email' });
    }

    // Check if user with the provided email exists
    con.query(checkEmail, [Email], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json('Error checking user');
        }

        // If user does not exist, send 401 Unauthorized response
        if (result.length === 0) {
            return res.status(401).json({ isExist: false, message: 'User does not exist' });
        }

        // Get the user's details
        const user = result[0];

        // Generate a JWT with the user's ID as the payload
        const token = jwt.sign({ userId: user.UserID }, 'secret', { expiresIn: '1h' });

        // Query to check if a refresh token already exists for the user
        const refreshTokenQuery = 'SELECT * FROM Tokens WHERE UserID = ? AND TokenType = ?';

        con.query(refreshTokenQuery, [user.UserID, 'refresh'], (refreshTokenErr, refreshTokenResults) => {
            if (refreshTokenErr) {
                console.error('Error checking for an existing refresh token:', refreshTokenErr);
                return res.status(500).json({ error: 'Internal server error' });
            }

            if (refreshTokenResults.length > 0) {
                // If a refresh token exists, delete it from the database
                const deleteTokenQuery = 'DELETE FROM Tokens WHERE UserID = ? AND TokenType = ?';

                con.query(deleteTokenQuery, [user.UserID, 'refresh'], (deleteTokenErr, deleteTokenResult) => {
                    if (deleteTokenErr) {
                        console.error('Error deleting an existing refresh token:', deleteTokenErr);
                        return res.status(500).json({ error: 'Internal server error' });
                    }

                    // Insert the new refresh token
                    insertRefreshToken(user.UserID, token);
                });
            } else {
                // If no refresh token exists, insert the new refresh token
                insertRefreshToken(user.UserID, token);
            }
        });

        // Function to insert a new record in the token table
        function insertRefreshToken(userId, refreshToken) {
            const insertTokenQuery = 'INSERT INTO Tokens (UserID, TokenValue, TokenType, ExpirationTime) VALUES (?, ?, ?, NOW() + INTERVAL 1 HOUR)';

            con.query(insertTokenQuery, [userId, refreshToken, 'refresh'], (refreshTokenErr, refreshTokenResult) => {
                if (refreshTokenErr) {
                    console.error('Error inserting a refresh token:', refreshTokenErr);
                    return res.status(500).json({ error: 'Internal server error' });
                }

                // Prepare email options
                const emailOption = {
                    from: 'giorgiquchuloria7@gmail.com',
                    to: Email,
                    subject: 'Password recovery',
                    text: `Your Bearer Token: ${token} use it to change password.`,
                };

                // Send the email with the bearer token
                transporter.sendMail(emailOption, (err) => {
                    if (err) {
                        console.log(err);
                        return res.status(400).json('Error sending recovery key');
                    }

                    res.status(200).json({ message: 'Recovery key sent.' });
                });
            });
        }
    });
});

// this endpoint is used to change actual password via recovery key
app.post('/change/password', tokenExists, (req, res) => {

    const saltRounds = 10;
    const salt = bcrypt.genSaltSync(saltRounds);
    const PasswordHash = bcrypt.hashSync(req.body.Password, salt);
    const updatePassword = "UPDATE Users SET PasswordHash = ?"

    con.query(updatePassword, PasswordHash, (error, results) => {
        if (error) {
            console.error('Error updating data:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
        return res.status(200).json({ message: "Password changed successfully!" })
    });
})

// this endpoint allows to add vehicles
app.post('/add/car', tokenExists, (req, res) => {
    const { Name, Type, NumberPlate } = req.body
    const UserID = req.user
    const values = [UserID, Name, Type, NumberPlate]
    // check if any field is empty
    if (!Name || !Type || !NumberPlate) {
        res.status(402).json({ error: "All fields are required!" })
    }

    // sql commmand to insert data
    const insertQuery = `INSERT INTO Vehicle (UserID, Name, Type, NumberPlate) VALUES (?, ?, ?, ?)`;
    con.query(insertQuery, values, (insertErr, insertResult) => {
        if (insertErr) {
            console.error(insertErr);
            return res.status(500).json({ error: 'Error adding car' });
        }
        res.status(200).json({ message: 'Car successfully added' });
    });

})

// this endpoint allows to list user vehicles
app.post('/list/car', tokenExists, (req, res) => {
    const UserID = req.user
    // select all vehicles via user id then list vehicles
    const selectQuery = 'SELECT * FROM Vehicle WHERE UserID = ?';
    con.query(selectQuery, [UserID], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error querying vehicles' });
        }

        res.status(200).json(results)
    });

})

// this endpoint allows to delete user vehicles
app.post('/delete/car/:id', tokenExists, (req, res) => {
    const VehicleID = req.params.id

    // get vehichle by id then delete it
    const deleteQuery = 'DELETE FROM Vehicle WHERE VehicleID = ?';
    con.query(deleteQuery, [VehicleID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error deleting vehicle' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.status(200).json({ message: 'Vehicle deleted successfully' });
    });
})

// this endpoint allows to update user vehicles
app.post('/update/car/:id', tokenExists, (req, res) => {
    const VehicleID = req.params.id;
    const { Name, Type, NumberPlate } = req.body;
    const selectQuery = 'SELECT * FROM Vehicle WHERE VehicleID = ?';

    // check if any field is empty
    for (const item in req.body) {
        if (req.body[item].trim().length === 0) {
            return res.status(402).json({ error: "Value shouldn't be empty!" });
        }
    }

    con.query(selectQuery, [VehicleID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        // Remove unwanted fields
        delete result[0].VehicleID;
        delete result[0].UserID;

        // this loop helps to detect changed data
        for (const item in req.body) {
            // only update profided items 
            const updateQuery = `UPDATE  Vehicle SET ${item} = ?`
            con.query(updateQuery, [req.body[item]], (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error updating data' });
                }

                res.status(200).json({ message: 'Vehicle updated successfully' });
            });
        }
    });
});


// this endpoint allows to add parking zones
app.post('/add/zone', tokenExists, (req, res) => {
    const { Name, Address, PricePerHour } = req.body
    const values = [Name, Address, PricePerHour]

    // check if all fields are provided
    if (!Name || !Address || !PricePerHour) {
        res.status(402).json({ error: "All fields are required." })
    }

    // check if any field is empty
    values.forEach(element => {
        if (typeof (element) === "Number" && element.trim().length === 0) {
            res.status(402).json({ error: "No empty values are allowed." })
        }
    })

    const searchQuery = "SELECT isAdmin FROM Users WHERE  UserID = ?"
    con.query(searchQuery, req.user, (err, rows) => {
        if (err) {
            console.error('Error executing query:', err);
            return;
        }

        // Check if the user is an admin
        if (rows[0].isAdmin === 1) {
            const addCar = `INSERT INTO ParkingZone ( Name, Address, PricePerHour) VALUES (?, ?, ?)`
            con.query(addCar, values, (insertErr, insertResult) => {
                if (insertErr) {
                    console.error(insertErr);
                    return res.status(500).json({ error: 'Error adding parking zone' });
                }

                res.status(200).json({ message: 'Parking zone successfully added' });
            });

        } else {
            res.status(402).json({ error: "you are not admin" })
        }
    });
})

// this endpoint allows to list zones
app.post('/list/zone', tokenExists, (req, res) => {

    const searchQuery = "SELECT isAdmin FROM Users WHERE  UserID = ?"
    con.query(searchQuery, req.user, (err, rows) => {
        if (err) {
            console.error('Error executing query:', err);
            return;
        }

        // list all parking zones
        const selectQuery = 'SELECT * FROM ParkingZone';
        con.query(selectQuery, (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Error querying parking zones' });
            }

            res.status(200).json(results)
        });
    })
})

// this endpoint allows to delete zones via id
app.post('/delete/zone/:id', tokenExists, (req, res) => {

    const ZoneID = req.params.id
    const deleteQuery = 'DELETE FROM ParkingZone WHERE ZoneID = ?';

    con.query(deleteQuery, [ZoneID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error deleting parking zones' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Parking zone not found' });
        }

        res.status(200).json({ message: "Parking zone has successfully deleted" })
    });

})

// this endpoint allows to update zone via id
app.post('/update/zone/:id', tokenExists, (req, res) => {
    const ZoneID = req.params.id;
    const { Name, Address, PricePerHour } = req.body;
    const values = [Name, Address, PricePerHour];
    const selectQuery = 'SELECT * FROM Vehicle WHERE VehicleID = ?';

    // check if all fields are provided
    if (!Name || !Address || !PricePerHour) {
        return res.status(402).json({ error: "All fields are required." });
    }

    // check if any field is empty
    values.forEach(element => {
        if (typeof element !== "number" && element.trim().length === 0) {
            return res.status(402).json({ error: "No empty values are allowed." });
        }
    });

    con.query(selectQuery, [ZoneID], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Error updating parking zone' });
        }

        if (result.length === 0) {
            return res.status(404).json({ error: 'Parking zone not found' });
        }

        let updatesCompleted = 0;
        const updateCount = Object.keys(req.body).length;

        // this loop helps to detect changed data
        for (const item in req.body) {
            // only update provided items
            const updateQuery = `UPDATE ParkingZone SET ${item} = ? WHERE ZoneID = ?`;
            const updateValues = [req.body[item], ZoneID];

            con.query(updateQuery, updateValues, (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Error updating data' });
                }

                updatesCompleted++;

                if (updatesCompleted === updateCount) {
                    // All updates completed, send the response
                    res.status(200).json({ message: 'Parking zone updated successfully' });
                }
            });
        }
    });
});

// this endpoint allows to book a zone via id
app.post('/book/zone/:id', tokenExists, (req, res) => {
    const { startDate, endDate, startHour, endHour } = req.body;
    const values = [req.params.id, startDate, endDate, startHour, endHour, req.user];
    const ZoneID = req.params.id; // Get the ZoneID from the URL parameter
  
    // Check if required fields are provided
    if (!startDate || !endDate || !startHour || !endHour) {
      return res.status(400).json({ error: 'All fields are required!' });
    }
  
    // Validate date and time formats
    if (!date.isValid(startDate, 'YYYY-MM-DD')) {
      return res.status(400).json({ error: 'Wrong date format' });
    }
  
    // Validate and compare startHour and endHour
    if (!validateAndCompareHours(startHour, endHour)) {
      return res.status(400).json({ error: 'Invalid hour format or endhour should be greater than starthour' });
    }
  
    // Check if the zone exists
    con.query('SELECT * FROM ParkingZone WHERE ZoneID = ?', [ZoneID], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error checking user' });
      }
  
      if (result.length === 0) {
        return res.status(402).json({ message: 'Zone not found' });
      }
  
      // Check the user's balance and the required balance for booking
      con.query('SELECT VirtualBalance, PricePerHour FROM Users WHERE UserID = ?', [req.user], (checkErr, checkResult) => {
        if (checkErr) {
          console.error(checkErr);
          return res.status(500).json({ error: 'Internal server error' });
        }
  
        const totalHours = calculateTotalHours(startDate, startHour, endDate, endHour);
        const requiredBalance = totalHours * result[0]['PricePerHour'];
  
        if (requiredBalance > checkResult[0]['VirtualBalance']) {
          return res.status(400).json({ error: 'Insufficient balance' });
        }
  
        // Check for overlapping bookings
        con.query(`
          SELECT 1
          FROM ActiveZones
          WHERE ZoneID = ? 
            AND (
              (StartDate < ? AND EndDate > ?) OR
              (StartDate = ? AND EndDate = ? AND (EndHour > ? OR StartHour < ?))
            )`, [ZoneID, endDate, startDate, startDate, endDate, startHour, endHour], (overlapErr, overlapResult) => {
          if (overlapErr) {
            console.error(overlapErr);
            return res.status(500).json({ error: 'Internal server error' });
          }
  
          if (overlapResult.length > 0) {
            return res.status(400).json({ error: 'Parking zone is taken in this time' });
          }
  
          // If no errors and no overlaps, insert a new booking
          con.query('INSERT INTO ActiveZones (ZoneID, StartDate, EndDate, StartHour, EndHour, UserID) VALUES (?,?,?,?,?,?)', values, (insertErr, insertResult) => {
            if (insertErr) {
              console.error(insertErr);
              return res.status(500).json({ error: 'Error parking car' });
            }
            res.status(200).json({ message: 'You have purchased parking zone' });
          });
        });
      });
    });
  });
  
  
app.listen(3000)