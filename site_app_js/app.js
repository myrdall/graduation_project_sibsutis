const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const mysql2 = require('mysql2');
const bcrypt = require('bcryptjs');

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


const currentDate = new Date();
const startOfWeek = new Date(currentDate);
startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
// Позволяем приложению использовать body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware для сессий
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login');
});

// Обработка POST запроса на авторизацию
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Поиск пользователя в базе данных MySQL
  connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) {
      console.error('Error querying MySQL database', err);
      res.send('Error');
      return;
    }

    if (results.length > 0) {
      const user = results[0];
      if (bcrypt.compareSync(password, user.password)) {
        req.session.user = user;
        res.redirect('/admin');
      } else {
        res.send('Invalid username or password');
      }
    } else {
      res.send('User not found');
    }
  });
});

app.get('/services', (req, res) => {
  res.render('services');
});

app.get('/halls', (req, res) => {
  res.render('halls');
});

// POST-запрос для разрушения сессии (в файле app.js или в вашем маршрутизаторе)
app.post('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          console.error('Ошибка при разрушении сессии:', err);
          res.sendStatus(500);
      } else {
          res.redirect('/login'); // Перенаправление на страницу входа после выхода
      }
  });
});


app.get('/admin', (req, res) => {
  if (req.session.user) {
    const sql = `
      SELECT bookings.id AS booking_id, bookings.booking_date, bookings.start_time, bookings.end_time, 
             clients.full_name, clients.phone, clients.email, halls.room_number, bookings.price, bookings.comment
      FROM bookings
      INNER JOIN clients ON bookings.client_id = clients.id
      INNER JOIN halls ON bookings.room_id = halls.id
      WHERE bookings.booking_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
      ORDER BY halls.room_number, bookings.booking_date, bookings.start_time;
    `;

    connection.query(sql, (error, results) => {
      if (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).send('Internal Server Error');
        return;
      }

      // Группировка бронирований по залам
      const bookingsByHall = {};
      results.forEach(bookings => {
        if (!bookingsByHall[bookings.room_number]) {
          bookingsByHall[bookings.room_number] = [];
        }
        bookingsByHall[bookings.room_number].push(bookings);
      });

      res.render('admin', { bookingsByHall });
    });
  } else {
    res.redirect('/login');
  }
});






async function getAvailableTimeSlotsForDateAndRoom(date, roomId) {
  try {
    const connection = await pool.getConnection();
    const [bookedSlots] = await connection.query(
      'SELECT start_time, end_time FROM bookings WHERE room_id = ? AND booking_date = ?',
      [roomId, date]
    );
    //console.log("Booked Slots:", bookedSlots);
    const bookedHours = new Set();
    bookedSlots.forEach(({ start_time: startTime, end_time: endTime }) => {
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]) + 1;
      for (let hour = startHour; hour < endHour; hour++) {
        bookedHours.add(hour);
      }
    });
    connection.release();
    const availableSlots = [];
    for (let hour = 9; hour <= 22; hour++) {
      if (!bookedHours.has(hour)) {
        availableSlots.push(hour);
      }
    }
    return availableSlots;
  } catch (error) {
    console.error("Error retrieving available time slots:", error);
    return [];
  }
}

// Функция для формирования расписания для всех комнат на указанную дату
async function generateScheduleForDate(date, halls) {
  try {
    const schedule = [];
    const availableSlots = await getAvailableTimeSlotsForDateAndRoom(date, halls);
    console.log(availableSlots);
    schedule.push({ halls, availableSlots }); 
    return schedule;
  } catch (error) {
    console.error("Error generating schedule for date:", error);
    return [];
  }
}

async function generateScheduleForHall(startDate, endDate, roomId) {
  try {
    const scheduleForHall = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const scheduleForDate = await generateScheduleForDate(currentDate.toISOString().split('T')[0], roomId);
      scheduleForHall.push({ date: currentDate.toISOString().split('T')[0], scheduleForDate });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return scheduleForHall;
  } catch (error) {
    console.error("Error generating schedule for hall:", error);
    return [];
  }
}

// Функция для формирования расписания для конкретного зала на указанный период
app.get('/booking', async (req, res) => {
  try {
    const currentDateUTC = new Date();
    // Получаем смещение для Новосибирского времени (GMT+7)
    const offset = 7 * 60 * 60 * 1000; // 7 часов * 60 минут * 60 секунд * 1000 миллисекунд
    // Применяем смещение к текущей дате и времени UTC, чтобы получить Новосибирское время
    const currentDate = new Date(currentDateUTC.getTime() + offset);
    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(currentDate.getDate() + 13); // Конец недели
    const connection = await pool.getConnection();
    const [halls] = await connection.query('SELECT * FROM halls');
    connection.release();

    const schedule = [];
    for (const hall of halls) {
      //console.log("Result of query:", hall);
      const scheduleForHall = await generateScheduleForHall(currentDate, endOfWeek, hall.id);
      schedule.push({ hall, scheduleForHall });
    }
    //console.log(schedule);
    printObject(schedule);
    
    res.render('booking', { schedule });
  } catch (error) {
    console.error('Error fetching booking data:', error);
    res.status(500).send('Internal Server Error');
  }
});


//Отладочная функция для проверки структуры сгенерированного расписания
function printObject(obj, depth = 0) {
  for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
          console.log(`${' '.repeat(depth * 4)}${key}: `);
          printObject(value, depth + 1);
      } else {
          console.log(`${' '.repeat(depth * 4)}${key}: ${value}`);
      }
  }
}


// Обработка POST запроса для бронирования
app.post('/bookingcheck', async(req, res) => {
    const { roomNumber, bookingDate, startTime, endTime, fullName, phone, email, comment, price } = req.body;
    console.log(req.body);
    // Проверяем, существует ли пользователь в базе данных
    connection.query('SELECT id FROM clients WHERE full_name = ? AND email = ?', [fullName, email], (err, results) => {
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
              connection.query('INSERT INTO bookings (booking_date, start_time, end_time, client_id, room_id, comment, price) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [bookingDate, startTime, endTime, clientId, roomNumber, comment, price], (err, result) => {
                  if (err) throw err;
  
                  res.send('Бронирование успешно создано!');
                });
            }
          });
      }
    });
  });

app.get('/confirmation', (req, res) => {
    // Получение параметров из URL
    const {fullName, phone, email,  bookingDate, startTime, endTime, roomNumber, comment, price } = req.query;
    // Рендеринг страницы confirmation.ejs с передачей параметров
    res.render('confirmation', { fullName, phone, email, bookingDate, startTime, endTime, roomNumber, comment, price });
});

app.post('/delete-booking', (req, res) => {
  const bookingId = req.body.bookingId;

  const deleteQuery = "DELETE FROM bookings WHERE id = ?";
    
  connection.query(deleteQuery, [bookingId], (error, result) => {
        if (error) {
            console.error("Ошибка при удалении записи о бронировании:", error);
            res.status(500).json({ success: false, message: 'Произошла ошибка при удалении записи о бронировании.' });
        } else {
            if (result.affectedRows > 0) {
                res.json({ success: true, message: 'Запись о бронировании успешно удалена.' });
            } else {
                res.json({ success: false, message: 'Запись с указанным ID не найдена.' });
            }
        }
    });
});

app.use((req, res, next) => {
    res.status(404).render('oops');
});

app.listen(SRV_PORT, SRV_HOST, () => {
    console.log(`Server running at http://${SRV_HOST}:${SRV_PORT}/`);
});