const { con } = require('./server_script/dbconfig')

const setDatabaseQuery = 'USE carparking';

// SQL query to create the trigger
const createTriggerQuery = `
CREATE EVENT CheckAndUpdateParkingCharges
ON SCHEDULE EVERY 1 SECOND
DO
BEGIN
DECLARE current_user_id INT DEFAULT NULL;
DECLARE zone_price DECIMAL(10, 2) DEFAULT NULL;
DECLARE zone_id INT DEFAULT NULL; -- Variable to store ZoneID

-- Get the current user ID with matching active zone and corresponding PricePerHour
SELECT AZ.UserID, PZ.PricePerHour, AZ.ZoneID 
INTO current_user_id, zone_price, zone_id
FROM ActiveZones AZ
JOIN ParkingZone PZ ON AZ.ZoneID = PZ.ZoneID
WHERE CONCAT(AZ.StartDate, ' ', LEFT(AZ.StartHour, 2), ':00') = CONCAT(DATE(NOW()), ' ', LEFT(TIME(NOW()), 2), ':00');

-- Check if a valid user and zone were found
IF current_user_id IS NOT NULL AND zone_price IS NOT NULL THEN
    IF (SELECT executed FROM ActiveZones WHERE UserID = current_user_id) = 0 THEN
        -- Deduct zone_price from the user's VirtualBalance if not already executed
        UPDATE Users 
        SET VirtualBalance = VirtualBalance - zone_price
        WHERE UserID = current_user_id;
        
        -- Update last_cut_time in ActiveZones
        UPDATE ActiveZones
        SET last_cut_time = NOW()
        WHERE UserID = current_user_id;
        
        -- Update the executed_count to indicate that the code has been executed
        UPDATE ActiveZones
        SET executed = 1
        WHERE UserID = current_user_id;
    END IF;
    
    -- Check if an hour has passed since the last deduction
    IF TIMESTAMPDIFF(MINUTE, (SELECT last_cut_time FROM ActiveZones WHERE UserID = current_user_id), NOW()) = 59 THEN
        -- Deduct zone_price from the user's VirtualBalance every 60 minutes and update last_cut_time
        UPDATE ActiveZones
        SET last_cut_time = NOW()
        WHERE UserID = current_user_id;
    END IF;
    
    -- Check if EndDate and EndHour match current time
    IF CONCAT((SELECT EndDate FROM ActiveZones WHERE UserID = current_user_id), ' ', LEFT((SELECT EndHour FROM ActiveZones WHERE UserID = current_user_id), 2), ':00') = CONCAT(DATE(NOW()), ' ', LEFT(TIME(NOW()), 2), ':00') THEN
        -- Insert into ParkingHistory
        INSERT INTO ParkingHistory (UserID, ZoneID, StartTime, EndTime)
        VALUES (current_user_id, zone_id, NOW(), NOW());
        
        -- Delete data from ActiveZones
        DELETE FROM ActiveZones WHERE UserID = current_user_id;
    END IF;
END IF;
END;

`;

// Execute the queries
con.query(setDatabaseQuery, (err) => {
  if (err) {
    console.error('Error setting database:', err);
    return;
  }

  con.query(createTriggerQuery, (err) => {
    if (err) {
      console.error('Error creating trigger:', err);
    } else {
      console.log('Trigger created successfully!');
    }

    // Close the connection
    con.end();
  });
});