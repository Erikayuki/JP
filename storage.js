function saveStatus(word,status){

let data =
JSON.parse(localStorage.getItem("jpStatus"))
|| {};


data[word]={
status:status,
date:new Date()
};


localStorage.setItem(
"jpStatus",
JSON.stringify(data)
);

}



function getStatus(word){

let data =
JSON.parse(localStorage.getItem("jpStatus"))
|| {};


return data[word];

}