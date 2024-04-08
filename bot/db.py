#функции подключения и работы с базой данных. Данный файл будет являться абстракцией базы данных от основного кода#

import mysql.connector
from mysql.connector import Error
from config import DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE
from datetime import datetime, timedelta, time


class Database:
    def __init__(self, host, user, password, database):
        self.host = host
        self.user = user
        self.password = password
        self.database = database
        self.connection = None
        self.cursor = None
    
    def connect_to_database(self):
        try:
            self.connection = mysql.connector.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                database=self.database
            )
            if self.connection.is_connected():
                print("Connected to MySQL database")
                self.cursor = self.connection.cursor()
        except Error as e:
            print(f"Error while connecting to MySQL: {e}")

    
    def execute_query(self, query):
        cursor = self.connection.cursor()
        try:
            cursor.execute(query)
            self.connection.commit()
            print("Query executed successfully")
        except Error as e:
            print(f"Error executing query: {e}")

    def close_connection(self):
        if self.connection.is_connected():
            self.connection.close()
            print("Connection closed")

    def find_client(self, name, phone, email):
        try:
            query = "SELECT id FROM clients WHERE full_name = %s AND phone = %s AND email = %s"
            self.cursor.execute(query, (name, phone, email))
            result = self.cursor.fetchone()
            if result:
                return result[0] # Возвращает ID клиента
            else:
                return None
        except Error as e:
            print(f"Error searching for client in database: {e}")
            return None
    
    def add_client(self, name, phone, email):
        try:
            query = "INSERT INTO clients (full_name, phone, email) VALUES (%s, %s, %s)"
            self.cursor.execute(query, (name, phone, email))
            self.connection.commit()
            return self.cursor.lastrowid # Возвращает ID нового клиент
        except Error as e:
            print(f"Error adding client to database: {e}")
            return None
        
    def get_upcoming_bookings(self, user_id, start_date, end_date):
        try:
            query = """
                SELECT 
                    bookings.booking_date, 
                    bookings.start_time, 
                    bookings.end_time, 
                    halls.room_number
                FROM 
                    bookings 
                INNER JOIN 
                    halls 
                ON 
                    bookings.room_id = halls.id 
                WHERE 
                    bookings.client_id = %s 
                    AND bookings.booking_date BETWEEN %s AND %s 
                ORDER BY 
                    bookings.booking_date ASC
            """
            self.cursor.execute(query, (user_id, start_date, end_date))
            result = self.cursor.fetchall()
            bookings = []
            for row in result:
                booking_date = row[0].strftime("%d:%m:%Y")  # Форматируем дату
                start_time = (datetime.min + row[1]).strftime("%H:%M")  # Форматируем время начала
                end_time = (datetime.min + row[2]).strftime("%H:%M")  # Форматируем время окончания
                room_number = row[3]  # Получаем номер зала
                bookings.append({
                    'booking_date': booking_date,
                    'start_time': start_time,
                    'end_time': end_time,
                    'room_number': room_number  # Добавляем информацию о номере зала в результат
                })
            return bookings
        except Error as e:
            print(f"Error getting upcoming bookings: {e}")
            return []

    
    def timedelta_to_datetime(selected_date, time_delta):
        return datetime.combine(selected_date, datetime.min.time()) + time_delta
    

    def get_available_end_time_slots(self, room_id, selected_date, start_time):

        try:
            db = connect_to_database()
            db.connect_to_database()
            query = "SELECT start_time, end_time FROM bookings WHERE room_id = %s AND booking_date = %s"
            db.cursor.execute(query, (room_id, selected_date))
            booked_intervals = db.cursor.fetchall()

            # Формируем список доступных времен окончания
            available_end_times = []
            for interval_start, interval_end in booked_intervals:
                start_datetime = datetime.combine(selected_date, start_time)
                interval_start_datetime = Database.timedelta_to_datetime(selected_date, interval_start) # Конвертируем interval_start в datetime
                interval_end_datetime =  Database.timedelta_to_datetime(selected_date, interval_end)
                if interval_end_datetime <= start_datetime:
                    continue
                if interval_start_datetime >= start_datetime + timedelta(hours=1):
                    available_end_time = (start_datetime + timedelta(hours=1)).strftime("%H:%M")
                    print(f"Available end time: {available_end_time}")
                    available_end_times.append(available_end_time)
                else:
                    available_end_time = interval_start_datetime.strftime("%H:%M")
                    print(f"Available end time: {available_end_time}")
                    available_end_times.append(available_end_time)
            return available_end_times
        except Error as e:
            print(f"Error retrieving available end time slots: {e}")
            return []
    
    def get_available_time_slots(self, room_id, selected_date):
        try:
            db = connect_to_database()
            db.connect_to_database()
            query = "SELECT start_time, end_time FROM bookings WHERE room_id = %s AND booking_date = %s"
            db.cursor.execute(query, (room_id, selected_date))
            booked_slots = []

            for (start_time, end_time) in db.cursor.fetchall():
                # Преобразуем timedelta в часы и минуты
                start_hour = start_time.total_seconds() // 3600
                end_hour = end_time.total_seconds() // 3600
                # Добавляем забронированные слоты в список
                booked_slots.extend(range(int(start_hour), int(end_hour) + 1))
            # Формируем список доступных слотов, исключая забронированные
            available_slots = [hour for hour in range(9, 24) if hour not in booked_slots]
            return available_slots
        except Error as e:
            print(f"Error retrieving available time slots: {e}")
            return []
    
    def is_time_slot_available(self, room_id, selected_date, start_time, end_time):
        try:
            query = "SELECT * FROM bookings WHERE room_id = %s AND booking_date = %s AND ((start_time BETWEEN %s AND %s) OR (end_time BETWEEN %s AND %s))"
            self.cursor.execute(query, (room_id, selected_date, start_time, end_time, start_time, end_time))
            return not self.cursor.fetchall()
        except Error as e:
            print(f"Error checking time slot availability: {e}")
            return False
    
    def add_booking(self, booking_date, start_time, end_time, client_id, room_id):
        try:
            query = "INSERT INTO bookings (booking_date, start_time, end_time, client_id, room_id) VALUES (%s, %s, %s, %s, %s)"
            values = (booking_date, start_time, end_time, client_id, room_id)
            self.cursor.execute(query, values)
            self.connection.commit()
            print("Booking added successfully")
        except Error as e:
            print(f"Error adding booking to database: {e}") 

def connect_to_database():
    return Database(DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE)





        
        




        












 























        







