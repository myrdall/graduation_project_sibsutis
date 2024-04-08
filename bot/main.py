from telegram.ext import Updater,CommandHandler
from handlers import setup_handlers, start


# Подключение к базе данных
from db import connect_to_database

# Загрузка токена бота
from config import BOT_TOKEN

def main():
    # Инициализация бота
    updater = Updater(BOT_TOKEN, use_context=True)

    # Подключение к базе данных
    
    db = connect_to_database()
    

    # Инициализация обработчиков
    setup_handlers(updater, db)

    # Запуск бота
    updater.start_polling()
    updater.idle()

if __name__ == "__main__":
    main()
