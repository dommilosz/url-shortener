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
    "validation":{
        randomShortUrlLength: number,
        randomRetries:number,
        maxUrlLength:number,
        maxShortUrlLength:number,
        minShortUrlLength:number
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

let default_config: configType = {
    validation: {
        maxShortUrlLength: 128,
        maxUrlLength: 128,
        minShortUrlLength: 2,
        randomRetries: 5,
        randomShortUrlLength: 8
    },
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

let config: configType = default_config;
if (fs.existsSync("./config.json")) {
    config = JSON.parse(fs.readFileSync("./config.json", {encoding: "utf-8"}));
} else {
    console.error("config.json not found. Writing example one");
    fs.writeFileSync("./config.json", JSON.stringify(default_config,null, 2), {encoding: "utf-8"});
    process.exit(0);
}

Object.keys(default_config).forEach(configKey => {
    if (config[configKey] === undefined) {
        config[configKey] = default_config[configKey];
    }
})

fs.writeFileSync("./config.json", JSON.stringify(config,null,2), {encoding: "utf-8"});

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
config.localization["loc-rate-limits"] = config.localization["loc-rate-limits"].replace("%2", config.rateLimiter.window / 60 + " minutes");

app.use('/shorten', limiter)

app.get('/', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.html", 200, config.localization);
})

app.get('/index.js', (req: Request, res: Response) => {
    sendFile(req, res, "src/front_index.js", 200,{config});
})

app.get('/index.css', (req: Request, res: Response) => {
    sendFile(req, res, "src/index.css", 200);
})

app.post('/shorten', async (req: Request, res: Response) => {
    let body = req.body;
    let url = body?.url;
    let urlShort = body?.urlShort;
    let result = await shorten(url, urlShort);

    return sendCompletion(res, result.text, result.error, 200);
})

app.get('/favicon.ico', (req: Request, res: Response) => {
    sendText(res, "", 404);
})

app.get('/:shortUrl', async (req: Request, res: Response) => {
    let params = req.params;
    let custom = isCustom(params.shortUrl);
	let urlShort = params.shortUrl;
    urlShort = encodeURIComponent(urlShort);
    let ref = realtime_db.ref(`urls/${custom ? "c" : "r"}/${urlShort}`);
    let snapshot = await ref.once('value');
    if (snapshot.exists()) {
        let data = snapshot.val();
        res.redirect(data.url);
    } else {
        sendFile(req, res, "src/not-found.html", 404, config.localization);
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

let customRegex = new RegExp(`^A[a-zA-Z0-9]{${config.validation.randomShortUrlLength-1}}$`)
function isCustom(url: string) {
    return !customRegex.test(url);
}

async function shorten(url, urlShort, retriesLeft = config.validation.randomRetries) {
    if (!urlShort) {
        urlShort = 'A' + makeid(config.validation.randomShortUrlLength-1);
    }
	urlShort = encodeURIComponent(urlShort);
    let validationResult = validateUrlAndSurl(url,urlShort);
    if(validationResult.error){
        return validationResult;
    }
    let custom = isCustom(urlShort);

    let ref = realtime_db.ref(`urls/${custom ? "c" : "r"}/${urlShort}`);
    let snapshot = await ref.once('value');
    if (snapshot.exists()) {
        if (!custom) {
            if(retriesLeft < 1){
                return {text: "Free url not found!", error: true};
            }
            return await shorten(url,"",retriesLeft-1);
        } else {
            return {text: "Url taken!", error: true};
        }
    }
    await ref.set({url});
    return {text: urlShort, error: false};
}

function validateUrlAndSurl(url, urlShort){
    if (!url) {
        return {text:"Url not provided",error:true};
    }
    if (url.length > config.validation.maxUrlLength) {
        return {text:`Url too long (max ${config.validation.maxUrlLength})`,error:true};
    }
    if (urlShort.length > config.validation.maxShortUrlLength) {
        return {text:`Short Url too long (max ${config.validation.maxShortUrlLength})`,error:true};
    }
    let valid_http_regex = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/;
    if (!valid_http_regex.test(url)) {
        return {text:"Url is invalid",error:true};
    }
    if (urlShort && urlShort.length < config.validation.minShortUrlLength) {
        return {text: `Short Url too short (min ${config.validation.minShortUrlLength})`, error: true};
    }
    return {text:"",error:false};
}