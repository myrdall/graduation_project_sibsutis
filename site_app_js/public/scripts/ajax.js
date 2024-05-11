$(document).ready(function() {


    let selectedTimesByHall = {}; // Объект для хранения выбранных времен для каждого зала
    let totalCost = 0;

    $('#schedule-tables').on('click', 'td.available', function() {
        const colIndex = $(this).index(); // Получаем индекс столбца, в котором произошел клик
        const date = $('#schedule-tables thead th').eq(colIndex).text(); // Получаем дату из заголовка столбца
        const time = $(this).closest('tbody').find('tr').eq($(this).closest('tr').index()).find('td').eq(0).text(); // Получаем время из первой ячейки строки
        const hallId = $(this).closest('.schedule-table').attr('id').split('-')[2]; // Получаем номер зала из id расписания

        const dateParts = date.split('.'); // Разбиваем строку на части, используя точку в качестве разделителя
        const formattedDate = `20${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
          // Пока что временно устанавливаем время окончания как время начала
        
        // Проверяем, выбрано ли уже время начала для данного зала
        if (!selectedTimesByHall.hasOwnProperty(hallId)) {
            selectedTimesByHall[hallId] = { startTime: { date, time }, endTime: { date, time } };
        } else {
            const selectedStartTime = selectedTimesByHall[hallId].startTime;
            const selectedEndTime = selectedTimesByHall[hallId].endTime;

            // Проверяем, является ли выбранное время окончания раньше времени начала или находится в другом дне
            if (compareTimes(selectedStartTime.time, time) > 0 || selectedStartTime.date !== date) {
                // Если время окончания раньше времени начала или находится в другом дне, сбрасываем выбранные значения
                selectedTimesByHall[hallId].startTime = { date, time };
                selectedTimesByHall[hallId].endTime = { date, time };
            } else {
                selectedTimesByHall[hallId].endTime = { date, time };
            }
        }

        

        // Обновляем выбранные ячейки и информацию о бронировании
        updateSelectedCells();
        updateBookingTimeInfo(selectedTimesByHall);
        calculateTotalCost(selectedTimesByHall);

        //const formattedDate = `${date.getFullYear()}-${(bookingData.bookingDate.getMonth() + 1).toString().padStart(2, '0')}-${bookingData.bookingDate.getDate().toString().padStart(2, '0')}`;

        // Обновляем bookingData с отформатированной датой
        $('#bookingForm').submit(function(event) {
            event.preventDefault(); // Предотвращаем отправку формы по умолчанию
            const totalCost = calculateTotalCost(selectedTimesByHall);
            console.log(totalCost);
        
            // Формируем объект с данными для передачи
            const formData = {
                roomNumber: hallId,
                bookingDate: formattedDate,
                startTime: time,
                endTime: selectedTimesByHall[hallId].endTime.time,
                fullName: $('#fullName').val(),
                phone: $('#phone').val(),
                email: $('#email').val(),
                comment: $('#comment').val(),
                price: totalCost
            };
        
            // Преобразуем объект в строку запроса
            const params = new URLSearchParams(formData).toString();
                
            // Формируем URL для перехода
            const redirectUrl = `/confirmation?${params}`;
        
            // Отправка данных формы на сервер
            $.ajax({
                type: 'POST',
                url: '/bookingcheck',
                data: formData,
                success: function(response) {
                    // После успешного бронирования открываем новую вкладку с подтверждением
                    window.open(redirectUrl, '_blank');
        
                    // Обновляем содержимое div с ответом от сервера
                    $('#responseDiv').html(response);
                    
                    // Перезагружаем текущую страницу через 2 секунды
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                },
                error: function(xhr, status, error) {
                    alert('Произошла ошибка: ' + error); // Показываем сообщение об ошибке
                }
            });
        });
        
    });

const pricesPerHour = {
        '1': 1500, // Стоимость для первого зала
        '2': 1300, // Стоимость для второго зала
        '3': 1700  // Стоимость для третьего зала
    };

    
    function calculateTotalCost(selectedTimesByHall) {
        let totalCost = 0;
    
        // Проход по каждому залу
        for (const hallId in selectedTimesByHall) {
            const selectedTimes = selectedTimesByHall[hallId];
            totalCost = pricesPerHour[hallId]
            // Получаем время начала и время окончания для текущего зала
            const startTime = selectedTimes.startTime;
            const endTime = selectedTimes.endTime;
    
            // Проверяем, что время начала и время окончания определены
            if (startTime && endTime) {
                // Разбиваем время начала и время окончания на часы и минуты
                const [startHour, startMinute] = startTime.time.split(':').map(Number);
                const [endHour, endMinute] = endTime.time.split(':').map(Number);
    
                // Вычисляем разницу в часах между временем окончания и временем начала
                const hoursDiff = endHour - startHour;
    
                // Учитываем минуты, если они есть
                if (endMinute > startMinute) {
                    hoursDiff++;
                }
    
                // Расчет стоимости аренды для текущего зала
                const pricePerHour = pricesPerHour[hallId];
                const hallTotalCost = pricePerHour * hoursDiff;
    
                // Суммирование стоимости для текущего зала
                totalCost += hallTotalCost;
            }
        }
    
        console.log(totalCost);
        return totalCost;
    }
    
    // Функция сравнения времени
    function compareTimes(time1, time2) {
        const [hours1, minutes1] = time1.split(':').map(Number);
        const [hours2, minutes2] = time2.split(':').map(Number);
        if (hours1 === hours2) {
            return minutes1 - minutes2;
        } else {
            return hours1 - hours2;
        }
    }


// Функция для обновления выделенных ячеек
function updateSelectedCells() {
  $('td').removeClass('selected-hall-1 selected-hall-2 selected-hall-3'); // Удаляем классы выбранных ячеек всех залов

  // Проходим по всем залам и добавляем классы выбранным ячейкам для каждого зала
  for (const [hallId, times] of Object.entries(selectedTimesByHall)) {
      $(`#schedule-table-${hallId} td.available`).each(function() {
          const colIndex = $(this).index();
          const dateCell = $('#schedule-tables thead th').eq(colIndex);
          const date = dateCell.text(); // Получаем дату из заголовка столбца

          // Проверяем, соответствует ли текущая ячейка дате выбора и относится ли она к текущему залу
          if (times.startTime && times.endTime && date === times.startTime.date) {
              const time = $(this).closest('tbody').find('tr').eq($(this).closest('tr').index()).find('td').eq(0).text(); // Получаем время из первой ячейки строки

              // Проверяем, что текущее время входит в выбранный интервал
              if (compareTimes(time, times.startTime.time) >= 0 && compareTimes(time, times.endTime.time) <= 0) {
                  $(this).addClass(`selected-hall-${hallId}`);
              }
          }
      });
  }
}

    // Обновление информации о бронировании
    function updateBookingTimeInfo(selectedTimesByHall) {
        let bookingInfo = 'Выбранное время бронирования:';
        for (const [hallId, times] of Object.entries(selectedTimesByHall)) {
            bookingInfo += ` Зал ${hallId}: ${times.startTime.date} ${times.startTime.time} - ${times.endTime.date} ${times.endTime.time};`;

        }
        $('#booking-info').text(bookingInfo);
        let totalCost = calculateTotalCost(selectedTimesByHall);
        if (typeof totalCost === 'number' && !isNaN(totalCost)) {
            // Преобразуем totalCost в число
            totalCost = parseFloat(totalCost);
    
            // Обновляем текстовое содержимое элемента #totalCost
            $('#totalCost').text(totalCost.toFixed(2));
        } else {
            console.error('Ошибка: totalCost не является числом');
        }
    }

});

$(document).ready(function() {
    $('#payment').click(function(event) {
        event.preventDefault(); 

        $.ajax({
            type: 'POST',
            url: '/#', // Замените на URL, который обрабатывает оплату
            data: {
                
            },
            success: function(response) {
                // Вывод сообщения о успешной оплате в div
                $('#responseDiv').text('Оплата прошла успешно!');

                // Через 5 секунд очищаем сообщение об успешной оплате
                setTimeout(function() {
                    $('#responseDiv').text('');
                }, 5000);
            },
            error: function(xhr, status, error) {
                // Вывод сообщения об ошибке, если что-то пошло не так
                $('#responseDiv').text('Произошла ошибка при обработке оплаты.');
            }
        });
    });
});