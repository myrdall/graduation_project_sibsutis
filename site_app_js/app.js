const express = require('express');
const path = require('path');
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


const currentDate = new Date();
const startOfWeek = new Date(currentDate);
startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
const endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);


app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
// Позволяем приложению использовать body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index');
});


async function getAvailableTimeSlotsForDateAndRoom(date, roomId) {
  try {
    const connection = await pool.getConnection();
    const [bookedSlots] = await connection.query(
      'SELECT start_time, end_time FROM bookings WHERE room_id = ? AND booking_date = ?',
      [roomId, date]
    );
    //console.log("Booked Slots:", bookedSlots); // Выводим результаты запроса в консоль для отслеживания
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
    //console.log("Date:", date); // Выводим переданную дату в консоль для отслеживания
    //console.log("Halls:", halls); 
    //console.log("Type of halls:", typeof halls); // Выводим тип halls для проверки
    //console.log("Result of query:", halls); // Выводим результат запроса для проверки структуры
    const schedule = [];
   
    const availableSlots = await getAvailableTimeSlotsForDateAndRoom(date, halls);
    //console.log("Available Slots for Hall", halls, ":", availableSlots); // Выводим доступные слоты для каждого зала в консоль
    schedule.push({ halls, availableSlots });
    //console.log("sdasdad", schedule)
    
    return schedule;
  } catch (error) {
    console.error("Error generating schedule for date:", error);
    return [];
  }
}

async function generateScheduleForHall(startDate, endDate, roomId) {
  try {
    //console.log("Room ID:", roomId);
    //console.log("Start Date:", startDate.toISOString().split('T')[0]); // Добавлено для отслеживания начальной даты
    //console.log("End Date:", endDate.toISOString().split('T')[0]); // Добавлено для отслеживания конечной даты
    const scheduleForHall = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      //console.log("Current Date:", currentDate.toISOString().split('T')[0]); // Добавлено для отслеживания текущей даты
      const scheduleForDate = await generateScheduleForDate(currentDate.toISOString().split('T')[0], roomId);
      scheduleForHall.push({ date: currentDate.toISOString().split('T')[0], scheduleForDate });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    //console.log("haaas", scheduleForHall)

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
    //const currentDate = new Date();
    
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
    //console.log("Shasdsad", schedule[2])
    
    //printObject(schedule);

    
    
    res.render('booking', { schedule });
  } catch (error) {
    console.error('Error fetching booking data:', error);
    res.status(500).send('Internal Server Error');
  }
});

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




app.use((req, res, next) => {
    res.status(404).render('oops');
});

app.listen(SRV_PORT, SRV_HOST, () => {
    console.log(`Server running at http://${SRV_HOST}:${SRV_PORT}/`);
});