#основной файл, в котором будет содержать почти весь код бота. Будет состоять из функций-обработчиков с декораторами (фильтрами)#

from telegram.ext import CommandHandler, MessageHandler, Filters, ConversationHandler, CallbackQueryHandler
from telegram import Update
from mysql.connector import Error
from db import connect_to_database
import text
from datetime import datetime, timedelta

from kb import create_time_keyboard, create_room_keyboard, create_date_keyboard, create_booking_keyboard, create_back_cancel_keyboard

def start(update, context):
    context.bot.send_message(chat_id=update.effective_chat.id, text="Привет! Для начала работы введите ваше имя.")
    return "GET_NAME"

def get_name(update, context):
    name = update.message.text
    context.user_data['name'] = name
    context.bot.send_message(chat_id=update.effective_chat.id, text="Теперь введите ваш номер телефона.")
    return "GET_PHONE"

def get_phone(update, context):
    phone = update.message.text
    context.user_data['phone'] = phone
    context.bot.send_message(chat_id=update.effective_chat.id, text="Теперь введите ваш email.")
    return "GET_EMAIL"

def get_email(update, context):
    email = update.message.text
    # Проверяем пользователя в базе данных
    db = connect_to_database()
    db.connect_to_database()
    client_id = db.find_client(name=context.user_data['name'], phone=context.user_data['phone'], email=email)
    context.bot.send_message(chat_id=update.effective_chat.id, text="Добрый день! Можете начать бронировать залы!")
    db.close_connection() 
    if not client_id:
        db.connect_to_database()
        client_id = db.add_client(name=context.user_data['name'], 
        phone=context.user_data['phone'], email=email)
        db.close_connection() 
    context.user_data['client_id'] = client_id
    context.bot.send_message(chat_id=update.effective_chat.id, text="Вы успешно зарегистрированы.")
    return ConversationHandler.END

def get_upcoming_bookings(update, context):
    db = connect_to_database()  # Создаем объект базы данных
    db.connect_to_database()  # Устанавливаем соединение с базой данных
    user_id = context.user_data.get('client_id')  # Получаем ID пользователя из контекста
    if user_id:
        current_date = datetime.now().date()
        end_date = current_date + timedelta(days=14)
        upcoming_bookings = db.get_upcoming_bookings(user_id, current_date, end_date)
        if upcoming_bookings:
            message = "Ваши ближайшие бронирования:\n"
            for booking in upcoming_bookings:
                message += f"- {booking['booking_date']} {booking['start_time']} - {booking['end_time']}\n"
        else:
            message = "У вас нет ближайших бронирований."
        context.bot.send_message(chat_id=update.effective_chat.id, text=message)
    else:
        context.bot.send_message(chat_id=update.effective_chat.id, text="Пожалуйста, сначала зарегистрируйтесь в системе.")
    db.close_connection()  # Закрываем соединение с базой данных

SELECT_ROOM, SELECT_DATE, SELECT_START_TIME, SELECT_END_TIME = range(4)

def create_booking(update, context): 
    reply_markup = create_room_keyboard() # Создаем клавиатуру для выбора зала
    update.message.reply_text("Выберите зал:", reply_markup=reply_markup)
    return SELECT_ROOM

# Функция для обработки выбора зала
def select_room(update, context):
    room_id = update.callback_query.data
    context.user_data['room_id'] = room_id
    reply_markup = create_date_keyboard() # Создаем клавиатуру для выбора даты
    update.callback_query.message.reply_text("Выберите дату:", reply_markup=reply_markup)
    return SELECT_DATE

# Функция для обработки выбора даты
def select_date(update, context):
    selected_date = datetime.strptime(update.callback_query.data, "%d:%m:%Y").date()
    context.user_data['selected_date'] = selected_date
    room_id = context.user_data['room_id']
    db = connect_to_database()
    db.connect_to_database()
    available_slots = db.get_available_time_slots(room_id, selected_date)
    db.close_connection()
    reply_markup = create_time_keyboard(available_slots)
    update.callback_query.message.reply_text("Выберите время начала:", reply_markup=reply_markup)
    return SELECT_START_TIME

# Функция для обработки выбора времени начала
def select_start_time(update, context):
    start_time = datetime.strptime(update.callback_query.data, "%H").time()
    context.user_data['start_time'] = start_time
    selected_date = context.user_data['selected_date']
    room_id = context.user_data['room_id']
    db = connect_to_database()
    db.connect_to_database()
    available_slots = db.get_available_end_time_slots(room_id, selected_date, start_time)
    db.close_connection()
    reply_markup = create_time_keyboard(available_slots)
    update.callback_query.message.reply_text("Выберите время окончания:", reply_markup=reply_markup)
    return SELECT_END_TIME

# Функция для обработки выбора времени окончания и создания бронирования
def select_end_time(update, context):
    end_time = datetime.strptime(update.callback_query.data, "%H").time()
    selected_date = context.user_data['selected_date']
    start_time = context.user_data['start_time']
    room_id = context.user_data['room_id']
    client_id = context.user_data['client_id'] # ID пользователя, если он был определен ранеe

    try:
        db = connect_to_database()
        db.connect_to_database()
        # Добавляем бронирование в базу данных
        db.add_booking(selected_date, start_time, end_time, client_id, room_id)
        db.close_connection()

        # Отправляем пользователю подтверждение
        update.callback_query.message.reply_text(f"Бронирование создано на {selected_date} с {start_time.strftime('%H:%M')} до {end_time.strftime('%H:%M')}.")
        return ConversationHandler.END
    except Error as e:
        print(f"Error creating booking: {e}")
        update.callback_query.message.reply_text("Произошла ошибка при создании бронирования. Пожалуйста, попробуйте еще раз позже.")
        return ConversationHandler.END

def handle_text_message(update, context):
    # Отправить стандартное сообщение в ответ на текстовое сообщение
    update.message.reply_text("Извините, я не могу обработать ваш запрос. Пожалуйста, используйте доступные команды.") 

def setup_handlers(updater, db):
    dp = updater.dispatcher
    dp.add_handler(CommandHandler("my_bookings", get_upcoming_bookings))
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            "GET_NAME": [MessageHandler(Filters.text & ~Filters.command, get_name)],
            "GET_PHONE": [MessageHandler(Filters.text & ~Filters.command, get_phone)],
            "GET_EMAIL": [MessageHandler(Filters.text & ~Filters.command, get_email)]
        },
        fallbacks=[],
    )

    booking_handler = ConversationHandler(
        entry_points = [CommandHandler("booking", create_booking)],
        states={
            SELECT_ROOM: [CallbackQueryHandler(select_room)],
            SELECT_DATE: [CallbackQueryHandler(select_date)],
            SELECT_START_TIME:[CallbackQueryHandler(select_start_time)],
            SELECT_END_TIME:[CallbackQueryHandler(select_end_time)]
        },
        fallbacks=[],
    )

    dp.add_handler(conv_handler)
    dp.add_handler(booking_handler)
    text_handler = MessageHandler(Filters.text & ~Filters.command, handle_text_message)
    dp.add_handler(text_handler)



   




                   









