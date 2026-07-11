let cards=[];
let current=null;


const SHEET_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vTKxORwJLSfQk4dCktLQUblnAab4sV-Wh0tpLfcm4Ly5eE9dJiUSJwhOLWX_qyW2StsqdiSqfhe10-T/pub?gid=0&single=true&output=csv";

let currentIndex = 0;


fetch(SHEET_URL)
.then(res=>res.json())
.then(data=>{

cards=data;

showCard();

});

let progress =
JSON.parse(localStorage.getItem("progress"))
|| {};




// โหลด Google Sheet

async function loadCards(){


const res =
await fetch(SHEET_URL);


const csv =
await res.text();


cards =
Papa.parse(csv,{
header:true,
skipEmptyLines:true
}).data;



selectCard();


}



// เลือกเฉพาะคำถึงเวลาทบทวน

function selectCard(){


let today =
new Date()
.toISOString()
.slice(0,10);



let dueCards =
cards.filter(card=>{


let data =
progress[card.ID];



if(!data){

return true;

}


return data.nextReview <= today;



});



if(dueCards.length===0){


document.getElementById("word")
.innerText =
"ไม่มีคำต้องทบทวน 🎉";


return;

}



current =
dueCards[
Math.floor(
Math.random()*dueCards.length
)
];



showCard();


}



// แสดงหน้าแรก

function showCard(){


word.innerText =
current.Front;


answer.innerText="";


}


function playCurrent(){

    speakJapanese(current.Front);

}



function showAnswer(){


let image = "";

if(current.IMAGE_WEB_URL){

    image =
    `
    <img 
    src="${current.IMAGE_WEB_URL}"
    class="card-image"
    >
    `;

}

let audio = "";

if(current.Front){

audio =
`
<button 
class="sound-btn"
onclick="playCurrent()">

🔊

</button>
`;

}
answer.innerHTML =

`

${image}


<div class="audio-box">

${audio}

</div>


<div class="back">

${current.Back}

</div>


<div class="example">

<strong>ตัวอย่าง:</strong>

<br>

${current.EXAMPLE || "-"}

</div>


<div class="level">

JLPT:
${current.JLPT_LEVEL}

</div>

`;

}


// จำได้ / จำไม่ได้

function review(correct){


let id =
current.ID;



let old =
progress[id]
||
{

count:0,
interval:1

};



old.count++;



if(correct){


old.interval =
Math.min(
old.interval*2,
60
);


}
else{


old.interval=1;


}



let next =
new Date();


next.setDate(
next.getDate()+old.interval
);



old.nextReview =
next.toISOString()
.slice(0,10);



progress[id]=old;



localStorage.setItem(
"progress",
JSON.stringify(progress)
);



selectCard();


}


function speakJapanese(text){

    let speech =
    new SpeechSynthesisUtterance(text);

    speech.lang="ja-JP";

    speech.rate=0.8;

    speech.pitch=1;

    speechSynthesis.cancel();

    speechSynthesis.speak(speech);

}



loadCards();
