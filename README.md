# Car Parking System RESTful API

![Car Parking System](https://github.com/groot737/Car-parking-system/blob/main/image/banner.png) <!-- Replace 'link_to_your_banner_image' with the actual URL of your title banner image -->

Welcome to the Car Parking System RESTful API! This API provides seamless management of parking spaces, user registration & login, vehicle management, and much more.

## Features

### User Management

- **User Registration & Login:** Allows users to register an account and log in securely.
- **Password Recovery:** Enables users to recover their account password through a secure process.
- **Admin Privileges:** Admin users have special privileges for managing the system.

### Vehicle Management

- **CRUD Operations:** Users can Create, Read, Update, and Delete their vehicles.
- **Vehicle Types:** Supports different types of vehicles, ensuring accurate management.

### Parking Zones Management

- **CRUD Operations:** Admins can Create, Read, Update, and Delete parking zones.
- **Booking:** Users can book parking zones based on availability.

### Security

- **Secured Endpoints:** All endpoints are secured with authentication and authorization mechanisms.
- **Token-based Authentication:** Uses token-based authentication for secure API access.

### Financial Management

- **Deduct Money Every Hour:** Automatically deducts money from user accounts every hour of parking.
- **View Parking History:** Allows users to view their parking history and payment details.

## API Documentation

For detailed API documentation, please refer to [API Documentation](link_to_your_api_documentation).

## Getting Started

To get started with the Car Parking System API, follow these steps:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/groot737/Car-parking-system.git
   cd Car-parking-system

2. **Install packages:**
   ```bash
   npm install bcrypt date-and-time dotenv express jsonwebtoken mysql nodemailer

3. **Add environment variables:**
   ```bash
   DB_HOST 
   DB_USER 
   DB_PASS 
   HOST 
   LOGIN 
   PASS 
