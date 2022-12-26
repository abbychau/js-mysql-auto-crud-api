# API Server

This API server is a Node.js application that provides access to a MySQL database through a set of RESTful routes. The server is designed to automatically adapt to the schema of any MySQL database, allowing you to easily access and manipulate data without having to hard-code the database structure.

## Features

- Automatically adapts to the schema of any MySQL database
- Provides read and write access to any table through the `/api/:table` route
- Supports filters, ordering, pagination, and limit options through query parameters
- Uses JSON Web Tokens (JWTs) to authenticate and authorize users
- Stores and manages tokens in a JSON file
- Caches the DESCRIBE query for each table to improve performance

## Usage

To use the API server, you need to have a MySQL database set up and running. You also need to set the following environment variables:

- `MYSQL_HOST`: the hostname or IP address of the MySQL server
- `MYSQL_USER`: the username to connect to the MySQL server
- `MYSQL_PASSWORD`: the password for the MySQL user
- `MYSQL_DATABASE`: the name of the database to use
- `ACCESS_TOKEN_SECRET`: the secret to use to sign and verify JWTs

Once you have set these variables and installed the necessary dependencies (`mysql` and `jsonwebtoken`), you can start the API server by running the `index.js` file.

To access the data in the MySQL database, you can use the following routes:

- `GET /api/:table`: retrieves a list of rows from the specified table. You can use query parameters to filter, order, paginate, and limit the results.
- `GET /api/:table/:id`: retrieves a single row from the specified table with the specified ID.
- `POST /api/:table`: inserts a new row into the specified table. The request body should contain the data for the new row in JSON format.
- `PUT /api/:table/:id`: updates an existing row in the specified table. The request body should contain the updated data in JSON format.
- `DELETE /api/:table/:id`: deletes a row from the specified table with the specified ID.

To authenticate and authorize users, you can use the following routes:

- `POST /api/tokens`: creates a new token. The request body should contain a `user` object with the user's data, and optional `table`, `read`, and `write` parameters to specify the table and permissions granted by the token.
- `DELETE /api/tokens/:token`: deletes a token.

## Token Management

To manage the tokens and the user data associated with them, you can edit the `tokens.json` file. This file contains a JSON object with the tokens as keys and the user data as values. You can add, edit, or delete tokens and user data as needed.

The API server will automatically reload the `tokens.json` file every 10 seconds to refresh the token cache. You can modify the refresh interval by changing the `CACHE_REFRESH_INTERVAL` constant in the `index.js` file.

## Sample

Here is a sample that demonstrates how to use the `/api/:table` route to retrieve a list of rows from the `users` table, using query parameters to filter, order, paginate, and limit the results:

# Sample Request

GET /api/users?filter=name,cs,john&sort=id,desc&page=2&limit=10
Authorization: Bearer <TOKEN>

# Sample Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 20,
    "name": "John Smith",
    "email": "john.smith@example.com"
  },
  {
    "id": 19,
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  // Additional rows
]
```