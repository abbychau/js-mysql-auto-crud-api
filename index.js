import mysql from 'mysql2';
import express from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, SERVER_PORT } = process.env;

const app = express();
const port = SERVER_PORT;

// Replace with your MySQL connection details
const connection = mysql.createConnection({
  host: MYSQL_HOST,
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE
});

connection.connect((error) => {
  if (error) {
    console.error(error);
  } else {
    console.log('Connected to MySQL database');
  }
});



let tokens;
let lastUpdated;

async function loadTokens() {
  tokens = JSON.parse(await fs.promises.readFile('tokens.json', 'utf8'));
  lastUpdated = Date.now();
}

async function lookupToken(token) {
  if (!tokens || Date.now() - lastUpdated > 10000) {
    await loadTokens();
  }
  return tokens[token] || null;
}

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const { table } = req.params;

  if (token == null) {
    return res.sendStatus(401);
  }

  lookupToken(token).then((user) => {
    if (user) {
      const { permissions } = user;
      const permission = req.method === 'GET' ? `read:${table}` : `write:${table}`;
      if (permissions.includes(permission)) {
        req.user = user;
        next();
      } else {
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(403);
    }
  });
}
app.use(bodyParser.json());

app.use(authenticate);
app.post('/api/tokens', (req, res) => {
  const { user, table, read, write } = req.body;

  // Generate a random token
  const token = crypto.randomBytes(64).toString('hex');

  // Create the permissions array
  const permissions = [];
  if (read) {
    permissions.push(`read:${table}`);
  }
  if (write) {
    permissions.push(`write:${table}`);
  }

  // Add the permissions to the user data object
  user.permissions = permissions;

  fs.promises
    .readFile('tokens.json', 'utf8')
    .then((data) => {
      const tokens = JSON.parse(data);
      tokens[token] = user;
      return fs.promises.writeFile('tokens.json', JSON.stringify(tokens));
    })
    .then(() => {
      res.send({ token });
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});
app.delete('/api/tokens/:token', (req, res) => {
  const { token } = req.params;

  fs.promises
    .readFile('tokens.json', 'utf8')
    .then((data) => {
      const tokens = JSON.parse(data);
      delete tokens[token];
      return fs.promises.writeFile('tokens.json', JSON.stringify(tokens));
    })
    .then(() => {
      res.sendStatus(204);
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});

function generateToken(permissions) {
  const payload = { permissions };
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET);
}

const columnCache = {};

const getColumns = (req, res, next) => {
  const table = req.params.table;

  // Check if we have the columns for this table in the cache
  if (columnCache[table]) {
    next();
  } else {
    // Get all columns in the table
    connection.query(`DESCRIBE ${table}`, (error, results) => {
      if (error) {
        console.error(error);
        res.send({ error });
      } else {
        // Store the columns in the cache
        columnCache[table] = results;
        next();
      }
    });
  }
};

// Get all rows in a table
app.get('/api/:table', getColumns, (req, res) => {
  const { table } = req.params;
  let { filter, include, exclude, order, limit, page } = req.query;

  // Parse the filter parameter
  let filterQuery = '';
  let filterValues = [];
  if (filter) {
    const [column, matchType, value] = filter.split(',');
    // Sanitize the column name
    const sanitizedColumn = mysql.escapeId(column);
    switch (matchType) {
      case 'cs':
        filterQuery = `WHERE ${sanitizedColumn} LIKE ?`;
        filterValues = ['%' + value + '%'];
        break;
      case 'sw':
        filterQuery = `WHERE ${sanitizedColumn} LIKE ?`;
        filterValues = [value + '%'];
        break;
      case 'ew':
        filterQuery = `WHERE ${sanitizedColumn} LIKE ?`;
        filterValues = ['%' + value];
        break;
      case 'eq':
        filterQuery = `WHERE ${sanitizedColumn} = ?`;
        filterValues = [value];
        break;
      case 'lt':
        filterQuery = `WHERE ${sanitizedColumn} < ?`;
        filterValues = [value];
        break;
      case 'le':
        filterQuery = `WHERE ${sanitizedColumn} <= ?`;
        filterValues = [value];
        break;
      case 'ge':
        filterQuery = `WHERE ${sanitizedColumn} >= ?`;
        filterValues = [value];
        break;
      case 'gt':
        filterQuery = `WHERE ${sanitizedColumn} > ?`;
        filterValues = [value];
        break;
      case 'bt':
        const [low, high] = value.split(',');
        filterQuery = `WHERE ${sanitizedColumn} BETWEEN ? AND ?`;
        filterValues = [low, high];
        break;
      case 'in':
        filterQuery = `WHERE ${sanitizedColumn} IN (?)`;
        filterValues = value.split(',');
        break;
      case 'is':
        filterQuery = `WHERE ${sanitizedColumn} IS NULL`;
        break;
      default:
        console.error(`Invalid match type: ${matchType}`);
        res.send({ error: 'Invalid match type' });
        return;
    }
  }

  // Parse the include parameter
  let includeQuery = '*';
  if (include) {
    // Sanitize the column names
    const sanitizedColumns = include.split(',').map(mysql.escapeId).join(', ');
    includeQuery = sanitizedColumns;
  }

  // Parse the exclude parameter
  let excludeQuery = '';
  if (exclude) {
    // Sanitize the column names
    const sanitizedColumns = exclude.split(',').map(mysql.escapeId).join(', ');
    excludeQuery = `EXCEPT SELECT ${sanitizedColumns} FROM ${table}`;
  }

  // Parse the order parameter
  let orderQuery = '';
  if (order) {
    // Sanitize the column name
    const [column, direction] = order.split(',');
    const sanitizedColumn = mysql.escapeId(column);
    orderQuery = `ORDER BY ${sanitizedColumn} ${direction.toUpperCase()}`;
  }

  // Parse the limit parameter
  let limitQuery = '';
  if (limit) {
    limitQuery = `LIMIT ${limit}`;
  }

  // Parse the page parameter
  let pageQuery = '';
  if (page && limit) {
    const offset = (page - 1) * limit;
    pageQuery = `OFFSET ${offset}`;
  }

  // Get all rows in the table, with the specified columns included and excluded, ordered and limited, and paginated
  connection.query(
    `SELECT ${includeQuery} FROM ${table} ${filterQuery} ${excludeQuery} ${orderQuery} ${limitQuery} ${pageQuery}`, filterValues,
    (error, results) => {
      if (error) {
        console.error(error);
        res.send({ error });
      } else {
        res.send(results);
      }
    }
  );
});

// Create a new row in a table
app.post('/api/:table', getColumns, (req, res) => {
  const { table } = req.params;
  const data = req.body;

  // Convert the data object to an array of keys and values
  const keys = Object.keys(data);
  const values = Object.values(data);

  // Sanitize the keys
  const sanitizedKeys = keys.map(mysql.escapeId).join(', ');
  // Placeholder values for the MySQL prepared statement
  const placeholders = keys.map(() => '?').join(', ');

  // Insert the new row
  connection.query(
    `INSERT INTO ${table} (${sanitizedKeys}) VALUES (${placeholders})`,
    values,
    (error, results) => {
      if (error) {
        console.error(error);
        res.send({ error });
      } else {
        res.send(results);
      }
    }
  );
});

// Update an existing row in a table
app.put('/api/:table/:id', getColumns, (req, res) => {
  const { table, id } = req.params;
  const data = req.body;

  // Convert the data object to an array of keys and values
  const keys = Object.keys(data);
  const values = Object.values(data);

  // Sanitize the keys
  const sanitizedKeys = keys.map((key) => mysql.escapeId(key) + ' = ?').join(', ');

  // Update the row
  connection.query(
    `UPDATE ${table} SET ${sanitizedKeys} WHERE id = ?`, [...values, id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.send({ error });
      } else {
        res.send(results);
      }
    }
  );
});

// Delete a row in a table
app.delete('/api/:table/:id', getColumns, (req, res) => {
  const { table, id } = req.params;

  // Delete the row
  connection.query(
    `DELETE FROM ${table} WHERE id = ?`,
    [id],
    (error, results) => {
      if (error) {
        console.error(error);
        res.send({ error });
      } else {
        res.send(results);
      }
    }
  );
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

