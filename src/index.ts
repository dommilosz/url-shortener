import express, {json, Request, Response} from 'express'
import {sendCompletion, sendFile, sendText} from './wsutils';
import {realtime_db} from "./firebase";
import rateLimit from 'express-rate-limit'
import fs from 'fs';

type configType = {
    "databaseURL": string,
    "rateLimiter": {
        "window": number,
        "amount": number
    },
    "port": number,
    "localization": {
        "loc-name": string,
        "loc-rate-limits": string,
        "loc-long-url-box-p": string,
        "loc-long-surl-box-p": string,
        "loc-shorten-button": string,
        "loc-long-surl-out-box-p": string,
        "loc-404-error": string,
        "loc-404-h2": string,
        "loc-404-shorten-first": string
    }
}

let default_config:configType = {
    "databaseURL": "https://example.firebaseio.com",
    "rateLimiter": {
        "window": 300,
        "amount": 30
    },
    "port": 8008,
    "localization": {
        "loc-name": "URL Shortener",
        "loc-rate-limits": "Rate limits apply: %1 shortens in %2 minutes",
        "loc-long-url-box-p": "Enter long url address",
        "loc-long-surl-box-p": "Leave empty to get random link",
        "loc-shorten-button": "Shorten!",
        "loc-long-surl-out-box-p": "There will be a shortened url",
        "loc-404-error": "404 Not Found",
        "loc-404-h2": "Nobody have ever shortened this",
        "loc-404-shorten-first": "Be first to shorten!"
    }
}

let config:configType = default_config;
if(fs.existsSync("./config.json")){
    config = JSON.parse(fs.readFileSync("./config.json",{encoding:"utf-8"}));
}else{
    console.error("config.json not found. Writing example one");
    fs.writeFileSync("./config.json",JSON.stringify(default_config),{encoding:"utf-8"});
    process.exit(0);
}

Object.keys(default_config).forEach(configKey=>{
    if(config[configKey] === undefined){
        config[configKey] = default_config[configKey];
    }
})

let max_url_length = 128;
let max_surl_length = 128;
let valid_http_regex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;

const app = express()
const port = config.port
app.use(json({limit: '50mb'}));

const limiter = rateLimit({
    windowMs: config.rateLimiter.window * 1000, // 1 minutes
    max: config.rateLimiter.amount, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})

config.localization["loc-rate-limits"] = config.localization["loc-rate-limits"].replace("%1", String(config.rateLimiter.amount));
config.localization["loc-rate-limits"] = config.localization["loc-rate-limits"].replace("%2", config.rateLimiter.window/60 + " minutes");

app.use('/shorten', limiter)

app.get('/', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.html", 200,config.localization);
})

app.get('/index.js', (req: Request, res: Response) => {
    sendFile(req, res, "src/front_index.js", 200);
})

app.get('/index.css', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.css", 200);
})

app.post('/shorten', async (req: Request, res: Response) => {
    let body = req.body;
    let url = body?.url;
    let urlShort = body?.urlShort;

    if (!url) {
        return sendCompletion(res, "Url not provided", true, 400);
    }

    if(url.length > max_url_length){
        return sendCompletion(res, `Url too long (max ${max_url_length})`, true, 400);
    }
    if(urlShort.length > max_surl_length){
        return sendCompletion(res, `Short Url too long (max ${max_surl_length})`, true, 400);
    }

    if (!valid_http_regex.test(url)) {
        return sendCompletion(res, "Url is invalid", true, 400);
    }
    if (!urlShort) {
        urlShort = 'A'+makeid(7);
    }
    if(urlShort.length < 2){
        return sendCompletion(res, `Short Url too short (min 2)`, true, 400);
    }

    let custom = isCustom(urlShort);

    let ref = realtime_db.ref(`urls/${custom?"c":"r"}/${urlShort}`);
    let snapshot = await ref.once('value');
    if (snapshot.exists()) {
        return sendCompletion(res, "Url taken", true, 400);
    }
    await ref.set({url});
    return sendCompletion(res, urlShort, false, 200);
})

app.get('/favicon.ico', (req: Request, res: Response) => {
  sendText(res,"",404);
})

app.get('/:shortUrl', async (req: Request, res: Response) => {
    let params = req.params;
    let custom = isCustom(params.shortUrl)
    let ref = realtime_db.ref(`urls/${custom?"c":"r"}/${params.shortUrl}`);
    let snapshot = await ref.once('value');
    if (snapshot.exists()) {
        let data = snapshot.val();
        res.redirect(data.url);
    }else{
        sendFile(req, res, "src/not-found.html", 404,config.localization);
    }
})

app.listen(port, () => {
    console.log(`App listening on port ${port}`)
})

function makeid(length) {
    let result = '';
    let characters = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

function isCustom(url:string){
    return !(/^A[a-zA-Z0-9]{7}$/.test(url));
}