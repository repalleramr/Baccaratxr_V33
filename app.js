
let bankroll = 30000

function updateRisk(){

let exposure = 3400
let percent = (exposure / bankroll) * 100

let bar = document.getElementById("riskfill")
bar.style.width = percent + "%"

if(percent < 10) bar.style.background = "green"
else if(percent < 25) bar.style.background = "yellow"
else bar.style.background = "red"

}

function tab(name){

document.getElementById("content").innerHTML =
"<div style='text-align:center;padding:40px'>" +
name.toUpperCase() + " TAB UI 2.0 COMING HERE</div>"

}

updateRisk()
