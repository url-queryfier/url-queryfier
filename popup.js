const stages = ['0', '1', '2', 'error', 'loading', 'page'];
let conn = {active: false, port: null};
let int_data = null;

let body = document.getElementsByTagName("body")[0];
window.addEventListener('DOMContentLoaded', sendInfo, false);

document.getElementById('execute-btn').addEventListener('click', (e) => {
  e.preventDefault();

  document.getElementById('execute-btn').disabled = true;
  let urls_raw = document.getElementById('stacked-urls').value;
  let splits = urls_raw.split('\n');
  let urls = [];
  for(let i = 0; i < splits.length; i++) {
    let split = splits[i].trim();
    if(split.length > 0)
      urls.push(split);
  }

  conn.port.postMessage({action: 'start', urls: urls});
});

document.getElementById('download-btn').addEventListener('click', (e) => {
  e.preventDefault();

  document.getElementById('download-btn').disabled = true;
  let int_arr = [];
  for(let i = 0; i < int_data.length; i++) {
    if(int_data[i].error) {
      document.getElementById('det-err').innerHTML = int_data[i].error;
      showStage('error');
    } else {
      int_arr.push({url: int_data[i].url, rank: int_data[i].stats.ahrefs_rank, rating: int_data[i].stats.domain_rating});
    }
  }

  let inp = '';
  let mime = null;

  if(document.getElementById('fmt-json').checked) {
    mime = 'application/json';
    inp = JSON.stringify(int_arr);
  } else if(document.getElementById('fmt-csv').checked) {
    mime = 'text/csv';
    for(let i = 0; i < int_arr.length; i++) {
      inp += `"${int_arr[i].url}","${int_arr[i].rank}","${int_arr[i].rating}"\n`;
    }
  } else if(document.getElementById('fmt-txt').checked) {
    mime = 'text/plain';
    for(let i = 0; i < int_arr.length; i++) {
      inp += `${int_arr[i].url};${JSON.stringify({stats: {ahrefs_rank: int_data[i].rank, domain_rating: int_data[i].rating}})}\n`;
    }
  }

  let blob = new Blob([inp], {type: mime});

  let url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url
  }, () => {
    conn.port.postMessage({action: 'reset'});
    window.location.href = 'popup.html';
  });
});

// Funcs

function showStage(num) {
  document.getElementById(`stage-${num}`).style.display = 'block';
}

function hideStage(num) {
  document.getElementById(`stage-${num}`).style.display = 'none';
}

function frontStage(num) {
  if(!stages.includes(num))
    throw `Invalid stage ${num}!`;

  for(let i = 0; i < stages.length; i++) {
    if(stages[i] == num) {
      showStage(stages[i]);
      continue;
    }

    hideStage(stages[i]);
  }
}

async function sendInfo() {
  let proceed = await establishConnection();
  if(!proceed) {
    frontStage('page');
    return;
  }

  conn.port.onMessage.addListener(function(msg) {
    console.log(msg);

    if(msg.errorObj || msg.errorMsg) {
      frontStage('error');
    } else if(msg.state == 0) {
      document.getElementById('download-btn').disabled = null;
      document.getElementById('execute-btn').disabled = null;
      frontStage('0');
    } else if(msg.state == 1) {
      document.getElementById('done').innerHTML = msg.done;
      document.getElementById('total').innerHTML = msg.total;
      frontStage('1');
    } else if(msg.state == 2) {
      int_data = msg.data;
      frontStage('2');
    }
  });

  setInterval(() => {
    conn.port.postMessage({action: 'info'});
  }, 500);
}

function establishConnection() {
  return new Promise((resolve, reject) => {
    if(conn.active) {
      reject();
    } else {
      conn.active = true;
      chrome.tabs.query({active: true, currentWindow: true}, (tabArr) => {
        let tab = tabArr[0];

        if(tab.url.includes('ahref')) {
          conn.port = chrome.tabs.connect(tab.id, {name: "ahrefs-query"});
          resolve(true);
        }
        else {
          conn.active = false;
          resolve(false);
        }
      });
    }
  });
}
