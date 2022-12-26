const request = require('supertest');
const app = require('../index');
const mysql = require('mysql2/promise');

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;

describe('API routes', () => {
  let connection;

  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
    });
  });

  afterAll(async () => {
    await connection.end();
  });

  describe('GET /api/:table', () => {
    it('should return a list of rows from the specified table', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer <TOKEN>')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            email: expect.any(String),
          }),
        ])
      );
    });

    it('should return a 400 Bad Request error if the table does not exist', async () => {
      await request(app)
        .get('/api/invalid')
        .set('Authorization', 'Bearer <TOKEN>')
        .expect(400);
    });
  });

  describe('GET /api/:table/:id', () => {
    it('should return a single row from the specified table with the specified ID', async () => {
      const [users] = await connection.execute('SELECT * FROM users LIMIT 1');
      const [user] = users;

      const res = await request(app)
        .get(`/api/users/${user.id}`)
        .set('Authorization', 'Bearer <TOKEN>')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({
          id: user.id,
          name: expect.any(String),
          email: expect.any(String),
        })
      );
    });

    it('should return a 404 Not Found error if the ID does not exist', async () => {
      await request(app)
        .get('/api/users/9999999')
        .set('Authorization', 'Bearer <TOKEN>')
        .expect(404);
    });
  });

  describe('POST /api/:table', () => {
    it('should insert a new row into the specified table', async () => {
      const data = {
        name: 'John Doe',
        email: 'john.doe@example.com',
      };

      const res = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer <TOKEN>')
      .send(data)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: data.name,
        email: data.email,
      })
    );

    const [rows] = await connection.execute('SELECT * FROM users WHERE name = ? AND email = ?', [
      data.name,
      data.email,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: res.body.id,
        name: data.name,
        email: data.email,
      })
    );
  });
});

describe('PUT /api/:table/:id', () => {
  it('should update an existing row in the specified table', async () => {
    const [users] = await connection.execute('SELECT * FROM users LIMIT 1');
    const [user] = users;

    const data = {
      name: 'John Smith',
      email: 'john.smith@example.com',
    };

    const res = await request(app)
      .put(`/api/users/${user.id}`)
      .set('Authorization', 'Bearer <TOKEN>')
      .send(data)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        id: user.id,
        name: data.name,
        email: data.email,
      })
    );

    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: user.id,
        name: data.name,
        email: data.email,
      })
    );
  });

  it('should return a 404 Not Found error if the ID does not exist', async () => {
    await request(app)
      .put('/api/users/9999999')
      .set('Authorization', 'Bearer <TOKEN>')
      .send({ name: 'John Smith', email: 'john.smith@example.com' })
      .expect(404);
  });
});

describe('DELETE /api/:table/:id', () => {
  it('should delete a row from the specified table with the specified ID', async () => {
    const [users] = await connection.execute('SELECT * FROM users LIMIT 1');
    const [user] = users;

    await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', 'Bearer <TOKEN>')
      .expect(200);

    const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [user.id]);
    expect(rows).toHaveLength(0);
  });

  it('should return a 404 Not Found error if the ID does not exist', async () => {
    await request(app)
      .delete('/api/users/9999999')
      .set('Authorization', 'Bearer <TOKEN>')
      .expect(404);
  });
});

describe('POST /api/tokens', () => {
  it('should create a new token with the specified permissions', async () => {
    const data = {
      table: 'users',
      read: true,
      write: true,
    };

    const res = await request(app)
      .post('/api/tokens')
      .send(data)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(res.body).toEqual(expect.objectContaining({ token: expect.any(String) }));
  });
});

describe('DELETE /api/tokens/:token', () => {
  it('should delete an existing token', async () => {
    const [tokens] = await connection.execute('SELECT * FROM tokens LIMIT 1');
    const [token] = tokens;

    await request(app)
      .delete(`/api/tokens/${token.token}`)
      .expect(200);

    const [rows] = await connection.execute('SELECT * FROM tokens WHERE token = ?', [token.token]);
    expect(rows).toHaveLength(0);
  });

  it('should return a 404 Not Found error if the token does not exist', async () => {
    await request(app)
      .delete('/api/tokens/invalid')
      .expect(404);
  });
});
});


