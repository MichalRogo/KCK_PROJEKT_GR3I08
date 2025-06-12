const head = document.querySelector(".headerAnimation")

document.addEventListener('mousemove', (event) => {
    const mouseX = event.clientX;  
    const width = window.innerWidth;  
    const percentage = (mouseX / width) * 100;

    const red = Math.min(255, (percentage * 2.55));
    const blue = 255 - Math.min(255, (percentage * 2.55));

 
    head.style.color = `rgb(${red}, 0, ${blue})`;
});