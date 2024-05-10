$(document).ready(function() {


    let selectedTimesByHall = {}; // Объект для хранения выбранных времен для каждого зала

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

        //const formattedDate = `${date.getFullYear()}-${(bookingData.bookingDate.getMonth() + 1).toString().padStart(2, '0')}-${bookingData.bookingDate.getDate().toString().padStart(2, '0')}`;

        // Обновляем bookingData с отформатированной датой
        $('#bookingForm').submit(function(event) {
          event.preventDefault(); // Предотвращаем отправку формы по умолчанию
    
          $.ajax({
            type: 'POST',
            url: '/bookingcheck',
            data: {
              roomNumber: hallId,
              bookingDate: formattedDate,
              startTime: time,
              endTime: selectedTimesByHall[hallId].endTime.time,
              fullName: $('#fullName').val(),
              phone: $('#phone').val(),
              email: $('#email').val()
          },
            success: function(response) {
              $('#responseDiv').html(response); // Выводим ответ от сервера в div
              setTimeout(function() {
                location.reload(); // Обновляем страницу через 2 секунды
              }, 2000);
            },
            error: function(xhr, status, error) {
              alert('Произошла ошибка: ' + error); // Показываем сообщение об ошибке
            }
          });
        });
        
    });


   

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
        let bookingInfo = 'Selected booking times:';
        for (const [hallId, times] of Object.entries(selectedTimesByHall)) {
            bookingInfo += ` Hall ${hallId}: ${times.startTime.date} ${times.startTime.time} - ${times.endTime.date} ${times.endTime.time};`;
        }
        $('#booking-info').text(bookingInfo);
    }

});






