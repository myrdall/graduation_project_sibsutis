const counterElement = document.getElementById('counter');

let count = 0;

function updateCounter(){
    count++;
    counterElement.textContent = count;
    if (count >= 20) count = 0;
}

setInterval(updateCounter, 100);