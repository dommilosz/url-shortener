let max_url_length = 128;
let max_surl_length = 128;
let valid_http_regex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

async function shorten(url,urlShort){
    if(!url){
        return {error:true,text:"Url not provided"};
    }
    if(!valid_http_regex.test(url)){
        return {error:true,text:"Url is invalid"};
    }
    if(url.length > max_url_length){
        return {error:true,text:"Url too long (max 256)"};
    }
    if(urlShort.length > max_surl_length){
        return {error:true,text:"urlShort too long (max 128)"};
    }

    let res = await fetch('/shorten', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({url,urlShort}),
    })

    let code = res.status;
    if(code === 429){
        let remaining = res.headers.get("RateLimit-Reset");
        let text = `${await res.text()} (${remaining}s remaining)`;
        return {error:true,text:text};
    }

    let json = await res.json();
    if(json.error){
        return {error:true,text:json.text};
    }else{
        return {error:false,text:json.text};
    }
}

async function do_shorten(){
    document.querySelector("#shorten-result-bar").innerHTML = "...";
    document.querySelector("#shorten-result-bar").style.backgroundColor = 'blue';
    document.querySelector('#surl-output').value = ``
    document.querySelector("#shorten-result-bar").style.color = 'white';

    let url = document.querySelector('#url-input').value;
    let surl = document.querySelector('#surl-input').value;

    if(!/^https?:\/\//.test(url)){
        url = "https://"+url;
        document.querySelector('#url-input').value = url;
    }

    let res=await shorten(url,surl);
    if(res.error){
        document.querySelector("#shorten-result-bar").innerHTML = "ERROR";
        document.querySelector("#shorten-result-bar").style.backgroundColor = 'red';
        document.querySelector('#surl-output').value = `${res.text}`
    }else{
        document.querySelector("#shorten-result-bar").innerHTML = "OK";
        document.querySelector("#shorten-result-bar").style.backgroundColor = 'green';
        document.querySelector('#surl-output').value = `${location.origin}/${res.text}`
    }

}

document.querySelector("#shorten-result-bar").innerHTML = "";
document.querySelector('#surl-output').value = ``
document.querySelector("#shorten-result-bar").style.color = 'white';

document.querySelectorAll(".location-origin-text").forEach(el=>{
    el.innerHTML = location.origin+"/";
})