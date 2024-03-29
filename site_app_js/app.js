const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const mysql2 = require('mysql2');

const { SRV_PORT, SRV_HOST, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME} = require('./config');

const app = express();

const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
});

const connection = mysql2.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
});

connection.connect((err) => {
    if (err) {
      console.error('Ошибка подключения к базе данных:', err.message);
    } else {
      console.log('Успешное подключение к базе данных');
    }
  });
  
  // Обработчик ошибок подключения
  connection.on('error', (err) => {
    console.error('Ошибка подключения к базе данных:', err.message);
  });


app.set('view engine', 'ejs');
app.use(express.static('public'));
// Позволяем приложению использовать body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/booking', async (req, res) => {
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const connection = await pool.getConnection();
    const [halls] = await connection.query('SELECT * FROM halls');

    const bookingsByHall = [];
    for (const hall of halls) {
        const [bookings] = await connection.query(
            'SELECT * FROM bookings WHERE booking_date >= ? AND booking_date <= ? AND room_id = ?', 
            [startOfWeek.toISOString().split('T')[0],
             endOfWeek.toISOString().split('T')[0],
             hall.id]
        );
        bookingsByHall.push({ hall, bookings });
    }

    connection.release();
    res.render('booking', { halls, bookingsByHall });
});


// Обработка POST запроса для бронирования
app.post('/bookingcheck', (req, res) => {
    const { roomNumber, bookingDate, startTime, endTime, fullName, phone, email } = req.body;
    console.log(req.body);


    



    // Проверяем, существует ли пользователь в базе данных
    connection.query('SELECT id FROM clients WHERE full_name = ?', [fullName], (err, results) => {
      if (err) throw err;
  
      let clientId;

      
  
      // Если пользователь не найден, добавляем его в базу данных
      if (results.length === 0) {
        console.log('Пользователя нет в БД. Добавляем нового')
        connection.query('INSERT INTO clients (full_name, phone, email) VALUES (?, ?, ?)', [fullName, phone, email], (err, result) => {
          if (err) throw err;
  
          clientId = result.insertId;

          console.log('Новый пользователь добавлен в БД', clientId);

          createBooking(clientId);
        });
      } else {
        clientId = results[0].id;
        console.log('Найден пользователь:',clientId);
        createBooking(clientId);
      }
  
      function createBooking(clientId) {
        // Проверяем пересечение времени бронирования
        connection.query('SELECT id FROM bookings WHERE room_id = ? AND booking_date = ? AND ((? BETWEEN start_time AND end_time) OR (? BETWEEN start_time AND end_time))',
          [roomNumber, bookingDate, startTime, endTime], (err, results) => {
            if (err) throw err;
  
            if (results.length > 0) {
              res.send('Выбранное время уже забронировано. Пожалуйста, выберите другое время.');
            } else {
              // Время свободно, создаем бронирование
              connection.query('INSERT INTO bookings (booking_date, start_time, end_time, client_id, room_id) VALUES (?, ?, ?, ?, ?)',
                [bookingDate, startTime, endTime, clientId, roomNumber], (err, result) => {
                  if (err) throw err;
  
                  res.send('Бронирование успешно создано!');
                });
            }
          });
      }
    });
  });




app.use((req, res, next) => {
    res.status(404).render('oops');
});

app.listen(SRV_PORT, SRV_HOST, () => {
    console.log(`Server running at http://${SRV_HOST}:${SRV_PORT}/`);
});