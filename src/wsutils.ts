import * as fs from "fs";
import {PathLike} from "fs";
import * as mime from 'mime';
import * as crypto from "crypto";
import zlib from "zlib";

import XXHash from "xxhash";

export function sendFile(req, res, path: PathLike, status: number, args = {}) {
    // @ts-ignore
    let type = mime.getType(path);
    let content = fs.readFileSync(path, {encoding: 'utf-8'});

    Object.keys(args).forEach(key => {
        content = replaceAll(content, `"%key=%${key}%"`, `(JSON.parse(atob('${btoa(JSON.stringify(args[key]))}')))`)
    })
    addLengthQuick(res, content)
    res.setHeader("Content-Type", type)
    res.writeHead(status)
    if (res.req.method !== 'HEAD')
        res.write(content);
    res.end()
}

export function sendFileRaw(req, res, path: PathLike, status: number) {
    let content = fs.readFileSync(path);
    addLengthQuick(res, content)
    res.writeHead(status)
    if (res.req.method !== 'HEAD')
        res.write(content);
    res.end()
}


export function replaceAll(content: string, s: string, s2: string) {
    return content.split(s).join(s2)
}

export function btoa(obj) {
    if (!obj) return;
    if (typeof (obj) == "string") {
        return btoa_i(obj)
    } else {
        return btoa(JSON.stringify(obj))
    }
}

export function atob(obj: string) {
    if (!obj) return;
    return require('atob')(obj)
}

function btoa_i(str: string) {
    return Buffer.from(str).toString("base64");
}

export function consoleLog(str: String) {
    let date = new Date();
    let time: string = "" + (date.getHours() > 9 ? date.getHours() : "0" + date.getHours());
    time += ":" + (date.getMinutes() > 9 ? date.getMinutes() : "0" + date.getMinutes());
    time += ":" + (date.getSeconds() > 9 ? date.getSeconds() : "0" + date.getSeconds());

    console.log("[" + time + "] " + str)
}

export function sendText(res, text, code) {
    try {
        addLengthQuick(res, text)
        res.writeHead(code, {"Content-Type": "text/html; charset=utf-8"})
        if (text && res.req.method !== 'HEAD')
            res.write(text)
        res.end()
    } catch {
    }
}

export function sendJSON(res, json, code) {
    try {
        let txt = JSON.stringify(json)
        addLengthQuick(res, txt)
        res.writeHead(code, {"Content-Type": "application/json"})
        if (txt && res.req.method !== 'HEAD')
            res.write(txt)
        res.end()
    } catch {
    }
}

export function sendCompletion(res, text, error, code) {
    sendJSON(res, {error: error, text: text}, code);
}

export function byteSize(s:Buffer) {
    return s.length;
}

export function sha256(pwd) {
    if (!pwd) return undefined;
    return crypto.createHash('sha256').update(pwd).digest('hex');
}

export function sendMissingPermissionPage(perms, res) {
    sendText(res, `<script src="jsu.js"></script><h1>403 - Forbidden</h1>You don't have access to this resource. <a href="#" onclick="logout()">Logout</a><br>Permission: <code>${perms}</code>`, 403)
}

export function sendFlaggedPage(reason, res) {
    sendText(res, `<script src="jsu.js"></script><h1>403 - Forbidden. Account flagged</h1>You don't have access to this resource. <a href="#" onclick="logout()">Logout</a><br>Reason: ${reason}`, 403)
}

export function sendMissingPage(res) {
    sendText(res, "<h1>Error 404 - Not Found</h1><br/><span>Weird place, Void. If you think that something except of this text should be here contact the administrator</span>", 404)
}

export async function calcGzipSize(data): Promise<number> {
    try {
        if (!data) return 0;
        let stream = zlib.createGzip();
        let length: number = 0;
        await stream.write(Buffer.from(data, undefined));
        await stream.end();
        return (await new Promise<number>((resolve, reject) => {
            stream.on('data', function onStreamData(chunk) {
                length += chunk.length;
            })

            stream.on('end', function onStreamEnd() {
                resolve(length);
            })
        }))
    } catch (ex) {
        console.error(ex);
    }
    return 0;
}

export function createHash(content:Buffer){
    let hasher = new XXHash.XXHash64(0)
    hasher.update(content)
    return hasher.digest("hex");

    //return sha256(content);
}

export function addChecksumAndLength(res, content) {
    let t1 = +new Date();
    if (!content) return;
    let size = content.length;
    let buffer = Buffer.from(content);
    if (typeof content === typeof "") {
        size = byteSize(buffer)
    }
    let t2 = +new Date();
    res.setHeader("Content-Length", size)
	res.setHeader("X-Raw-Content-Length", size)
	let hash = createHash(buffer);
    res.setHeader("Content-Checksum", hash)
	res.setHeader("Content-Validation", hash)
    let t3 = +new Date();
}

export function addLengthQuick(res, content) {

}

export function HasAllProperties(obj: any, type_obj: any) {
    let result = true;
    let objk2 = Object.keys(obj);
    Object.keys(type_obj).forEach(key => {
        if (!objk2.includes(key)) {
            result = false;
            return;
        }
    })
    return result;
}