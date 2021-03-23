let state = 0; // 0 = Initial, 1 = Running, 2 = Completed, -1 = Error
let urls = [];
let results = [];
let errorObj = null;
let errorMsg = null;

chrome.runtime.onConnect.addListener(function(port) {
  console.assert(port.name == "ahrefs-query");
  port.onMessage.addListener(function(msg) {
    if(msg.action === "info") {
      let obj = {state: state, done: results.length, total: urls.length, errorObj: errorObj, errorMsg: errorMsg};

      if(state == 2)
        obj.data = results;

      port.postMessage(obj);
    }

    if(state != 1) {
      if(msg.action === "reset") {
        state = 0;
        urls = [];
        results = [];
        errorObj = null;
        errorMsg = null;

      } else if(msg.action === "start") {
        if(state != 1) {
          state = 1;
          urls = msg.urls;
          results = [];

          // Actually start
          asyncRunner().then(() => {
            state = 2;
          }).catch((e) => {
            state = -1;
            errorObj = e;
            errorMsg = `${e}`;
          });
        }
      }
    }

    console.log(msg);
  });
});

async function asyncRunner() {
  for(let i = 0; i < urls.length; i++) {
    let r = await checkoutUrl(urls[i]);
    let obj = JSON.parse(r);
    obj.url = urls[i];

    results.push(obj);
    await sleep(1000);
  }
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

function checkoutUrl(url) {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    // we defined the xhr

    xhr.onreadystatechange = function () {
        if (this.readyState != 4) return;

        if (this.status == 200) {
          resolve(this.responseText);
        } else {
          reject(this.responseText);
        }

        // end of state change: it can be after some time (async)
    };

    xhr.open('GET', `https://ahrefs.com/api/v3/toolbar/icon?target=${url}`, true);
    xhr.send();
  });
}
