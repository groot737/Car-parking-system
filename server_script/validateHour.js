
const date = require('date-and-time');

function validateAndCompareHours(starthour, endhour) {
    const hourRegex = /^(0[0-9]|1[0-9]|2[0-3]):00$/;

    if (hourRegex.test(starthour) && hourRegex.test(endhour) && starthour < endhour) {
        return true;
    }

    return false;
}

function calculateTotalHours(startDate, startHour, endDate, endHour) {
    const startDateTime = date.parse(`${startDate} ${startHour}`, 'YYYY-MM-DD HH:mm:ss');
    const endDateTime = date.parse(`${endDate} ${endHour}`, 'YYYY-MM-DD HH:mm:ss');
  
    if (!date.isValid(startDateTime) || !date.isValid(endDateTime)) {
      return 'Invalid date or time format';
    }
  
    const timeDifference = date.subtract(endDateTime, startDateTime).toSeconds();
    const totalHours = timeDifference / 3600; // Convert seconds to hours
  
    return totalHours;
}

module.exports = {
    validateAndCompareHours: validateAndCompareHours,
    calculateTotalHours: calculateTotalHours
}
