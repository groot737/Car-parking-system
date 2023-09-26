const mysql = require('mysql');
const { con } = require('./dbconfig');


function tokenExists(req, res, next) {
    const providedToken = req.headers['authorization']?.split(' ')[1];

    if (!providedToken) {
        return res.status(401).json({ error: 'Provide token!' });
    }

    // Check if the token exists in the database
    const selectTokenQuery = 'SELECT TokenValue, UserID FROM Tokens WHERE TokenValue = ?';

    con.query(selectTokenQuery, [providedToken], (err, results) => {
        if (err) {
            console.error('Error checking token in the database:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Incorrect token' });
        }
        req.user = results[0].UserID
        next();
    });
}


module.exports = tokenExists;
