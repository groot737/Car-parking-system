const mysql = require('mysql');
require('dotenv').config();

const con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  // port: 8889,
  database: 'carparking'
});

con.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }

  const sqlQueries = [
    `CREATE TABLE Users (
      UserID INT AUTO_INCREMENT PRIMARY KEY,
      Full_Name VARCHAR(255),
      Email VARCHAR(255),
      PasswordHash VARCHAR(255),
      VirtualBalance DECIMAL(10, 2) DEFAULT 100,
      IsAdmin BOOLEAN DEFAULT FALSE
    )`,
    `CREATE TABLE Vehicle (
      VehicleID INT AUTO_INCREMENT PRIMARY KEY,
      UserID INT,
      Name VARCHAR(255),
      Type VARCHAR(255),
      NumberPlate VARCHAR(255),
      FOREIGN KEY (UserID) REFERENCES Users(UserID)
    )`,
    `CREATE TABLE ParkingZone (
      ZoneID INT AUTO_INCREMENT PRIMARY KEY,
      Name VARCHAR(255) UNIQUE,
      Address VARCHAR(255) UNIQUE,
      PricePerHour DECIMAL(10, 2)
    )`,
    `CREATE TABLE ActiveZones (
      ActiveZoneID INT AUTO_INCREMENT PRIMARY KEY,
      ZoneID INT,
      StartDate DATE,
      EndDate DATE,
      StartHour TIME,
      EndHour TIME,
      UserID INT,
      executed INT DEFAULT 0,
      last_cut_time TIMESTAMP,
      FOREIGN KEY (ZoneID) REFERENCES ParkingZone(ZoneID),
      FOREIGN KEY (UserID) REFERENCES Users(UserID)
    )`,
    `CREATE TABLE ParkingHistory (
      HistoryID INT AUTO_INCREMENT PRIMARY KEY,
      UserID INT,
      ZoneID INT,
      StartTime DATETIME,
      EndTime DATETIME,
      AmountCharged DECIMAL(10, 2),
      FOREIGN KEY (UserID) REFERENCES Users(UserID),
      FOREIGN KEY (ZoneID) REFERENCES ParkingZone(ZoneID)
    )`,
    `CREATE TABLE Tokens (
      TokenID INT AUTO_INCREMENT PRIMARY KEY,
      UserID INT,
      TokenValue VARCHAR(255) UNIQUE NOT NULL, -- Unique token value
      ExpirationTime DATETIME, -- Timestamp indicating token expiration
      TokenType ENUM('access', 'refresh') NOT NULL, -- Indicates whether it's an access or refresh token
      CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of token creation
      FOREIGN KEY (UserID) REFERENCES Users(UserID)
    );
    `
  ];

  sqlQueries.forEach((query) => {
    con.query(query, (err, result) => {
      if (err) {
        return 'table exists';
      }
      console.log('Query executed successfully.');
    });
  });
});

module.exports = {con}