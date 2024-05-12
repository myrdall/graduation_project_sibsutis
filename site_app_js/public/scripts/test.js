$(document).ready(function(){
    $(".owl-carousel").owlCarousel({
        loop:true,
        margin:50,
        nav:false,
        autoplay:true,
        autoplayTimeout:2000,
        responsiveClass:true,
        autoplayHoverPause:false,
        responsive:{
            0:{
                items:1,
                nav:false
            },
            600:{
                items:3,
                nav:false
            },
            1000:{
                items:5,
                nav:false,
                loop:true
            }
        }
    }       
    );
 });

 document.addEventListener('DOMContentLoaded', function() {
    let links = document.querySelectorAll('a[href^="#"]');

    links.forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();

            let targetId = this.getAttribute('href').substring(1);
            let targetElement = document.getElementById(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});


document.addEventListener('DOMContentLoaded', function() {
    let scrollToTopBtn = document.querySelector("#scrollToTopBtn");

    // Показываем кнопку при пролистывании вниз
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            scrollToTopBtn.style.display = "block";
        } else {
            scrollToTopBtn.style.display = "none";
        }
    });

    // Прокручиваем страницу к началу при клике на кнопку
    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
});
