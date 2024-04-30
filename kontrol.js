
    var exports = {};
    function getModeName(browserName) {
      switch (browserName) {
        case "Safari":
        case "Firefox":
        case "Brave":
        case "Opera":
          return "a Private Window";
          break;
        case "Chrome":
        case "Chromium":
          return "an Incognito Window";
          break;
        case "Internet Explorer":
        case "Edge":
          return "an InPrivate Window";
          break;
      }
      throw new Error("Could not get mode name");
    }
    
    // This function is called when the script is loaded
function detect() {
  var a = document.getElementById("answer");
  // We call the detectIncognito function and handle the promise
  detectIncognito().then(function(result) {
    if (result.isPrivate) { // If the result is private, redirect to the specified URL
      window.location.href = "https://www.foodbooking.com/api/fb/_q_y_w_r6";
    } else { // If the result is not private, keep the user on the same page without changing anything
      // a.innerHTML = ""; // You can keep this line if you want to clear any preset content or it can be removed if not needed
    }
  }).catch(function(error) { // If there is an error, we display a message to the user & log the error to console
   //a.innerHTML = "<b>There was an error.</b> Check console for further information. If the problem persists, please <a href='https://github.com/Joe12387/detectIncognito/issues'>report the issue</a> on GitHub.";
    console.error(error);
  });
}

    // To handle the CDN being blocked by adblockers, we load the script using createElement
    var script = document.createElement('script');

    // We then set the onload and onerror events to detect whether the script was loaded successfully
    script.onload = detect;

    // If the script fails to load, we display a message to the user
    script.onerror = function () {
      var a = document.getElementById("answer");
    //  a.innerHTML = "<b>The script failed to load from the CDN.</b> ";
      if (navigator.brave !== undefined) {
      //  a.innerHTML += "If you are using Brave, please turn off shields by clicking the Brave icon to the right of the location bar and try again.";
      } else {
      //  a.innerHTML += "If you are using an adblocker, please disable it and try again.";
      }
    //  a.innerHTML += " If the problem persists, please <a href='https://github.com/Joe12387/detectIncognito/issues'>report the issue</a> on GitHub.";
    };
    
    script.src = 'https://cdn.jsdelivr.net/gh/Joe12387/detectIncognito@main/dist/es5/detectIncognito.min.js';
    document.body.appendChild(script);
