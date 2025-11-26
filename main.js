// SAYFA TAM YÜKLENDİĞİNDE
document.addEventListener("DOMContentLoaded", () => {

    function modifyFoodbooking() {
        const iframe = document.getElementById("fbframe");
        const doc = iframe.contentDocument;

        if (!doc) {
            return setTimeout(modifyFoodbooking, 300);
        }

        // ÖRNEK: Başlığı değiştir
        const title = doc.querySelector("h1.fb-header-name-container");
        if (title) {
            title.textContent = "MAYMUN";
        }

        // ÖRNEK: Menü resmini kaldır
        const pic = doc.querySelector(".menu-picture");
        if (pic) pic.remove();

        console.log("DEĞİŞİKLİKLER UYGULANDI");
    }

    modifyFoodbooking();
});
