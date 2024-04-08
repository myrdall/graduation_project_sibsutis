#все клавиатуры, используемые ботом#


from telegram import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton
from datetime import datetime, timedelta, time

def create_booking_keyboard():
    keyboard = [[InlineKeyboardButton("Начать бронирование", callback_data="booking")]]
    return InlineKeyboardMarkup(keyboard)

def create_back_cancel_keyboard():
    keyboard = [[InlineKeyboardButton("Назад", callback_data="back"), InlineKeyboardButton("Отмена", callback_data="cancel")]]
    return InlineKeyboardMarkup(keyboard)

def create_time_keyboard(slots):
    keyboard = []
    for hour in slots:
        formatted_time = f"{hour:02}:00" # Преобразуем целое число в строку времени 
        keyboard.append([InlineKeyboardButton(formatted_time, callback_data=str(hour))])
    return InlineKeyboardMarkup(keyboard)

def create_room_keyboard():
    keyboard = [
        [InlineKeyboardButton("Зал 1", callback_data="1")],
        [InlineKeyboardButton("Зал 2", callback_data="2")],
        [InlineKeyboardButton("Зал 3", callback_data="3")],
        # Добавьте кнопки для других залов, если необходимо
    ]
    return InlineKeyboardMarkup(keyboard)

def create_date_keyboard():
    today = datetime.now().date()
    keyboard = []
    for i in range(14):
        date = today + timedelta(days=i)
        keyboard.append([InlineKeyboardButton(date.strftime("%d-%m-%Y"), callback_data=date.strftime("%d:%m:%Y"))])
    return InlineKeyboardMarkup(keyboard)




