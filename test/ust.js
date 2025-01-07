window.addEventListener("load", function () {
    // DOM tamamen yüklendiğinde çalıştır
    let text = "HELLO ust.js çalıştı!";
    var element = document.getElementById("ust");
    if (element) {
        element.innerHTML = text;
    } else {
        console.error('Element id="ust" bulunamadı.');
    }
});
