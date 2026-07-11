let cards=[];


const SHEET_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vTKxORwJLSfQk4dCktLQUblnAab4sV-Wh0tpLfcm4Ly5eE9dJiUSJwhOLWX_qyW2StsqdiSqfhe10-T/pub?gid=0&single=true&output=csv";



async function load(){


let res =
await fetch(SHEET_URL);


let csv =
await res.text();



cards =
Papa.parse(csv,{
header:true,
skipEmptyLines:true
}).data;



display(cards);


}





function display(data){


list.innerHTML="";



data.forEach(card=>{


let div =
document.createElement("div");


div.className="dictionary-card";


div.onclick=function(){

if(window.innerWidth <= 600){

    localStorage.setItem(
        "selectedCard",
        JSON.stringify(card)
    );


    window.location.href="detail.html";


}
else{

    showDetail(card);

}

};



div.innerHTML=

`

<h2>${card.Front}</h2>


<p class="reading">

${card.READING || ""}

</p>


<p>

${card.Back.substring(0,80)}

...

</p>


<span>

${card.JLPT_LEVEL}

</span>


`;



list.appendChild(div);


});


}


function showDetail(card){


let image="";


if(card.IMAGE_WEB_URL){

image =
`

<img 
src="${card.IMAGE_WEB_URL}"
class="word-image"
>

`;

}



let audio="";


if(card.AUDIO_WEB_URL){

audio =

`
<button 
class="sound-btn"
onclick="speakJapanese('${card.Front}')">

🔊

</button>

</audio>

`;

}



detail.innerHTML =

`

<div class="detail-card">


<h1>${card.Front}</h1>


<p class="reading">
${card.READING || ""}
</p>


${image}


${audio}


<div class="back">

${card.Back}

</div>


<p class="example">

ตัวอย่าง:

<br>

${card.EXAMPLE || ""}

</p>


<p>

JLPT:
${card.JLPT_LEVEL}

</p>


</div>

`;

}





function searchCard(){


let text =
search.value.toLowerCase();



let level =
document.getElementById("level").value;



display(

cards.filter(card=>{


let matchText =


(card.Front||"")
.toLowerCase()
.includes(text)


||

(card.Back||"")
.toLowerCase()
.includes(text)


||

(card.READING||"")
.toLowerCase()
.includes(text);



let matchLevel =


level=="" ||

card.JLPT_LEVEL==level;



return matchText && matchLevel;



})


);



}



load();


function speakJapanese(text){

    let speech =
    new SpeechSynthesisUtterance(text);

    speech.lang="ja-JP";

    speech.rate=0.8;

    speech.pitch=1;

    speechSynthesis.cancel();

    speechSynthesis.speak(speech);

}