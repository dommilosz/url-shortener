let admin = require("firebase-admin");
import {getFirestore} from "firebase-admin/firestore";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";

let serviceAccount = require('../firebase-secrets.json');

let defaultApp = initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:'https://urlshortener-9986c-default-rtdb.firebaseio.com'
});

export const firebase_db = getFirestore(defaultApp);
export const realtime_db = admin.database();
export const firebase_auth = getAuth();
