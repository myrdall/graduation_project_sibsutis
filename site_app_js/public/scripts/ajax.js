$(document).ready(function() {
    $('#bookingForm').submit(function(event) {
      event.preventDefault(); // Предотвращаем отправку формы по умолчанию

      $.ajax({
        type: 'POST',
        url: '/bookingcheck',
        data: $(this).serialize(),
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




